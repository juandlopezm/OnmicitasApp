"""
OmniCitas — Prueba de carga: Flujo de agendamiento de citas
============================================================
Mide exclusivamente la capacidad del sistema para procesar agendamientos
concurrentes de afiliados.

Flujo por usuario:
  1. Login → JWT
  2. Carga especialidades y médicos (una sola vez al inicio)
  3. Precarga pool de horarios disponibles
  4. Loop: agendar cita → verificar resultado

Uso:
  # Headless — 50 usuarios, 120 segundos
  locust -f locustfile_agendar.py --headless -u 50 -r 5 --run-time 120s --host https://localhost

  # UI interactiva
  locust -f locustfile_agendar.py --host https://localhost
"""

import random
import threading
from datetime import date, timedelta

import urllib3
from locust import HttpUser, between, task

urllib3.disable_warnings(urllib3.exceptions.InsecureRequestWarning)

# ── Credenciales demo ──────────────────────────────────────────────────────────
AFILIADOS = [
    {"tipo_documento": "CC", "numero_documento": "1234567890", "password": "demo123"},
    {"tipo_documento": "CC", "numero_documento": "9876543210", "password": "demo123"},
]

_lock = threading.Lock()


def proximos_dias_habiles(n: int = 10) -> list[str]:
    dias = []
    d = date.today() + timedelta(days=1)
    while len(dias) < n:
        if d.weekday() < 5:
            dias.append(d.isoformat())
        d += timedelta(days=1)
    return dias


# ══════════════════════════════════════════════════════════════════════════════
class AgendarCitaUser(HttpUser):
    """
    Afiliado que solo agenda citas.

    Secuencia por iteración:
      1. Elige un horario del pool
      2. POST /api/citas  (Saga completa)
      3. Si pool vacío → recarga horarios disponibles
    """

    wait_time = between(1.0, 3.0)

    def on_start(self):
        self.token = None
        self.headers = {}
        self.horarios_pool = []

        # 1 — Login
        creds = random.choice(AFILIADOS)
        with self.client.post(
            "/api/auth/login",
            json=creds,
            verify=False,
            name="POST /api/auth/login",
            catch_response=True,
        ) as resp:
            if resp.status_code == 200:
                self.token = resp.json().get("token")
                self.headers = {"Authorization": f"Bearer {self.token}"}
                resp.success()
            else:
                resp.failure(f"Login fallido: HTTP {resp.status_code}")
                return

        # 2 — Precargar pool de horarios
        if self.token:
            self._recargar_pool()

    # ── helpers ────────────────────────────────────────────────────────────────

    def _recargar_pool(self):
        """Consulta horarios disponibles para los próximos días hábiles y llena el pool."""
        pool = []
        medicos_ids = [1, 2, 3, 4]
        dias = proximos_dias_habiles(10)

        for medico_id in medicos_ids:
            for fecha in dias:
                r = self.client.get(
                    f"/api/horarios/disponibles?medico_id={medico_id}&fecha={fecha}",
                    headers=self.headers,
                    verify=False,
                    name="GET /api/horarios/disponibles [init]",
                )
                if r.status_code == 200:
                    slots = r.json()
                    pool.extend([
                        {
                            "id":       s["id"],
                            "sede_id":  s["sede_id"],
                            "medico_id": medico_id,
                        }
                        for s in slots
                        if s.get("estado") == "disponible"
                    ])
                if len(pool) >= 50:
                    break
            if len(pool) >= 50:
                break

        with _lock:
            self.horarios_pool = pool

    # ── tarea principal ────────────────────────────────────────────────────────

    @task
    def agendar_cita(self):
        """
        Agenda una cita activando la Saga completa:
          validar afiliado → SELECT FOR UPDATE horario → INSERT cita → publish RabbitMQ

        Códigos esperados:
          201 / 200  → cita creada correctamente
          409        → horario ya ocupado o cita duplicada (comportamiento correcto bajo carga)
          otros 4xx  → fallo real
        """
        if not self.token:
            return

        # Si el pool está vacío, recargarlo antes de continuar
        with _lock:
            pool_vacio = len(self.horarios_pool) == 0

        if pool_vacio:
            self._recargar_pool()
            return

        with _lock:
            if not self.horarios_pool:
                return
            horario = random.choice(self.horarios_pool)

        payload = {
            "horario_id":          horario["id"],
            "especialidad_id":     1,
            "sede_id":             horario["sede_id"],
            "medico_nombre":       "Luis Martinez",
            "especialidad_nombre": "Medicina General",
            "sede_nombre":         "Sede Norte",
        }

        with self.client.post(
            "/api/citas",
            json=payload,
            headers=self.headers,
            verify=False,
            name="POST /api/citas [saga]",
            catch_response=True,
        ) as resp:
            if resp.status_code in (200, 201):
                resp.success()
            elif resp.status_code == 409:
                # Conflicto esperado bajo alta concurrencia — no es un error
                resp.success()
            elif resp.status_code == 429:
                resp.failure("Rate limit")
            else:
                resp.failure(f"HTTP {resp.status_code}: {resp.text[:120]}")
