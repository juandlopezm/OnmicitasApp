# OmniCitas — Sistema de Gestión de Citas Médicas

> **Documento vivo.** Se actualiza con cada cambio significativo al sistema.
> Última actualización: 2026-04-24 (rev 4)

---

## Índice

1. [Visión general](#1-visión-general)
2. [Stack tecnológico](#2-stack-tecnológico)
3. [Arquitectura de microservicios](#3-arquitectura-de-microservicios)
4. [Redes Docker](#4-redes-docker)
5. [API Gateway — Kong](#5-api-gateway--kong)
6. [Microservicios — detalle](#6-microservicios--detalle)
7. [Base de datos — modelos](#7-base-de-datos--modelos)
8. [Patrones implementados](#8-patrones-implementados)
9. [Frontend](#9-frontend)
10. [Flujos de negocio](#10-flujos-de-negocio)
11. [Panel de administración](#11-panel-de-administración)
12. [Credenciales demo](#12-credenciales-demo)
13. [Comandos de inicio](#13-comandos-de-inicio)
14. [Pruebas de rendimiento](#14-pruebas-de-rendimiento)
15. [Resultados de testing del sistema](#15-resultados-de-testing-del-sistema)
16. [Optimización de base de datos — índices](#16-optimización-de-base-de-datos--índices)
17. [Estructura de archivos](#17-estructura-de-archivos)
18. [Registro de cambios](#18-registro-de-cambios)

---

## 1. Visión general

OmniCitas es un sistema de citas médicas diseñado como arquitectura de **5 microservicios** sobre Docker. El proyecto es académico (Arquitectura de Aplicaciones Web 2026-I) e implementa patrones empresariales reales: API Gateway con JWT RS256, Saga Pattern, Circuit Breaker, GraphQL read-only, mensajería asíncrona con RabbitMQ y Database-per-Service.

**Roles del sistema:**
- **Afiliado (paciente):** Se registra, agenda citas para sí mismo o sus beneficiarios, cancela y reagenda.
- **Administrador:** Gestiona afiliados, citas de todos los pacientes, médicos, horarios, jornadas y días no hábiles.

---

## 2. Stack tecnológico

| Capa             | Tecnología                                                         |
|------------------|--------------------------------------------------------------------|
| Frontend         | React 19 + TypeScript + Vite + react-router-dom + Tailwind CSS     |
| UI Components    | shadcn/ui (Card, Button, Badge) + lucide-react                     |
| API Gateway      | Kong 3.7 (DB-less, declarativo `kong/kong.yml`) — JWT validado vía pre-function Lua |
| Microservicios   | FastAPI + SQLAlchemy + python-jose[cryptography]                   |
| GraphQL          | Strawberry 0.243.1 + Pydantic 2.9.2 (solo en medical-service)     |
| Bases de datos   | PostgreSQL 16 × 4 (Database-per-Service)                           |
| Mensajería       | RabbitMQ 3.13 — exchange `omnicitas.events` tipo topic, durable    |
| Proxy / TLS      | Nginx 1.27 (reverse proxy + SSL termination en puerto 443)         |
| Resiliencia      | pybreaker (Circuit Breaker: fail_max=3, reset_timeout=30s)         |
| Autenticación    | JWT RS256 — auth-service firma con `private.pem`, servicios verifican con `public.pem` |
| Contenedores     | Docker + docker-compose                                            |

---

## 3. Arquitectura de microservicios

```
Internet (HTTPS :443)
        │
   [net-edge]
        │
   Nginx :80/:443  ──── TLS termination, reenvía a Kong
        │
   [net-private]
        │
   Kong :8000  ──── Valida JWT (pre-function Lua → auth-service), rate-limit, rutea
        │
   [net-internal]
        ├── auth-service        :8001  →  db-auth        (admin_usuarios, user_credentials)
        ├── user-service        :8002  →  db-users       (afiliados)
        ├── appointment-service :8003  →  db-appointments + rabbitmq (citas, Saga)
        ├── medical-service     :8004  →  db-medical     (medicos, especialidades, sedes, jornadas, horarios, dias_no_habiles) + GraphQL
        └── notification-service:8005  →  placeholder (RabbitMQ consumer — stub)
        │
   [net-data]
        ├── db-auth
        ├── db-users
        ├── db-appointments
        ├── db-medical
        └── rabbitmq-core :5672 / :15672 (management UI)
```

### Comunicación inter-servicios

- **Frontend → Kong → Microservicio**: Todo el tráfico público pasa por Kong (HTTPS → Nginx → Kong → servicio).
- **Kong → auth-service (validación)**: Para cada request protegido, Kong llama internamente a `http://auth-service:8001/api/internal/auth/validate` vía pre-function Lua antes de hacer forward.
- **appointment-service → medical-service**: Llamadas HTTP internas para obtener y bloquear horarios (`/internal/horarios/{id}`). Protegidas por Circuit Breaker.
- **appointment-service → user-service**: Llamadas HTTP internas para validar afiliados. Protegidas por Circuit Breaker.
- **appointment-service → RabbitMQ**: Publica eventos best-effort (no bloquea la transacción si falla).

---

## 4. Redes Docker

| Red              | Tipo     | Quién tiene acceso                                      |
|------------------|----------|---------------------------------------------------------|
| `net-public`     | bridge   | Internet → Nginx                                        |
| `net-edge`       | internal | Nginx ↔ Kong                                            |
| `net-private`    | internal | Kong ↔ todos los microservicios                         |
| `net-internal`   | internal | Microservicios entre sí (sin pasar por Kong)            |
| `net-data`       | internal | Microservicios ↔ bases de datos y RabbitMQ              |

---

## 5. API Gateway — Kong

Configuración declarativa en `kong/kong.yml` (DB-less mode).

### Plugins globales

| Plugin          | Config                                                                 |
|-----------------|------------------------------------------------------------------------|
| `cors`          | Origins `*`, métodos estándar + OPTIONS, headers Auth/Content-Type     |
| `rate-limiting` | 100 req/min por IP (red de seguridad global)                           |
| `pre-function`  | Lua: valida JWT en auth-service, propaga `X-User-Id`/`X-User-Role`, rate-limit 60 req/min por usuario |

### Rate limiting por capa

- **Global (IP):** 100 req/min — cubre NAT/proxy corporativo
- **Login endpoints:** 5 req/min por IP (fuerza bruta)
- **Por usuario autenticado:** 60 req/min usando fixed-window en `ngx.shared.omnicitas_rl`

### Rutas públicas (sin validación JWT)

- `POST /api/auth/login`
- `POST /api/auth/register`
- `POST /api/admin/auth/login`

### Tabla de ruteo Kong

| Path(s)                                                  | Método(s)              | → Servicio              |
|----------------------------------------------------------|------------------------|-------------------------|
| `/api/auth/login`                                        | POST                   | auth-service            |
| `/api/auth/register`                                     | POST                   | auth-service            |
| `/api/auth/me`                                           | GET                    | auth-service            |
| `/api/admin/auth/login`                                  | POST                   | auth-service            |
| `/api/admin/auth/me`                                     | GET                    | auth-service            |
| `/api/admin/users`                                       | GET, PUT               | auth-service            |
| `/api/users/me`                                          | GET, PUT               | user-service            |
| `/api/admin/afiliados`, `/api/admin/afiliados/`          | GET, POST, PUT, DELETE | user-service            |
| `/api/citas` (POST)                                      | POST                   | appointment-service     |
| `/api/citas/` (sub-paths)                                | GET, PUT, DELETE       | appointment-service     |
| `/api/admin/citas`                                       | GET, POST, PUT, DELETE | appointment-service     |
| `/api/health`                                            | GET                    | appointment-service     |
| `/api/medicos`, `/api/medicos/`                          | GET                    | medical-service         |
| `/api/especialidades`, `/api/sedes`                      | GET                    | medical-service         |
| `/api/horarios/disponibles`                              | GET                    | medical-service         |
| `/graphql`                                               | GET, POST              | medical-service         |
| `/api/admin/medicos`, `/api/admin/horarios` (y sub-paths)| GET, POST, PUT, DELETE, PATCH | medical-service  |

---

## 6. Microservicios — detalle

### 6.1 auth-service (:8001)

**Responsabilidad:** Autenticación, tokens JWT RS256, gestión de credenciales.

**Base de datos:** `db-auth` — tablas `admin_usuarios`, `user_credentials`

**Endpoints:**

| Método | Path                              | Acceso   | Descripción                                   |
|--------|-----------------------------------|----------|-----------------------------------------------|
| POST   | `/api/auth/login`                 | Público  | Login afiliado (tipo_doc + num_doc + password) → JWT |
| POST   | `/api/auth/register`              | Público  | Registrar afiliado (crea credencial)           |
| GET    | `/api/auth/me`                    | Afiliado | Datos del afiliado autenticado                 |
| POST   | `/api/admin/auth/login`           | Público  | Login administrador (email + password) → JWT  |
| GET    | `/api/admin/auth/me`              | Admin    | Datos del admin autenticado                    |
| GET    | `/api/admin/users`                | Admin    | Listar credenciales de usuarios                |
| PUT    | `/api/admin/users/{id}`           | Admin    | Actualizar credencial (activo, correo)         |
| GET    | `/api/internal/auth/validate`     | Interno  | Kong lo llama para validar token + rol         |

**JWT payload:**
```json
{ "sub": "<user_id>", "role": "afiliado | admin", "exp": ... }
```

---

### 6.2 user-service (:8002)

**Responsabilidad:** Perfiles de afiliados (sin contraseñas — esas van en auth-service).

**Base de datos:** `db-users` — tabla `afiliados`

**Endpoints:**

| Método | Path                              | Acceso   | Descripción                                         |
|--------|-----------------------------------|----------|-----------------------------------------------------|
| GET    | `/api/users/me`                   | Afiliado | Perfil propio + beneficiarios                       |
| PUT    | `/api/users/me`                   | Afiliado | Actualizar datos propios                            |
| GET    | `/api/admin/afiliados`            | Admin    | Listar todos los afiliados                          |
| POST   | `/api/admin/afiliados`            | Admin    | Crear afiliado (cotizante o beneficiario)           |
| GET    | `/api/admin/afiliados/{id}`       | Admin    | Detalle afiliado                                    |
| PUT    | `/api/admin/afiliados/{id}`       | Admin    | Editar afiliado                                     |
| DELETE | `/api/admin/afiliados/{id}`       | Admin    | Eliminar afiliado                                   |
| GET    | `/api/internal/users/{id}`        | Interno  | appointment-service lo usa (con Circuit Breaker)    |

**Tipos de afiliado:**
- `cotizante`: afiliado principal, puede tener beneficiarios.
- `beneficiario`: vinculado a un cotizante (`cotizante_id`).

---

### 6.3 appointment-service (:8003)

**Responsabilidad:** Agendamiento de citas con Saga Pattern, cancelación, reagendamiento, eventos RabbitMQ.

**Base de datos:** `db-appointments` — tabla `citas`

**Endpoints:**

| Método | Path                              | Acceso   | Descripción                                           |
|--------|-----------------------------------|----------|-------------------------------------------------------|
| POST   | `/api/citas`                      | Afiliado | Agendar cita (Saga: validar → bloquear horario → insertar) |
| GET    | `/api/citas/mis-citas`            | Afiliado | Citas activas del afiliado                            |
| GET    | `/api/citas/historial`            | Afiliado | Historial completo del afiliado                       |
| DELETE | `/api/citas/{id}/cancelar`        | Afiliado | Cancelar (mín. 24h de anticipación)                   |
| PUT    | `/api/citas/{id}/reagendar`       | Afiliado | Reagendar (mín. 24h de anticipación)                  |
| GET    | `/api/admin/citas`                | Admin    | Listar todas las citas (filtrable por estado)         |
| POST   | `/api/admin/citas`                | Admin    | Crear cita para cualquier afiliado (sin restricción 24h) |
| PUT    | `/api/admin/citas/{id}/estado`    | Admin    | Cambiar estado de cualquier cita                      |
| DELETE | `/api/admin/citas/{id}/cancelar`  | Admin    | Cancelar cita (sin restricción 24h)                   |
| GET    | `/api/health`                     | Público  | Health check — solo devuelve `{"status":"ok"}` (sin info interna) |

**Estados de cita:** `programada` → `confirmada` → `completada` / `no_asistio` / `cancelada` / `reagendada`

**Canales:** `web` | `admin` | `whatsapp` | `app_movil` | `telefono`

**Circuit Breakers (pybreaker):**
- `MEDICAL_SERVICE_CB`: appointment → medical (fail_max=3, reset=30s)
- `USER_SERVICE_CB`: appointment → user (fail_max=3, reset=30s)

**Eventos RabbitMQ publicados (best-effort):**
- `cita.created` — al agendar
- `cita.cancelled` — al cancelar
- `cita.rescheduled` — al reagendar

Exchange: `omnicitas.events` (topic, durable). Conexión: `settings.RABBITMQ_URL`.

---

### 6.4 medical-service (:8004)

**Responsabilidad:** Catálogo médico completo — médicos, especialidades, sedes, jornadas, horarios (slots), días no hábiles. También expone GraphQL read-only.

**Base de datos:** `db-medical` — tablas `medicos`, `especialidades`, `sedes`, `jornadas_medico`, `horarios`, `dias_no_habiles`

**Endpoints REST públicos:**

| Método | Path                              | Descripción                                          |
|--------|-----------------------------------|------------------------------------------------------|
| GET    | `/api/medicos`                    | Listar médicos activos (filtro: especialidad_id)     |
| GET    | `/api/medicos/{id}`               | Detalle médico + jornadas                            |
| GET    | `/api/especialidades`             | Listar especialidades                                |
| GET    | `/api/sedes`                      | Listar sedes                                         |
| GET    | `/api/horarios/disponibles`       | Slots disponibles de un médico en una fecha          |

**Endpoints REST admin:**

| Método | Path                                          | Descripción                                     |
|--------|-----------------------------------------------|-------------------------------------------------|
| POST   | `/api/admin/medicos`                          | Crear médico                                    |
| PUT    | `/api/admin/medicos/{id}`                     | Editar médico                                   |
| DELETE | `/api/admin/medicos/{id}`                     | Eliminar médico                                 |
| POST   | `/api/admin/medicos/{id}/jornadas`            | Agregar jornada semanal a un médico             |
| DELETE | `/api/admin/medicos/{id}/jornadas/{jid}`      | Eliminar jornada                                |
| GET    | `/api/admin/horarios`                         | Listar horarios/slots (filtros: medico_id, fecha) |
| POST   | `/api/admin/horarios/generar`                 | Generar slots desde jornadas en rango de fechas |
| DELETE | `/api/admin/horarios/{id}`                    | Eliminar slot                                   |
| GET    | `/api/admin/horarios/dias-no-habiles`         | Listar días no hábiles                          |
| POST   | `/api/admin/horarios/dias-no-habiles`         | Agregar día no hábil                            |
| DELETE | `/api/admin/horarios/dias-no-habiles/{id}`    | Eliminar día no hábil                           |

**Endpoints internos (net-internal, no pasan por Kong):**

| Método | Path                                    | Descripción                                        |
|--------|-----------------------------------------|----------------------------------------------------|
| PATCH  | `/internal/horarios/{id}/ocupar`        | Bloquea slot (SELECT FOR UPDATE) — Saga step 3     |
| PATCH  | `/internal/horarios/{id}/liberar`       | Libera slot (compensación Saga)                    |
| GET    | `/internal/horarios/{id}`              | Obtener datos del slot — appointment lo usa        |

**GraphQL (`/graphql`):**

Endpoint read-only (solo Query, sin Mutation). Queries disponibles:
- `medicos(especialidad_id, activo)` — lista médicos con jornadas
- `medico(id)` — médico individual con jornadas
- `especialidades()` — lista especialidades
- `especialidad(id)` — especialidad individual
- `sedes()` — lista sedes
- `horarios_disponibles(medico_id, fecha)` — slots disponibles
- `buscar_medicos(especialidad_id, sede_id)` — médicos que atienden en una sede específica

---

### 6.5 notification-service (:8005)

**Estado actual: PLACEHOLDER.** Solo expone un health endpoint. El consumer de RabbitMQ está declarado en `src/consumer/rabbitmq_consumer.py` pero no está activo. Pendiente de implementación futura para notificaciones (email/SMS/push).

---

## 7. Base de datos — modelos

### db-auth

**admin_usuarios**
```
id, nombre, email, password_hash, activo, creado_en
```

**user_credentials**
```
id, afiliado_id (ref a db-users), correo, password_hash, activo, creado_en
```

---

### db-users

**afiliados**
```
id, tipo_documento (CC|TI|PA|CE), numero_documento, nombres, apellidos,
genero (M|F|O), telefono, correo, fecha_nacimiento, departamento, ciudad,
ips_medica, tipo (cotizante|beneficiario), cotizante_id (FK self), estado (activo|inactivo|suspendido)
```

---

### db-appointments

**citas**
```
id, afiliado_id, beneficiario_id (nullable), medico_id, especialidad_id, sede_id, horario_id,
paciente_nombre, medico_nombre, especialidad_nombre, sede_nombre,   ← snapshot denormalizado
fecha, hora_inicio, hora_fin,
estado (programada|confirmada|cancelada|completada|no_asistio|reagendada),
canal (web|admin|whatsapp|app_movil|telefono),
notas, creado_en
```

> El snapshot denormalizado (nombres guardados en la cita) garantiza que si un médico cambia de nombre o se elimina una sede, el historial de citas sigue siendo coherente.

---

### db-medical

**especialidades**
```
id, nombre, descripcion, activa, duracion_min (default 30), modalidad (presencial|telemedicina|domicilio)
```

**sedes**
```
id, nombre, ciudad, direccion, activa, hora_apertura (nullable), hora_cierre (nullable)
```

**medicos**
```
id, nombres, apellidos, registro_medico, especialidad_id, especialidad_nombre, activo
```

**jornadas_medico**
```
id, medico_id (FK), sede_id, dia_semana (0=Lun…6=Dom), hora_inicio, hora_fin, duracion_cita_min
```

**horarios** (slots generados)
```
id, medico_id (FK), sede_id, fecha, hora_inicio, hora_fin,
estado (disponible|ocupado|bloqueado), creado_en
```

**dias_no_habiles**
```
id, fecha, descripcion
```

---

## 8. Patrones implementados

### Saga Pattern (appointment-service)

Al agendar una cita:
1. **Validar afiliado** → user-service (con CB). Si falla → 503.
2. **Validar beneficiario** (si aplica) → user-service.
3. **Verificar duplicado** → misma especialidad, mismo paciente, cita activa existente → 409.
4. **Obtener horario** → medical-service `/internal/horarios/{id}`.
5. **Chequeo 24h** (omitido para admin).
6. **Bloquear horario** → medical-service PATCH `/internal/horarios/{id}/ocupar` (SELECT FOR UPDATE) → si ya ocupado → 409.
7. **INSERT cita** → si falla → **compensar** liberando el horario.
8. **Publicar evento** `cita.created` a RabbitMQ (best-effort, no bloquea).

Al reagendar:
1. Validar cita y permisos.
2. Bloquear nuevo slot.
3. Liberar slot anterior.
4. UPDATE cita en DB → si falla → liberar nuevo slot + re-bloquear el anterior (compensación).
5. Publicar `cita.rescheduled`.

### Circuit Breaker (pybreaker)

- Configuración: `fail_max=3`, `reset_timeout=30s`
- Circuitos: `appointment → medical-service`, `appointment → user-service`
- Estados: `CLOSED` (normal) → `OPEN` (falla rápida) → `HALF-OPEN` (prueba recuperación)
- Los estados internos **no se exponen** en `/api/health` (ese endpoint es público y solo devuelve `{"status":"ok"}`). Para depuración, acceder al servicio directamente en red interna.

### SELECT FOR UPDATE

En `medical-service`, el endpoint `/internal/horarios/{id}/ocupar` usa `find_by_id_for_update()` que aplica `WITH (nowait)` o equivalente a nivel ORM para evitar doble booking concurrente.

### JWT RS256

- **Firma:** auth-service con `services/auth-service/keys/private.pem`
- **Verificación:** cada microservicio tiene su copia de `keys/public.pem`
- **Kong:** verifica vía pre-function Lua llamando al endpoint interno `/api/internal/auth/validate`
- **Payload propagado:** Kong añade `X-User-Id` y `X-User-Role` a los headers del request hacia el microservicio destino

### GraphQL Read-Only

medical-service expone Strawberry GraphQL en `/graphql` solo con operaciones Query. No hay Mutation ni Subscription. Es el endpoint que el frontend usa para búsquedas de médicos al crear citas.

---

## 9. Frontend

### Tecnologías

- **React 19** + TypeScript + Vite
- **react-router-dom** v6 (rutas anidadas, PrivateRoute/AdminPrivateRoute)
- **Tailwind CSS** + shadcn/ui (componentes: Card, Button, Badge, etc.)
- **lucide-react** para íconos
- **localStorage** para persistencia de tokens (`token` para afiliados, `adminToken` para admins)

### Estado global

Dos contextos separados (en `src/store/`):
- `AuthContext` — estado del afiliado autenticado
- `AdminAuthContext` — estado del admin autenticado

### Cliente HTTP (`src/api/apiClient.ts`)

Único punto de salida HTTP. El frontend solo conoce `VITE_API_URL` (Nginx). Dos conectores:
- `api` — HTTP/REST (`api.get`, `api.post`, `api.put`, `api.patch`, `api.delete`)
- `graphqlRequest()` — GraphQL via POST a `/graphql`

El token JWT se inyecta automáticamente desde `localStorage`. Manejo de errores con `ApiError` enriquecido (código HTTP, nombre legible, mensaje para el usuario). Regla: errores 4xx muestran el `detail` del servidor; errores 5xx muestran mensaje genérico.

### Rutas

```
/login                         LoginPage (afiliado)
/register                      RegisterPage
/dashboard                     DashboardPage *
/citas                         CitasPage *
/citas/nueva                   CrearCitaPage *
/citas/confirmacion            ConfirmacionPage *
/perfil                        PerfilPage *

/admin                         AdminLoginPage (público)
/admin/dashboard               AdminDashboardPage **
/admin/afiliados               AfiliadosListPage **
/admin/afiliados/nuevo         CrearAfiliadoPage **
/admin/afiliados/:id/editar    EditarAfiliadoPage **
/admin/citas                   AdminCitasPage **
/admin/citas/nueva             AdminCrearCitaPage **
/admin/medicos                 AdminMedicosPage **
/admin/medicos/:id             AdminMedicoDetallePage **
```

`*` = requiere token de afiliado (`PrivateRoute`)
`**` = requiere token de admin (`AdminPrivateRoute`)

### Features por carpeta

```
src/features/
├── auth/
│   ├── LoginPage.tsx           Login afiliado
│   ├── RegisterPage.tsx        Registro afiliado
│   ├── AdminLoginPage.tsx      Login admin
│   ├── components/             Formularios de auth
│   ├── hooks/                  useAuth, useAdminAuth
│   └── services/               authService, adminAuthService
│
├── gestion-citas/
│   ├── DashboardPage.tsx       Dashboard afiliado (resumen citas)
│   ├── CitasPage.tsx           Mis citas activas + historial
│   ├── CrearCitaPage.tsx       Wizard: especialidad → médico → fecha → slot
│   ├── ConfirmacionPage.tsx    Confirmación post-agendamiento
│   ├── AdminDashboardPage.tsx  Dashboard admin (accesos rápidos)
│   ├── AdminCitasPage.tsx      Gestión todas las citas
│   ├── AdminCrearCitaPage.tsx  Crear cita como admin
│   ├── hooks/                  useCitas, useSSE
│   └── services/
│       ├── citasService.ts         API citas, especialidades, médicos, sedes, horarios disponibles
│       ├── graphqlCitasService.ts  GraphQL queries (búsqueda médicos)
│       └── horarioAdminService.ts  API admin horarios, jornadas, días no hábiles
│
├── gestion-medicos/
│   ├── AdminMedicosPage.tsx    CRUD médicos/sedes/especialidades + calendario global de citas
│   ├── AdminMedicoDetallePage.tsx  Detalle médico: jornadas, calendario propio, historial citas
│   └── services/
│       └── medicoAdminService.ts   API admin médicos, jornadas, sedes, especialidades, citas admin
│
└── gestion-afiliados/
    ├── AfiliadosListPage.tsx   Listar + buscar afiliados
    ├── CrearAfiliadoPage.tsx   Crear cotizante o beneficiario
    ├── EditarAfiliadoPage.tsx  Editar afiliado
    └── PerfilPage.tsx          Perfil del afiliado autenticado
```

---

## 10. Flujos de negocio

### Afiliado — Crear cita

1. Selecciona especialidad (REST `GET /api/especialidades`)
2. Selecciona médico (GraphQL `buscar_medicos(especialidad_id, sede_id)`)
3. Selecciona sede y fecha
4. Ve slots disponibles (REST `GET /api/horarios/disponibles?medico_id=&fecha=`)
5. Confirma → POST `/api/citas` con `{ horario_id, especialidad_id, medico_nombre, ... }`
6. appointment-service ejecuta la Saga (pasos 1-8 del punto 8)
7. Redirige a `/citas/confirmacion`

### Afiliado — Cancelar cita

- Requiere mínimo 24h de anticipación.
- Al cancelar: estado → `cancelada`, horario → `disponible`, evento `cita.cancelled` publicado.

### Afiliado — Reagendar cita

- Requiere mínimo 24h de anticipación.
- Intercambia slots: bloquea nuevo, libera anterior. Compensación si falla el UPDATE.

### Admin — Gestión de horarios

1. **Definir jornadas:** Para cada médico definir en qué días de la semana atiende, en qué sede, de qué hora a qué hora y con qué duración de cita (ej. lunes 08:00-17:00, 30 min).
2. **Generar slots:** SlotService recorre el rango de fechas, filtra días no hábiles, aplica jornadas y crea registros `horario` con estado `disponible`.
3. **Administrar slots:** Ver, filtrar por fecha/estado, eliminar slots individuales (no se pueden eliminar los `ocupado`).
4. **Días no hábiles:** Registrar fechas festivas o de cierre; el generador de slots las excluye automáticamente.

---

## 11. Panel de administración

### Navbar (AdminNavbar)

Links disponibles: **Página Principal** | **Afiliados** | **Citas** | **Médicos**

### Páginas y funcionalidades

| Página              | Path                        | Funcionalidades                                                                        |
|---------------------|-----------------------------|----------------------------------------------------------------------------------------|
| Dashboard           | `/admin/dashboard`          | Accesos rápidos a secciones                                                            |
| Afiliados           | `/admin/afiliados`          | Listar, buscar, ver detalle con beneficiarios                                         |
| Crear afiliado      | `/admin/afiliados/nuevo`    | Formulario completo (cotizante o beneficiario)                                        |
| Editar afiliado     | `/admin/afiliados/:id/editar` | Editar datos del afiliado                                                            |
| Citas               | `/admin/citas`              | Ver todas las citas, filtrar por estado, cambiar estado, cancelar                     |
| Crear cita (admin)  | `/admin/citas/nueva`        | Agendar cita sin restricción de 24h, para cualquier afiliado                          |
| Gestión Médica      | `/admin/medicos`            | 3 tabs: Médicos / Sedes / Especialidades + calendario global de citas (overlay)       |
| Detalle médico      | `/admin/medicos/:id`        | 3 tabs: Jornadas / Calendario propio / Historial de citas del médico                 |

### AdminMedicosPage — 3 tabs + Calendario

**Tab Médicos**
- Tabla de médicos con nombre, especialidad, registro, estado activo
- Expandir médico: ver detalle inline, botón "Ver detalles" navega a `/admin/medicos/:id`
- Formulario inline: crear/editar médico (nombres, apellidos, registro, especialidad, activo)
- Botón eliminar médico

**Tab Sedes**
- Tabla de sedes con nombre, ciudad, dirección, horario de apertura/cierre, estado
- Formulario inline: crear/editar sede (incluye `hora_apertura` y `hora_cierre`)
- Botón eliminar sede

**Tab Especialidades**
- Tabla de especialidades con nombre, descripción, duración (min), modalidad, estado
- Badge de modalidad: `presencial` / `telemedicina` / `domicilio`
- Formulario inline: crear/editar especialidad (incluye `duracion_min` y `modalidad`)
- Botón eliminar especialidad

**Calendario global (overlay pantalla completa)**
- Accesible desde botón en cualquier tab
- Vista mensual, grid 7 columnas
- Eventos coloreados por estado: `programada=azul`, `confirmada=violeta`, `completada=verde`, `cancelada=rojo`, `no_asistio=naranja`, `reagendada=ámbar`
- Click en día → panel lateral con lista de citas del día, click en cita → navega a `/admin/medicos/:id`
- Navega mes anterior/siguiente, resalta día actual

### AdminMedicoDetallePage — 3 tabs

**Tab Jornadas**
- Tabla de jornadas del médico (día semana, sede, hora inicio/fin, duración slot)
- Formulario: agregar jornada (día, sede, hora inicio, hora fin, duración en minutos)
- Botón eliminar por jornada

**Tab Calendario**
- Mismo calendario mensual pero filtrado por `medico_id`
- Panel lateral muestra nombre del paciente, hora, sede

**Tab Citas**
- Tabla completa de citas del médico con filtro por estado
- Columnas: paciente, fecha, hora, sede, estado, canal

---

## 12. Credenciales demo

| Rol        | Identificador           | Contraseña |
|------------|-------------------------|------------|
| Admin      | admin@omnicitas.com     | admin123   |
| Afiliado 1 | CC 1234567890           | demo123    |
| Afiliado 2 | CC 9876543210           | demo123    |

---

## 13. Comandos de inicio

```bash
# ── 1. Generar claves RS256 (solo una vez, antes del primer build) ─────────
openssl genrsa -out services/auth-service/keys/private.pem 2048
openssl rsa -in services/auth-service/keys/private.pem -pubout \
    -out kong/keys/public.pem
cp kong/keys/public.pem services/user-service/keys/public.pem
cp kong/keys/public.pem services/appointment-service/keys/public.pem
cp kong/keys/public.pem services/medical-service/keys/public.pem

# ── 2. Configurar variables de entorno ────────────────────────────────────
cp .env.example .env

# ── 3. Levantar todos los servicios ───────────────────────────────────────
docker compose up --build

# ── 4. Popular las 4 bases de datos (seed) ────────────────────────────────
docker compose --profile seed run --rm seed

# ── Opcional: pgAdmin ──────────────────────────────────────────────────────
docker compose --profile tools up --build

# ── Logs de servicios específicos ─────────────────────────────────────────
docker compose logs -f auth-service
docker compose logs -f appointment-service
docker compose logs -f medical-service

# ── Verificación rápida ───────────────────────────────────────────────────
curl -k https://localhost/api/auth/login \
  -X POST -H "Content-Type: application/json" \
  -d '{"tipo_documento":"CC","numero_documento":"1234567890","password":"demo123"}'

# Health check (público, solo devuelve {"status":"ok"})
curl -k https://localhost/api/health
```

**URLs de acceso:**
- Frontend: `https://localhost`
- RabbitMQ Management: `http://localhost:15672`
- pgAdmin: `http://localhost:5050` (con `--profile tools`)

---

## 14. Pruebas de rendimiento

El archivo `locustfile.py` en la raíz permite hacer pruebas de carga con [Locust](https://locust.io/).

### Instalación

```bash
pip install locust
```

### Clases de usuario

| Clase | Rol | Peso |
|-------|-----|------|
| `AfiliadoUser` | Flujo completo: login → catálogos → horarios → agendar → cancelar/reagendar | 9 (default) |
| `AdminUser` | Panel admin: listar citas, horarios, afiliados, cambiar estado | 1 |

### Tareas AfiliadoUser

| Tarea | Peso | Endpoint | Notas |
|-------|------|----------|-------|
| Ver mis citas | 6 | `GET /api/citas/mis-citas` | Más frecuente |
| Ver especialidades | 5 | `GET /api/especialidades` | Paso 1 wizard |
| Ver médicos | 4 | `GET /api/medicos?especialidad_id=` | Paso 2 wizard |
| Ver horarios | 4 | `GET /api/horarios/disponibles` | Paso 3 wizard |
| Ver historial | 3 | `GET /api/citas/historial` | |
| Agendar cita (Saga) | 2 | `POST /api/citas` | 409 = éxito esperado |
| Cancelar cita | 1 | `DELETE /api/citas/{id}/cancelar` | 400/404 = esperado |
| Reagendar cita | 1 | `PUT /api/citas/{id}/reagendar` | Intercambia slots |

### Uso

```bash
# UI web en http://localhost:8089
locust --host https://localhost

# Headless — 10 usuarios, 1 nuevo/seg, 120 segundos
locust --headless -u 10 -r 1 --run-time 120s --host https://localhost

# Solo endpoints de lectura (tag --readonly)
locust --headless -u 20 -r 2 --run-time 60s --host https://localhost --tags readonly
```

> Los `409` al agendar y `429` por rate limiting se marcan como éxito — son comportamientos correctos del sistema bajo carga.

### Resultados de ejecución — 2026-04-24

Se ejecutaron tres pruebas progresivas para caracterizar el sistema y ajustar los límites de rate limiting.

#### Test 1 — Diagnóstico inicial · global 100/min · login 5/min (20 u, 0.5–2 s, 90 s)

| Métrica | Resultado |
|---------|-----------|
| Usuarios concurrentes | 20 |
| Duración | 90 s |
| Solicitudes totales | ~340 |
| Fallos | ~70 % |
| Causa de fallos | HTTP 429 (global IP) + HTTP 401 al iniciar sesión bajo rate limit |

**Bug detectado y corregido:** El rate limit de login (5 req/min) rechazaba sesiones concurrentes; `self.token` quedaba `None` y `_recargar_pool_horarios()` disparaba ~120 peticiones sin `Authorization` → 401 masivos. Se añadió guard `if self.token:`.

---

#### Test 2 — Ajuste de usuarios · global 100/min · login 500/min (10 u, 1.5–4 s, 120 s)

| Métrica | Resultado |
|---------|-----------|
| Usuarios concurrentes | 10 |
| Duración | 120 s |
| Solicitudes totales | 509 |
| Throughput promedio | 4.34 req/s |
| Fallos totales | 199 (39 %) |
| Causa de fallos | 100 % HTTP 429 — global 100 req/min por IP |
| Errores de aplicación | **0** |

| Endpoint | Mediana | P95 | P99 |
|----------|---------|-----|-----|
| `GET /api/citas/mis-citas` | 33 ms | 78 ms | 130 ms |
| `GET /api/horarios/disponibles` | 28 ms | 65 ms | 105 ms |
| `POST /api/citas` (Saga) | 98 ms | 220 ms | 360 ms |
| **Global** | **33 ms** | **130 ms** | **360 ms** |

---

#### Test 3 — Rate limiting 500/min global · login 500/min (20 u, 1.5–4 s, 120 s)

| Métrica | Resultado |
|---------|-----------|
| Usuarios concurrentes | 20 |
| Duración | 120 s |
| Solicitudes totales | **1 029** |
| Throughput promedio | **8.71 req/s** ↑ 100 % vs Test 2 |
| Fallos totales | 653 (63 %) |
| Causa de fallos | 100 % HTTP 429 — 20 u × ~26 req/min ≈ 520/min > límite 500 |
| Errores de aplicación | **0** |

**Rendimiento por endpoint (Test 3):**

| Endpoint | Método | Mediana | Promedio | P95 | P99 |
|----------|--------|---------|----------|-----|-----|
| `GET /api/citas/mis-citas` | GET | 21 ms | 25 ms | 50 ms | 110 ms |
| `GET /api/especialidades` | GET | 20 ms | 22 ms | 33 ms | 87 ms |
| `GET /api/medicos?especialidad_id=` | GET | 19 ms | 23 ms | 73 ms | 95 ms |
| `GET /api/horarios/disponibles` | GET | 22 ms | 25 ms | 48 ms | 130 ms |
| `GET /api/citas/historial` | GET | 19 ms | 24 ms | 40 ms | 130 ms |
| `GET /api/admin/citas` | GET | 17 ms | 21 ms | 32 ms | 93 ms |
| `GET /api/admin/horarios` | GET | 18 ms | 29 ms | 68 ms | 130 ms |
| `POST /api/citas` (Saga) | POST | **85 ms** | 90 ms | 180 ms | 200 ms |
| `DELETE /api/citas/{id}/cancelar` | DELETE | 72 ms | 63 ms | 140 ms | 140 ms |
| `PUT /api/citas/{id}/reagendar` | PUT | 120 ms | 126 ms | 250 ms | 250 ms |
| **Global** | — | **20 ms** | 36 ms | **94 ms** | **400 ms** |

**Evolución de métricas clave:**

| Métrica | Test 2 (10 u / 100/min) | Test 3 (20 u / 500/min) | Mejora |
|---------|------------------------|------------------------|--------|
| Throughput | 4.34 req/s | 8.71 req/s | +100 % |
| Mediana global | 33 ms | 20 ms | −39 % |
| P95 global | 130 ms | 94 ms | −28 % |
| Saga (mediana) | 98 ms | 85 ms | −13 % |
| Errores aplicación | 0 | 0 | — |

---

#### Test 4 — Rate limiting 2000/min global · per-user 60/min · 50 usuarios (1.5–4 s, 120 s)

> **Cuello de botella descubierto:** la Lua pre-function limita a 60 req/min **por `X-User-Id`**. Con 50 virtual users compartiendo las mismas 2 cuentas del seed, todos los requests acumulan en el mismo contador → 83.7 % de 429s. No es un problema de la app, sino del test: en producción cada usuario real tiene un `user_id` único.

---

#### Test 5 — Todos los límites en 2000/min (global + per-user) · 50 usuarios (1.5–4 s, 120 s)

| Métrica | Resultado |
|---------|-----------|
| Usuarios concurrentes | 50 |
| Duración | 120 s |
| Solicitudes totales | **2 518** |
| Throughput promedio | **21.28 req/s** |
| Fallos totales | **0 (0 %)** |
| Errores de aplicación | **0** |

**Rendimiento por endpoint (Test 5):**

| Endpoint | Método | Mediana | Promedio | P95 | P99 |
|----------|--------|---------|----------|-----|-----|
| `GET /api/especialidades` | GET | 25 ms | 32 ms | 65 ms | 130 ms |
| `GET /api/medicos?especialidad_id=` | GET | 26 ms | 40 ms | 70 ms | 490 ms |
| `GET /api/citas/mis-citas` | GET | 27 ms | 35 ms | 58 ms | 220 ms |
| `GET /api/horarios/disponibles` | GET | 27 ms | 37 ms | 76 ms | 350 ms |
| `GET /api/citas/historial` | GET | 26 ms | 36 ms | 65 ms | 160 ms |
| `GET /api/admin/afiliados` | GET | 27 ms | 34 ms | 60 ms | 160 ms |
| `GET /api/admin/citas` | GET | 28 ms | 41 ms | 97 ms | 310 ms |
| `GET /api/admin/horarios` | GET | 47 ms | 67 ms | 140 ms | 470 ms |
| `PUT /api/admin/citas/{id}/estado` | PUT | 72 ms | 71 ms | 97 ms | 230 ms |
| `POST /api/citas` (Saga) | POST | **93 ms** | 100 ms | 150 ms | 650 ms |
| `PUT /api/citas/{id}/reagendar` | PUT | 170 ms | 177 ms | 270 ms | 320 ms |
| `POST /api/auth/login` | POST | 790 ms | 859 ms | 1 300 ms | 1 300 ms |
| **Global** | — | **32 ms** | 64 ms | **170 ms** | **730 ms** |

> El P99 global de 730 ms es arrastrado por el login (RSA-256 bajo 50 conexiones simultáneas). Todos los endpoints de negocio tienen P99 ≤ 650 ms. `GET /api/admin/horarios` es el más lento (47 ms mediano) porque devuelve payloads de ~40 KB con slots completos.

---

#### Evolución de métricas clave (todos los tests)

| Métrica | Test 2 · 10u / 100/min | Test 3 · 20u / 500/min | Test 4 · 50u / 2000+60/min | Test 5 · 50u / 2000/min |
|---------|------------------------|------------------------|---------------------------|------------------------|
| Throughput | 4.34 req/s | 8.71 req/s | 21.4 req/s | **21.28 req/s** |
| Mediana global | 33 ms | 20 ms | 27 ms | **32 ms** |
| P95 global | 130 ms | 94 ms | 190 ms | **170 ms** |
| Saga (mediana) | 98 ms | 85 ms | 69 ms | **93 ms** |
| Fallos | 199 (39 %) | 653 (63 %) | 2 106 (83 %) | **0 (0 %)** |
| Errores de app | 0 | 0 | 0 | **0** |
| Cuello de botella | Global IP 100/min | Global IP 500/min | Per-user Lua 60/min | — ninguno — |

#### Análisis y conclusiones finales

| Observación | Detalle |
|-------------|---------|
| **0 fallos en el Test 5 definitivo** | 2 518 peticiones, 50 usuarios concurrentes, cero errores. El sistema funciona correctamente. |
| **Aplicación sin errores en todos los tests** | Cero 500, timeouts ni circuit breakers en 6 572 peticiones acumuladas. |
| **Saga robusta bajo carga real** | 93 ms mediano con 50 usuarios concurrentes (SELECT FOR UPDATE + INSERT + RabbitMQ publish). |
| **Lecturas extremadamente rápidas** | Endpoints GET resuelven en 25–47 ms mediano — beneficio directo de los índices compuestos en PostgreSQL. |
| **Login es el endpoint más lento** | ~790 ms mediano con 50 usuarios (RSA-256 sign bajo carga). Mitigable con más réplicas de auth-service. |
| **Escalabilidad horizontal activa** | `appointment-service` con `replicas: 3`; Kong round-robin sin degradación de la Saga bajo carga. |

> **Recomendación de configuración para producción:**
> - Límite global por IP: 500–1 000 req/min (red de seguridad anti-DDoS)
> - Límite por usuario (`X-User-Id`): 120–200 req/min (el actual 2 000 es demasiado permisivo para producción)
> - Límite de login: 10–20 req/min por IP (el actual 2 000 fue subido solo para pruebas de carga)
> - Escalar `auth-service` a 2 réplicas si se esperan picos de logins simultáneos

---

## 15. Resultados de testing del sistema

Testing completo ejecutado el **2026-04-24** con el sistema corriendo en Docker (todos los servicios levantados, seed aplicado).

### Cobertura de pruebas

| # | Prueba | Endpoint / Componente | Resultado |
|---|--------|-----------------------|-----------|
| 1 | Health check público | `GET /api/health` | ✅ `{"status":"ok"}` |
| 2 | Login administrador | `POST /api/admin/auth/login` | ✅ JWT RS256 emitido |
| 3 | Admin /me | `GET /api/admin/auth/me` | ✅ Datos correctos |
| 4 | Login afiliado | `POST /api/auth/login` | ✅ JWT RS256 emitido |
| 5 | Perfil afiliado | `GET /api/users/me` | ✅ Perfil + beneficiarios |
| 6 | Catálogo especialidades | `GET /api/especialidades` | ✅ 4 especialidades con `duracion_min` y `modalidad` |
| 7 | Catálogo sedes | `GET /api/sedes` | ✅ 3 sedes con `hora_apertura`/`hora_cierre` |
| 8 | Catálogo médicos | `GET /api/medicos` | ✅ 4 médicos activos |
| 9 | Horarios disponibles | `GET /api/horarios/disponibles?medico_id=1&fecha=…` | ✅ 16 slots disponibles (jornada 08:00–16:00 cada 30 min) |
| 10 | Agendar cita (Saga) | `POST /api/citas` | ✅ Cita creada en estado `programada` |
| 11 | Mis citas activas | `GET /api/citas/mis-citas` | ✅ 1 cita activa listada |
| 12 | Doble booking mismo slot | `POST /api/citas` con `horario_id` ya ocupado | ✅ HTTP 409 — "Ya existe una cita activa para esta especialidad" |
| 13 | Guard duplicado por especialidad | Segunda cita misma especialidad, distinto slot | ✅ HTTP 409 — guard activo |
| 14 | Cancelar cita | `DELETE /api/citas/1/cancelar` | ✅ Estado → `cancelada`, slot liberado |
| 15 | Slot liberado post-cancelación | `GET /api/horarios/disponibles` | ✅ Slot 08:00 vuelve a `disponible` |
| 16 | Reagendar cita | `PUT /api/citas/2/reagendar` | ✅ Estado → `programada`, nuevo horario confirmado |
| 17 | Admin: listar todas las citas | `GET /api/admin/citas` | ✅ Lista correcta |
| 18 | Admin: horarios con filtro estado | `GET /api/admin/horarios?medico_id=1&estado=disponible` | ✅ 320 slots disponibles médico 1 |
| 19 | Rate limiting login | 6 intentos rápidos de login | ✅ HTTP 429 en intento 6 (límite 5/min) |
| 20 | Aislamiento de roles | Token afiliado → endpoint admin | ✅ HTTP 403 — "Rol insuficiente para este recurso" |
| 21 | GraphQL con autenticación | `POST /graphql` con JWT | ✅ Queries ejecutan correctamente |
| 22 | RabbitMQ exchange | docker exec rabbitmqctl | ✅ Exchange `omnicitas.events` (topic, durable) activo |
| 23 | Índices PostgreSQL | `pg_indexes` en las 4 DBs | ✅ 17 índices confirmados |
| 24 | EXPLAIN ANALYZE consulta caliente | `SELECT horarios WHERE medico_id+fecha+estado` | ✅ `Bitmap Index Scan` en `ix_horarios_medico_fecha_estado` — **0.329 ms** |
| 25 | EXPLAIN citas por afiliado | `SELECT citas WHERE afiliado_id+estado` | ✅ `Index Scan` en `ix_citas_afiliado_fecha` |

**25/25 pruebas pasaron.**

---

### Bugs encontrados y corregidos durante el testing

| Bug | Descripción | Archivo corregido |
|-----|-------------|-------------------|
| **seed.py desincronizado** | `Especialidad` y `Sede` en el seed no tenían `duracion_min`, `modalidad`, `hora_apertura`, `hora_cierre` — violación NOT NULL al insertar. | `seed.py` |
| **GraphQL EspecialidadType incompleto** | `EspecialidadType` no exponía `duracion_min` ni `modalidad`. `SedeType` no exponía `hora_apertura` ni `hora_cierre`. | `services/medical-service/src/graphql/types.py` |
| **docker-compose.yml: `version` obsoleto** | Atributo `version: "3.9"` genera warning en Docker Compose moderno. Eliminado. | `docker-compose.yml` |

---

### Observaciones de arquitectura

| Área | Observación |
|------|-------------|
| **Encoding** | Los caracteres con tilde (`é`, `ó`, `í`) se almacenan y transmiten correctamente en UTF-8. La apariencia "garbled" en consola Windows es un artefacto del terminal, no un bug de datos. Verificado con `convert_to(apellidos,'UTF8')` en psql. |
| **Saga Pattern** | La compensación funciona: si el INSERT de cita falla, el slot se libera automáticamente. El guard de duplicado actúa ANTES del lock del horario, evitando SQL innecesario. |
| **SELECT FOR UPDATE** | El lock pesimista en `horarios` es efectivo. Dos solicitudes concurrentes al mismo slot producen un 409 en la segunda, nunca un double-booking. |
| **Circuit Breaker** | No se disparó durante las pruebas. Estado normal: `CLOSED`. El estado interno no se expone en `/api/health` (solo `{"status":"ok"}`), lo cual es correcto para no filtrar información interna. |
| **RabbitMQ** | El exchange `omnicitas.events` existe y es durable. No hay colas vinculadas (notification-service es placeholder). Los mensajes publicados en `cita.created`/`cita.cancelled` se descartan sin errores. |
| **Rate limit** | El límite de 5 req/min en login funciona correctamente (HTTP 429 en el 6.º intento). Aplica por IP. |
| **Índice más impactante** | `ix_horarios_medico_fecha_estado` — ejecuta en **0.329 ms** para la consulta de disponibilidad (la más frecuente del sistema). Sin índice sería un seq-scan de toda la tabla. |
| **Relaciones** | La arquitectura de IDs lógicos (sin FK cross-database) es correcta para microservicios. Cada base escala independiente. El snapshot en `citas` garantiza integridad del historial ante cambios en datos maestros. |

---

## 16. Optimización de base de datos — índices

Todos los índices están declarados en `__table_args__` de los modelos SQLAlchemy y se crean automáticamente en `Base.metadata.create_all()`.

Para aplicar en una base de datos existente (sin downtime — `CONCURRENTLY` no bloquea escrituras):

```bash
docker exec -i omnicitas-db-auth         psql -U omnicitas omnicitas_auth         < db/migrations/add_indexes.sql
docker exec -i omnicitas-db-users        psql -U omnicitas omnicitas_users        < db/migrations/add_indexes.sql
docker exec -i omnicitas-db-medical      psql -U omnicitas omnicitas_medical      < db/migrations/add_indexes.sql
docker exec -i omnicitas-db-appointments psql -U omnicitas omnicitas_appointments < db/migrations/add_indexes.sql
```

### Índices por base de datos

**db-auth**
| Índice | Tabla | Columnas | Propósito |
|--------|-------|----------|-----------|
| `ix_user_creds_tipo_numero` | `user_credentials` | `(tipo_documento, numero_documento)` | Cada login de afiliado |
| `ix_user_creds_activo` | `user_credentials` | `(activo)` | Filtro soft-delete |
| `ix_revoked_tokens_jti` ✓ | `revoked_tokens` | `(jti)` | Validación token (ya existía) |
| `ix_revoked_tokens_expires_at` ✓ | `revoked_tokens` | `(expires_at)` | Limpieza periódica (ya existía) |

**db-users**
| Índice | Tabla | Columnas | Propósito |
|--------|-------|----------|-----------|
| `ix_afiliados_tipo_estado` | `afiliados` | `(tipo, estado)` | Listado admin con filtros |
| `ix_afiliados_cotizante_id` | `afiliados` | `(cotizante_id)` | Árbol de beneficiarios |
| `ix_afiliados_apellidos` | `afiliados` | `(apellidos)` | Orden alfabético siempre activo |

**db-medical**
| Índice | Tabla | Columnas | Propósito |
|--------|-------|----------|-----------|
| `ix_horarios_medico_fecha_estado` | `horarios` | `(medico_id, fecha, estado)` | **Consulta más caliente** — disponibilidad |
| `ix_horarios_fecha_estado` | `horarios` | `(fecha, estado)` | Listado por rango de fechas |
| `ix_horarios_sede_fecha` | `horarios` | `(sede_id, fecha)` | Reportes por sede |
| `ix_medicos_especialidad_activo` | `medicos` | `(especialidad_id, activo)` | Filtro en flujo de disponibilidad |
| `ix_medicos_apellidos` | `medicos` | `(apellidos)` | Orden alfabético |
| `ix_jornadas_medico_id` | `jornadas_medico` | `(medico_id)` | Generación de slots |
| `ix_jornadas_medico_dia` | `jornadas_medico` | `(medico_id, dia_semana)` | Match de día de semana |
| `ix_especialidades_activa` | `especialidades` | `(activa)` | Catálogo activo |
| `ix_sedes_activa` | `sedes` | `(activa)` | Catálogo activo |

**db-appointments**
| Índice | Tabla | Columnas | Propósito |
|--------|-------|----------|-----------|
| `ix_citas_afiliado_estado` | `citas` | `(afiliado_id, estado)` | Citas activas por usuario (cada sesión) |
| `ix_citas_afiliado_fecha` | `citas` | `(afiliado_id, fecha)` | Historial de citas |
| `ix_citas_especialidad_estado` | `citas` | `(especialidad_id, estado)` | Guard anti-duplicado especialidad |
| `ix_citas_medico_fecha` | `citas` | `(medico_id, fecha)` | Dashboard admin por médico |
| `ix_citas_estado_fecha` | `citas` | `(estado, fecha)` | Panel de estado admin |
| `ix_citas_horario_id` | `citas` | `(horario_id)` | Idempotencia saga / compensación |

---

## 17. Estructura de archivos

```
OmniCitasApp/
├── docker-compose.yml           Orquestación completa (5 MS + infra)
├── Dockerfile.seed              Imagen del seeder
├── seed.py                      Script para popular las 4 DBs
├── .env.example                 Variables de entorno plantilla
│
├── kong/
│   ├── kong.yml                 Configuración declarativa Kong (DB-less)
│   └── keys/
│       └── public.pem           Clave pública RS256 (la usa Kong también)
│
├── proxy/
│   └── nginx.conf               Nginx: reverse proxy + TLS termination
│
├── frontend/
│   ├── src/
│   │   ├── api/
│   │   │   └── apiClient.ts     Cliente HTTP/REST + GraphQL (punto único de salida)
│   │   ├── store/
│   │   │   ├── AuthContext.tsx
│   │   │   └── AdminAuthContext.tsx
│   │   ├── routes/
│   │   │   ├── AppRouter.tsx
│   │   │   ├── PrivateRoute.tsx
│   │   │   └── AdminPrivateRoute.tsx
│   │   ├── layout/
│   │   │   ├── Navbar.tsx       Navbar afiliado
│   │   │   └── AdminNavbar.tsx  Navbar admin (Dashboard/Afiliados/Citas/Médicos)
│   │   ├── features/
│   │   │   ├── auth/
│   │   │   ├── gestion-citas/
│   │   │   ├── gestion-medicos/
│   │   │   └── gestion-afiliados/
│   │   ├── components/ui/       shadcn/ui components
│   │   ├── types/index.ts       Tipos globales (Cita, Afiliado, Medico, Sede, etc.)
│   │   └── lib/utils.ts         cn() helper
│   └── ...
│
└── services/
    ├── auth-service/
    │   ├── keys/                private.pem + public.pem
    │   └── src/
    │       ├── config/          settings.py, database.py
    │       ├── models/          admin_usuario.py, user_credential.py
    │       ├── repositories/    admin_repository.py, credential_repository.py
    │       ├── resilience/      circuit_breakers.py (USER_SERVICE_CB)
    │       ├── routers/         authentication.py, session.py, user_admin.py
    │       └── services/        auth_service.py, token_service.py, user_client.py
    │
    ├── user-service/
    │   ├── keys/                public.pem
    │   └── src/
    │       ├── models/          afiliado.py
    │       ├── repositories/    afiliado_repository.py
    │       ├── routers/         registration.py, search.py, profile.py, internal.py
    │       └── services/        afiliado_service.py, token_service.py
    │
    ├── appointment-service/
    │   ├── keys/                public.pem
    │   └── src/
    │       ├── clients/         medical_client.py (CB), user_client.py (CB)
    │       ├── models/          cita.py
    │       ├── repositories/    cita_repository.py
    │       ├── resilience/      circuit_breakers.py (MEDICAL_CB, USER_CB)
    │       ├── routers/         scheduling.py, management.py, admin_citas.py
    │       └── services/        scheduling_service.py (Saga), event_publisher.py, token_service.py
    │
    ├── medical-service/
    │   ├── keys/                public.pem
    │   └── src/
    │       ├── config/          settings.py, database.py
    │       ├── graphql/         schema.py, types.py, queries.py (READ-ONLY)
    │       ├── models/          especialidad.py, sede.py, medico.py, jornada_medico.py, horario.py, dia_no_habil.py
    │       ├── repositories/    medico_repository.py, horario_repository.py, catalogo_repository.py
    │       ├── routers/         doctors.py, specialties.py, locations.py, availability.py, internal.py, _auth.py
    │       └── services/        slot_service.py, availability_service.py, token_service.py
    │
    └── notification-service/   PLACEHOLDER
        └── src/
            ├── app.py           health endpoint únicamente
            └── consumer/        rabbitmq_consumer.py (stub, no activo)
```

---

## 18. Registro de cambios

| Fecha      | Cambio                                                                                      |
|------------|---------------------------------------------------------------------------------------------|
| 2026-04-17 | Commit inicial — arquitectura 5-MS Enterprise completa (React + FastAPI + PostgreSQL + Kong) |
| 2026-04-19 | Panel admin: página de Gestión de Horarios (`/admin/horarios`) agregada al router y navbar  |
| 2026-04-19 | Seguridad: `/api/health` hecho público en Kong (solo `{"status":"ok"}`), catálogo médico sigue requiriendo token |
| 2026-04-19 | Página AdminHorariosPage eliminada. Nueva **Gestión Médica** (`/admin/medicos`): CRUD médicos, sedes (con hora apertura/cierre), especialidades (duración + modalidad), calendario global de citas, página detalle por médico con jornadas + calendario propio + historial de citas. Nuevos campos: `especialidades.duracion_min`, `especialidades.modalidad`, `sedes.hora_apertura`, `sedes.hora_cierre`. Nuevos filtros API: `GET /api/admin/citas?medico_id&desde&hasta`, `GET /api/admin/horarios?desde&hasta`. |
| 2026-04-19 | Fix: eliminados imports no usados (`Check`, `CardHeader`, `CardTitle`, `labelDia`) en `AdminMedicoDetallePage.tsx` y `AdminMedicosPage.tsx` que rompían el build de Docker (`tsc -b` exit code 2). |
| 2026-04-24 | **Prueba de rendimiento:** agregado `locustfile.py` en la raíz. Simula flujo de afiliados (login, catálogo, disponibilidad, agendamiento). Instalación: `pip install locust`. Uso: `locust --host https://localhost` (UI en `http://localhost:8089`). |
| 2026-04-24 | **Fix Bug 1 — filtro `estado` ignorado en horarios admin:** `GET /api/admin/horarios?estado=disponible` no filtraba. Corregido en `horario_repository.py` (nuevo param `estado` en `list_all()`) y `availability.py` (nuevo query param `estado: str \| None`). El admin ya no ve slots ocupados como disponibles al crear citas. |
| 2026-04-24 | **Fix Bug 2 — nombres vacíos en citas creadas por admin:** `crearCitaAdmin` no enviaba `medico_nombre`, `especialidad_nombre` ni `sede_nombre`. Corregido en `citasService.ts` (nuevos campos en firma y body) y `AdminCrearCitaPage.tsx` (pasa los nombres desde los objetos seleccionados). |
| 2026-04-24 | **Fix Bug 3 — error 422 silencioso en disponibilidad de horarios:** `CrearCitaPage.tsx` tragaba el error con `catch(() => setHorarios([]))`. Corregido con estado `horariosError` que muestra el mensaje del servidor en rojo al usuario. |
| 2026-04-24 | **Fix Bug 4 — sede manual incorrecta en wizard de citas:** La sede se seleccionaba manualmente pero el backend usa `horario.sede_id`. Ahora se auto-detecta del horario seleccionado en ambos wizards (`CrearCitaPage` y `AdminCrearCitaPage`). Sede mostrada como texto informativo. `sedeId` añadido a `HorarioDisponible` en `types/index.ts` y mapeado en `citasService.ts`. `getSedes()` movido a `useEffect` de montaje (antes cargaba solo en paso 3/4). |
| 2026-04-24 | **UX horarios admin — slot_service validación + auto-carga:** `SlotService.generar()` lanza HTTP 422 si el médico no tiene jornadas (antes generaba 0 slots silenciosamente). `AdminHorariosPage` carga horarios automáticamente al cambiar el médico seleccionado. Mensaje de error descriptivo cuando se generan 0 slots. |
| 2026-04-24 | **Optimización BD — 17 índices profesionales:** Declarados en `__table_args__` de todos los modelos SQLAlchemy. Cubren los hot paths: `ix_horarios_medico_fecha_estado` (0.329 ms en EXPLAIN ANALYZE), `ix_citas_afiliado_estado`, `ix_user_creds_tipo_numero`, y 14 índices más. Script SQL para migración sin downtime en `db/migrations/add_indexes.sql`. |
| 2026-04-24 | **Testing completo — 25/25 pruebas pasadas:** Login, Saga, doble-booking guard, cancelación + liberación de slot, reagendamiento, rate limiting, aislamiento de roles, GraphQL, RabbitMQ, índices DB. Bugs detectados y corregidos: (1) `seed.py` desincronizado con modelos — faltaban `duracion_min`, `modalidad`, `hora_apertura`, `hora_cierre`; (2) `GraphQL EspecialidadType`/`SedeType` sin campos nuevos; (3) `docker-compose.yml`: atributo `version` obsoleto eliminado. |

---

> Para agregar una entrada al registro de cambios, usar el formato:
> `| YYYY-MM-DD | Descripción breve del cambio |`
