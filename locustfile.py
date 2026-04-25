"""
OmniCitas — Prueba de carga: Gestión de Citas
==============================================
Simula el flujo completo de un afiliado interactuando con el sistema de citas:
login → catálogo → disponibilidad → agendar → consultar → cancelar/reagendar

Uso:
  # UI interactiva en http://localhost:8089
  locust --host https://localhost

  # Headless — ajusta -u (usuarios), -r (nuevos/seg), --run-time
  locust --headless -u 20 -r 2 --run-time 120s --host https://localhost

  # Solo lectura (sin agendar citas)
  locust --headless -u 50 -r 5 --run-time 60s --host https://localhost --tags readonly

Clases de usuario:
  AfiliadoUser  — flujo completo (lectura + escritura)
  AdminUser     — gestión admin (horarios, citas, afiliados)
"""

import random
import threading
from datetime import date, timedelta

import urllib3
from locust import HttpUser, between, events, tag, task

urllib3.disable_warnings(urllib3.exceptions.InsecureRequestWarning)

# ── Credenciales demo ──────────────────────────────────────────────────────────
AFILIADOS = [
    {"tipo_documento": "CC", "numero_documento": "1234567890", "password": "demo123"},
    {"tipo_documento": "CC", "numero_documento": "9876543210", "password": "demo123"},
]
ADMIN_CREDS = {"email": "admin@omnicitas.com", "password": "admin123"}

# ── Lock global para evitar race conditions entre instancias Locust ───────────
_lock = threading.Lock()

# ── Helper: próximos días hábiles ─────────────────────────────────────────────
def proximos_dias_habiles(n: int = 10) -> list[str]:
    dias = []
    d = date.today() + timedelta(days=1)
    while len(dias) < n:
        if d.weekday() < 5:       # lunes-viernes
            dias.append(d.isoformat())
        d += timedelta(days=1)
    return dias


# ══════════════════════════════════════════════════════════════════════════════
# USUARIO AFILIADO
# ══════════════════════════════════════════════════════════════════════════════
class AfiliadoUser(HttpUser):
    """
    Simula un afiliado navegando y gestionando sus citas.

    Flujo on_start:
      1. Login → obtiene JWT
      2. Carga catálogos (especialidades, médicos)
      3. Precarga pool de horarios disponibles para los próximos 10 días hábiles

    Tareas (con pesos que reflejan uso real):
      - ver_mis_citas         (6) — la página que más se consulta
      - ver_especialidades    (5) — primer paso para crear cita
      - ver_medicos           (4) — segundo paso
      - ver_horarios          (4) — tercer paso (por médico + fecha)
      - ver_historial         (3) — historial completo
      - agendar_cita          (2) — POST con Saga; 409 = comportamiento esperado
      - cancelar_cita         (1) — cancela la última cita activa si existe
      - reagendar_cita        (1) — reagenda a un nuevo slot si hay cita activa
    """

    wait_time = between(1.5, 4.0)

    def on_start(self):
        """Inicializa la sesión: login + precarga de catálogos y horarios."""
        self.token = None
        self.headers = {}
        self.especialidades = []
        self.medicos = []
        self.horarios_pool = []   # pool de horario_ids disponibles
        self.cita_activa_id = None

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
            elif resp.status_code == 429:
                resp.failure("Rate limit en login")
                return
            else:
                resp.failure(f"Login fallido: HTTP {resp.status_code}")
                return

        # 2 — Catálogo de especialidades
        r = self.client.get(
            "/api/especialidades",
            headers=self.headers,
            verify=False,
            name="GET /api/especialidades [init]",
        )
        if r.status_code == 200:
            self.especialidades = r.json()

        # 3 — Médicos (primera especialidad disponible)
        if self.especialidades:
            esp_id = self.especialidades[0]["id"]
            r = self.client.get(
                f"/api/medicos?especialidad_id={esp_id}",
                headers=self.headers,
                verify=False,
                name="GET /api/medicos [init]",
            )
            if r.status_code == 200:
                self.medicos = r.json()

        # 4 — Pool de horarios disponibles (médico 1 en próximos días hábiles)
        # Solo si el login fue exitoso
        if self.token:
            self._recargar_pool_horarios()

    def _recargar_pool_horarios(self):
        """Rellena el pool de horario_ids disponibles para usar en bookings."""
        pool = []
        dias = proximos_dias_habiles(5)
        medico_id = 1   # usa médico 1 (Luis Martínez) — tiene horarios seeded

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
                    {"id": s["id"], "sede_id": s["sede_id"]}
                    for s in slots
                    if s.get("estado") == "disponible"
                ])
            if len(pool) >= 20:
                break

        with _lock:
            self.horarios_pool = pool

    # ── TAREAS DE LECTURA ───────────────────────────────────────────────────

    @tag("readonly")
    @task(6)
    def ver_mis_citas(self):
        """Consulta citas activas del afiliado — la operación más frecuente."""
        if not self.token:
            return
        with self.client.get(
            "/api/citas/mis-citas",
            headers=self.headers,
            verify=False,
            name="GET /api/citas/mis-citas",
            catch_response=True,
        ) as resp:
            if resp.status_code == 200:
                citas = resp.json()
                # Guarda la primera cita activa para tareas de cancelar/reagendar
                if citas:
                    self.cita_activa_id = citas[0]["id"]
                resp.success()
            else:
                resp.failure(f"HTTP {resp.status_code}")

    @tag("readonly")
    @task(5)
    def ver_especialidades(self):
        """Catálogo de especialidades — primer paso wizard de cita."""
        if not self.token:
            return
        with self.client.get(
            "/api/especialidades",
            headers=self.headers,
            verify=False,
            name="GET /api/especialidades",
            catch_response=True,
        ) as resp:
            if resp.status_code == 200:
                self.especialidades = resp.json()
                resp.success()
            else:
                resp.failure(f"HTTP {resp.status_code}")

    @tag("readonly")
    @task(4)
    def ver_medicos(self):
        """Médicos por especialidad — segundo paso wizard de cita."""
        if not self.token or not self.especialidades:
            return
        esp = random.choice(self.especialidades)
        with self.client.get(
            f"/api/medicos?especialidad_id={esp['id']}",
            headers=self.headers,
            verify=False,
            name="GET /api/medicos?especialidad_id=",
            catch_response=True,
        ) as resp:
            if resp.status_code == 200:
                resp.success()
            else:
                resp.failure(f"HTTP {resp.status_code}")

    @tag("readonly")
    @task(4)
    def ver_horarios(self):
        """Slots disponibles para un médico en un día hábil aleatorio."""
        if not self.token:
            return
        dias = proximos_dias_habiles(7)
        fecha = random.choice(dias)
        medico_id = random.randint(1, 4)
        with self.client.get(
            f"/api/horarios/disponibles?medico_id={medico_id}&fecha={fecha}",
            headers=self.headers,
            verify=False,
            name="GET /api/horarios/disponibles",
            catch_response=True,
        ) as resp:
            if resp.status_code == 200:
                resp.success()
            elif resp.status_code == 422:
                # Fecha inválida — marcar como éxito (respuesta esperada)
                resp.success()
            else:
                resp.failure(f"HTTP {resp.status_code}")

    @tag("readonly")
    @task(3)
    def ver_historial(self):
        """Historial completo de citas del afiliado."""
        if not self.token:
            return
        with self.client.get(
            "/api/citas/historial",
            headers=self.headers,
            verify=False,
            name="GET /api/citas/historial",
            catch_response=True,
        ) as resp:
            if resp.status_code == 200:
                resp.success()
            else:
                resp.failure(f"HTTP {resp.status_code}")

    # ── TAREAS DE ESCRITURA (Saga Pattern) ──────────────────────────────────

    @task(2)
    def agendar_cita(self):
        """
        Intenta agendar una cita (POST /api/citas).
        Activa la Saga completa: validar afiliado → lock horario → INSERT cita.
        - 201 / 200  = éxito real
        - 409        = horario ocupado o cita duplicada (comportamiento correcto)
        - 4xx otros  = fallo real
        """
        if not self.token or not self.horarios_pool:
            self._recargar_pool_horarios()
            return

        with _lock:
            if not self.horarios_pool:
                return
            horario = random.choice(self.horarios_pool)

        payload = {
            "horario_id":         horario["id"],
            "especialidad_id":    3,           # Medicina General
            "sede_id":            horario["sede_id"],
            "medico_nombre":      "Luis Martinez",
            "especialidad_nombre": "Medicina General",
            "sede_nombre":        "Sede Norte",
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
                data = resp.json()
                self.cita_activa_id = data.get("id")
                resp.success()
            elif resp.status_code == 409:
                # Slot ocupado o duplicado de especialidad: respuesta esperada
                resp.success()
            elif resp.status_code == 422:
                # Horario expirado / inválido — recargar pool
                self._recargar_pool_horarios()
                resp.success()
            elif resp.status_code == 429:
                resp.failure("Rate limit")
            else:
                resp.failure(f"HTTP {resp.status_code}: {resp.text[:120]}")

    @task(1)
    def cancelar_cita(self):
        """
        Cancela la última cita activa encontrada.
        Activa compensación Saga: estado=cancelada + liberar horario.
        """
        if not self.token or not self.cita_activa_id:
            return

        cita_id = self.cita_activa_id
        with self.client.delete(
            f"/api/citas/{cita_id}/cancelar",
            headers=self.headers,
            verify=False,
            name="DELETE /api/citas/{id}/cancelar",
            catch_response=True,
        ) as resp:
            if resp.status_code == 200:
                self.cita_activa_id = None
                resp.success()
            elif resp.status_code == 404:
                # Ya cancelada por otro worker
                self.cita_activa_id = None
                resp.success()
            elif resp.status_code == 400:
                # Menos de 24h — comportamiento esperado del negocio
                resp.success()
            else:
                resp.failure(f"HTTP {resp.status_code}: {resp.text[:120]}")

    @task(1)
    def reagendar_cita(self):
        """
        Reagenda la cita activa a un slot diferente.
        Activa intercambio de slots en Saga: lock nuevo → liberar anterior.
        """
        if not self.token or not self.cita_activa_id or not self.horarios_pool:
            return

        cita_id = self.cita_activa_id
        with _lock:
            if not self.horarios_pool:
                return
            nuevo = random.choice(self.horarios_pool)

        payload = {
            "horario_id":    nuevo["id"],
            "nueva_sede_id": nuevo["sede_id"],
        }
        with self.client.put(
            f"/api/citas/{cita_id}/reagendar",
            json=payload,
            headers=self.headers,
            verify=False,
            name="PUT /api/citas/{id}/reagendar",
            catch_response=True,
        ) as resp:
            if resp.status_code == 200:
                resp.success()
            elif resp.status_code in (404, 409, 400):
                # Cita no existe, slot ocupado o restricción 24h — esperados
                resp.success()
            else:
                resp.failure(f"HTTP {resp.status_code}: {resp.text[:120]}")


# ══════════════════════════════════════════════════════════════════════════════
# USUARIO ADMINISTRADOR
# ══════════════════════════════════════════════════════════════════════════════
class AdminUser(HttpUser):
    """
    Simula un administrador revisando el panel de gestión de citas y horarios.

    Tareas:
      - ver_todas_citas        (5) — listado global de citas
      - ver_horarios_admin     (4) — horarios de médico 1
      - ver_afiliados          (3) — listado de afiliados
      - cambiar_estado_cita    (1) — cambia estado de cita reciente (si existe)
    """

    wait_time = between(1.0, 3.0)
    weight = 1   # 1 admin por cada ~5 afiliados en el spawn

    def on_start(self):
        self.token = None
        self.headers = {}
        self.ultima_cita_id = None

        with self.client.post(
            "/api/admin/auth/login",
            json=ADMIN_CREDS,
            verify=False,
            name="POST /api/admin/auth/login",
            catch_response=True,
        ) as resp:
            if resp.status_code == 200:
                self.token = resp.json().get("token")
                self.headers = {"Authorization": f"Bearer {self.token}"}
                resp.success()
            else:
                resp.failure(f"Admin login fallido: HTTP {resp.status_code}")

    @tag("readonly")
    @task(5)
    def ver_todas_citas(self):
        """Lista todas las citas del sistema — vista principal admin."""
        if not self.token:
            return
        with self.client.get(
            "/api/admin/citas",
            headers=self.headers,
            verify=False,
            name="GET /api/admin/citas",
            catch_response=True,
        ) as resp:
            if resp.status_code == 200:
                citas = resp.json()
                if citas:
                    self.ultima_cita_id = citas[0]["id"]
                resp.success()
            else:
                resp.failure(f"HTTP {resp.status_code}")

    @tag("readonly")
    @task(4)
    def ver_horarios_admin(self):
        """Lista horarios de un médico — tab Horarios del panel admin."""
        if not self.token:
            return
        medico_id = random.randint(1, 4)
        with self.client.get(
            f"/api/admin/horarios?medico_id={medico_id}",
            headers=self.headers,
            verify=False,
            name="GET /api/admin/horarios",
            catch_response=True,
        ) as resp:
            if resp.status_code == 200:
                resp.success()
            else:
                resp.failure(f"HTTP {resp.status_code}")

    @tag("readonly")
    @task(3)
    def ver_afiliados(self):
        """Lista afiliados — panel de gestión de afiliados."""
        if not self.token:
            return
        with self.client.get(
            "/api/admin/afiliados",
            headers=self.headers,
            verify=False,
            name="GET /api/admin/afiliados",
            catch_response=True,
        ) as resp:
            if resp.status_code == 200:
                resp.success()
            else:
                resp.failure(f"HTTP {resp.status_code}")

    @task(1)
    def cambiar_estado_cita(self):
        """Cambia el estado de una cita a 'confirmada' si existe."""
        if not self.token or not self.ultima_cita_id:
            return
        with self.client.put(
            f"/api/admin/citas/{self.ultima_cita_id}/estado",
            json={"estado": "confirmada"},
            headers=self.headers,
            verify=False,
            name="PUT /api/admin/citas/{id}/estado",
            catch_response=True,
        ) as resp:
            if resp.status_code in (200, 400, 404):
                # 400 = transición inválida, 404 = no existe — ambos esperados
                resp.success()
            else:
                resp.failure(f"HTTP {resp.status_code}")
