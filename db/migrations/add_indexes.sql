-- =============================================================================
-- OmniCitas — Index Migration
-- Adds production-grade indexes across all 4 service databases.
--
-- USAGE (existing running DB — zero downtime):
--   psql -d omnicitas_auth        -f add_indexes.sql
--   psql -d omnicitas_users       -f add_indexes.sql
--   psql -d omnicitas_medical     -f add_indexes.sql
--   psql -d omnicitas_appointments -f add_indexes.sql
--
-- CONCURRENTLY: builds index without holding a table lock.
-- IF NOT EXISTS: safe to re-run without errors.
-- =============================================================================


-- =============================================================================
-- DATABASE: omnicitas_auth  (auth-service)
-- =============================================================================

-- Login path: afiliado authenticates with document type + number every login.
-- Composite covers the two-column equality predicate in find_by_documento().
CREATE INDEX CONCURRENTLY IF NOT EXISTS ix_user_creds_tipo_numero
    ON user_credentials (tipo_documento, numero_documento);

-- Soft-delete filter: skip inactive credentials on any listing query.
CREATE INDEX CONCURRENTLY IF NOT EXISTS ix_user_creds_activo
    ON user_credentials (activo);

-- NOTE: unique indexes on (numero_documento) and (correo) are already
-- created implicitly by the UNIQUE constraints — no action needed.

-- NOTE: revoked_tokens already has ix_revoked_tokens_jti and
-- ix_revoked_tokens_expires_at — no action needed.


-- =============================================================================
-- DATABASE: omnicitas_users  (user-service)
-- =============================================================================

-- Admin listing: most queries filter on (tipo, estado) together.
CREATE INDEX CONCURRENTLY IF NOT EXISTS ix_afiliados_tipo_estado
    ON afiliados (tipo, estado);

-- Beneficiary tree: fetch all dependents of a cotizante in a single index scan.
CREATE INDEX CONCURRENTLY IF NOT EXISTS ix_afiliados_cotizante_id
    ON afiliados (cotizante_id);

-- Alphabetical pagination: admin list always orders by apellidos.
CREATE INDEX CONCURRENTLY IF NOT EXISTS ix_afiliados_apellidos
    ON afiliados (apellidos);

-- NOTE: unique index on (numero_documento) already created by UNIQUE constraint.


-- =============================================================================
-- DATABASE: omnicitas_medical  (medical-service)
-- =============================================================================

-- ── especialidades ──────────────────────────────────────────────────────────
-- Catalog endpoint: only active specialties are returned to the frontend.
CREATE INDEX CONCURRENTLY IF NOT EXISTS ix_especialidades_activa
    ON especialidades (activa);

-- ── sedes ────────────────────────────────────────────────────────────────────
-- Catalog endpoint: only active sedes are returned.
CREATE INDEX CONCURRENTLY IF NOT EXISTS ix_sedes_activa
    ON sedes (activa);

-- ── medicos ──────────────────────────────────────────────────────────────────
-- Availability flow: filter doctors by specialty + active (per request on step 2).
CREATE INDEX CONCURRENTLY IF NOT EXISTS ix_medicos_especialidad_activo
    ON medicos (especialidad_id, activo);

-- Alphabetical listing: admin view orders by apellidos.
CREATE INDEX CONCURRENTLY IF NOT EXISTS ix_medicos_apellidos
    ON medicos (apellidos);

-- ── jornadas_medico ──────────────────────────────────────────────────────────
-- Slot generation: fetch all shifts for a doctor (runs on every "Generar" call).
CREATE INDEX CONCURRENTLY IF NOT EXISTS ix_jornadas_medico_id
    ON jornadas_medico (medico_id);

-- Schedule lookup: used by SlotService to match doctor shifts for a weekday.
CREATE INDEX CONCURRENTLY IF NOT EXISTS ix_jornadas_medico_dia
    ON jornadas_medico (medico_id, dia_semana);

-- ── horarios ─────────────────────────────────────────────────────────────────
-- THE HOTTEST QUERY: availability check, SELECT FOR UPDATE on booking saga.
-- Covers: WHERE medico_id = ? AND fecha = ? AND estado = 'disponible'
-- Also used by the pessimistic-lock path (SELECT FOR UPDATE filters by id
-- after this index narrows the candidate set).
CREATE INDEX CONCURRENTLY IF NOT EXISTS ix_horarios_medico_fecha_estado
    ON horarios (medico_id, fecha, estado);

-- Admin date-range listing: slots across a window (Desde → Hasta).
CREATE INDEX CONCURRENTLY IF NOT EXISTS ix_horarios_fecha_estado
    ON horarios (fecha, estado);

-- Sede-based reporting: list slots per sede over a date range.
CREATE INDEX CONCURRENTLY IF NOT EXISTS ix_horarios_sede_fecha
    ON horarios (sede_id, fecha);


-- =============================================================================
-- DATABASE: omnicitas_appointments  (appointment-service)
-- =============================================================================

-- HOTTEST: active appointments for a user — fired on every user session load
-- and every "mis-citas" refresh.  Covers both equality predicates.
CREATE INDEX CONCURRENTLY IF NOT EXISTS ix_citas_afiliado_estado
    ON citas (afiliado_id, estado);

-- User history view: all appointments ordered by date desc (historial endpoint).
-- Leftmost equality on afiliado_id + range/sort on fecha.
CREATE INDEX CONCURRENTLY IF NOT EXISTS ix_citas_afiliado_fecha
    ON citas (afiliado_id, fecha);

-- Duplicate-specialty guard: check for an active booking in same specialty.
-- Used by existe_cita_activa_para_especialidad() on every new booking attempt.
CREATE INDEX CONCURRENTLY IF NOT EXISTS ix_citas_especialidad_estado
    ON citas (especialidad_id, estado);

-- Admin dashboard: filter appointments by doctor + date range.
CREATE INDEX CONCURRENTLY IF NOT EXISTS ix_citas_medico_fecha
    ON citas (medico_id, fecha);

-- Admin status board: appointments grouped/filtered by status + date window.
CREATE INDEX CONCURRENTLY IF NOT EXISTS ix_citas_estado_fecha
    ON citas (estado, fecha);

-- Idempotency / saga compensation: lookup by slot reference (horario_id).
-- Prevents double-booking at the application layer if saga retries.
CREATE INDEX CONCURRENTLY IF NOT EXISTS ix_citas_horario_id
    ON citas (horario_id);


-- =============================================================================
-- VERIFICATION — run after migration to confirm all indexes exist
-- =============================================================================
-- SELECT schemaname, tablename, indexname, indexdef
-- FROM pg_indexes
-- WHERE schemaname = 'public'
--   AND indexname LIKE 'ix_%'
-- ORDER BY tablename, indexname;
