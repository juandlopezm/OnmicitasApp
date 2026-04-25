"""
seed.py — Populates all 4 OmniCitas databases.

Usage:
    docker compose --profile seed run --rm seed

Databases seeded:
    db-auth        → admin_usuarios + user_credentials (demo afiliado logins)
    db-users       → afiliados (cotizantes + beneficiarios)
    db-medical     → especialidades, sedes, medicos, jornadas, horarios, dias_no_habiles
    db-appointments → (empty table — filled via API)
"""

import os
import sys
from datetime import date, time, timedelta, datetime, timezone
from sqlalchemy import create_engine, Column, Integer, String, Boolean, Date, DateTime, Time, ForeignKey, Enum
from sqlalchemy.orm import sessionmaker, DeclarativeBase
from werkzeug.security import generate_password_hash


# ── Connection URLs ────────────────────────────────────────────────────────────
DB_AUTH  = os.environ.get("DB_AUTH_URL",         "postgresql://omnicitas:omnicitas123@db-auth:5432/omnicitas_auth")
DB_USERS = os.environ.get("DB_USERS_URL",        "postgresql://omnicitas:omnicitas123@db-users:5432/omnicitas_users")
DB_MED   = os.environ.get("DB_MEDICAL_URL",      "postgresql://omnicitas:omnicitas123@db-medical:5432/omnicitas_medical")
DB_APPT  = os.environ.get("DB_APPOINTMENTS_URL", "postgresql://omnicitas:omnicitas123@db-appointments:5432/omnicitas_appointments")


def make_engine(url):
    return create_engine(url, pool_pre_ping=True)


# ══════════════════════════════════════════════════════════════════════════════
# db-auth models
# ══════════════════════════════════════════════════════════════════════════════
class AuthBase(DeclarativeBase):
    pass


class AdminUsuario(AuthBase):
    __tablename__ = "admin_usuarios"
    id           = Column(Integer, primary_key=True, autoincrement=True)
    nombre       = Column(String(120), nullable=False)
    email        = Column(String(120), nullable=False, unique=True)
    password_hash= Column(String(256), nullable=False)
    creado_en    = Column(DateTime, default=lambda: datetime.now(timezone.utc))

    def set_password(self, pw):
        self.password_hash = generate_password_hash(pw)


class UserCredential(AuthBase):
    __tablename__ = "user_credentials"
    id               = Column(Integer, primary_key=True, autoincrement=True)
    tipo_documento   = Column(Enum("CC", "TI", "PA", "CE", name="tipo_documento_enum"), nullable=False)
    numero_documento = Column(String(20), nullable=False, unique=True)
    correo           = Column(String(120), unique=True, nullable=True)
    password_hash    = Column(String(256), nullable=False)
    role             = Column(Enum("afiliado", name="role_enum"), nullable=False, default="afiliado")
    user_id          = Column(Integer)
    activo           = Column(Boolean, default=True)
    creado_en        = Column(DateTime, default=lambda: datetime.now(timezone.utc))

    def set_password(self, pw):
        self.password_hash = generate_password_hash(pw)


class RevokedToken(AuthBase):
    __tablename__ = "revoked_tokens"
    id         = Column(Integer, primary_key=True, autoincrement=True)
    jti        = Column(String(36), nullable=False, unique=True)
    user_id    = Column(Integer, nullable=True)
    revoked_at = Column(DateTime, default=lambda: datetime.now(timezone.utc))
    expires_at = Column(DateTime, nullable=False)


# ══════════════════════════════════════════════════════════════════════════════
# db-users models
# ══════════════════════════════════════════════════════════════════════════════
class UsersBase(DeclarativeBase):
    pass


class Afiliado(UsersBase):
    __tablename__    = "afiliados"
    id               = Column(Integer, primary_key=True, autoincrement=True)
    tipo_documento   = Column(String(10), nullable=False)
    numero_documento = Column(String(20), nullable=False, unique=True)
    nombres          = Column(String(100), nullable=False)
    apellidos        = Column(String(100), nullable=False)
    genero           = Column(String(1))
    fecha_nacimiento = Column(Date)
    telefono         = Column(String(20))
    departamento     = Column(String(60))
    ciudad           = Column(String(60))
    ips_medica       = Column(String(120))
    tipo             = Column(String(20), nullable=False, default="cotizante")
    cotizante_id     = Column(Integer, ForeignKey("afiliados.id"), nullable=True)
    estado           = Column(String(20), nullable=False, default="activo")
    creado_en        = Column(DateTime, default=lambda: datetime.now(timezone.utc))
    actualizado_en   = Column(DateTime, default=lambda: datetime.now(timezone.utc))


# ══════════════════════════════════════════════════════════════════════════════
# db-medical models
# ══════════════════════════════════════════════════════════════════════════════
class MedBase(DeclarativeBase):
    pass


class Especialidad(MedBase):
    __tablename__ = "especialidades"
    id            = Column(Integer, primary_key=True, autoincrement=True)
    nombre        = Column(String(100), nullable=False, unique=True)
    descripcion   = Column(String(255))
    activa        = Column(Boolean, default=True)
    duracion_min  = Column(Integer, nullable=False, default=30)
    modalidad     = Column(String(20), nullable=False, default="presencial")


class Sede(MedBase):
    __tablename__  = "sedes"
    id             = Column(Integer, primary_key=True, autoincrement=True)
    nombre         = Column(String(100), nullable=False)
    ciudad         = Column(String(60))
    direccion      = Column(String(150))
    activa         = Column(Boolean, default=True)
    hora_apertura  = Column(Time, nullable=True)
    hora_cierre    = Column(Time, nullable=True)


class Medico(MedBase):
    __tablename__       = "medicos"
    id                  = Column(Integer, primary_key=True, autoincrement=True)
    nombres             = Column(String(100), nullable=False)
    apellidos           = Column(String(100), nullable=False)
    registro_medico     = Column(String(30), unique=True)
    especialidad_id     = Column(Integer, ForeignKey("especialidades.id"), nullable=False)
    especialidad_nombre = Column(String(100))
    activo              = Column(Boolean, default=True)


class JornadaMedico(MedBase):
    __tablename__     = "jornadas_medico"
    id                = Column(Integer, primary_key=True, autoincrement=True)
    medico_id         = Column(Integer, ForeignKey("medicos.id"), nullable=False)
    sede_id           = Column(Integer, nullable=False)
    dia_semana        = Column(Integer, nullable=False)
    hora_inicio       = Column(Time, nullable=False)
    hora_fin          = Column(Time, nullable=False)
    duracion_cita_min = Column(Integer, nullable=False, default=30)


class Horario(MedBase):
    __tablename__ = "horarios"
    id            = Column(Integer, primary_key=True, autoincrement=True)
    medico_id     = Column(Integer, ForeignKey("medicos.id"), nullable=False)
    sede_id       = Column(Integer, nullable=False)
    fecha         = Column(Date, nullable=False)
    hora_inicio   = Column(Time, nullable=False)
    hora_fin      = Column(Time, nullable=False)
    estado        = Column(String(20), nullable=False, default="disponible")
    creado_en     = Column(DateTime, default=lambda: datetime.now(timezone.utc))


class DiaNoHabil(MedBase):
    __tablename__ = "dias_no_habiles"
    id            = Column(Integer, primary_key=True, autoincrement=True)
    fecha         = Column(Date, nullable=False, unique=True)
    descripcion   = Column(String(100))


# ══════════════════════════════════════════════════════════════════════════════
# db-appointments models
# ══════════════════════════════════════════════════════════════════════════════
class ApptBase(DeclarativeBase):
    pass


class Cita(ApptBase):
    __tablename__       = "citas"
    id                  = Column(Integer, primary_key=True, autoincrement=True)
    afiliado_id         = Column(Integer, nullable=False)
    beneficiario_id     = Column(Integer, nullable=True)
    medico_id           = Column(Integer, nullable=False)
    especialidad_id     = Column(Integer, nullable=False)
    sede_id             = Column(Integer, nullable=False)
    horario_id          = Column(Integer, nullable=False)
    paciente_nombre     = Column(String(200))
    medico_nombre       = Column(String(200))
    especialidad_nombre = Column(String(100))
    sede_nombre         = Column(String(100))
    fecha               = Column(Date, nullable=False)
    hora_inicio         = Column(Time, nullable=False)
    hora_fin            = Column(Time, nullable=False)
    estado              = Column(String(20), nullable=False, default="pendiente")
    canal               = Column(String(20), default="web")
    notas               = Column(String(500))
    creado_en           = Column(DateTime, default=lambda: datetime.now(timezone.utc))
    actualizado_en      = Column(DateTime, default=lambda: datetime.now(timezone.utc))


# ══════════════════════════════════════════════════════════════════════════════
# Seed functions
# ══════════════════════════════════════════════════════════════════════════════

def seed_auth(engine):
    print("→ Seeding db-auth...")
    AuthBase.metadata.create_all(bind=engine)
    db = sessionmaker(bind=engine)()
    try:
        if not db.query(AdminUsuario).filter_by(email="admin@omnicitas.com").first():
            a = AdminUsuario(nombre="Administrador", email="admin@omnicitas.com")
            a.set_password("admin123")
            db.add(a)

        for doc, correo, uid in [
            ("1234567890", "juan.perez@demo.com", 1),
            ("9876543210", "maria.gomez@demo.com", 2),
        ]:
            if not db.query(UserCredential).filter_by(numero_documento=doc).first():
                c = UserCredential(
                    tipo_documento="CC", numero_documento=doc,
                    correo=correo, role="afiliado", user_id=uid, activo=True,
                )
                c.set_password("demo123")
                db.add(c)
        db.commit()
        print("  ✓ 1 admin + 2 credenciales afiliado")
    finally:
        db.close()


def seed_users(engine):
    print("→ Seeding db-users...")
    UsersBase.metadata.create_all(bind=engine)
    db = sessionmaker(bind=engine)()
    try:
        cotizantes = [
            ("CC", "1234567890", "Juan Carlos", "Pérez López",   "M", date(1985, 3, 15), "3001234567", "Cundinamarca", "Bogotá",   "IPS Norte"),
            ("CC", "9876543210", "María Elena", "Gómez Ruiz",    "F", date(1990, 7, 22), "3109876543", "Antioquia",   "Medellín", "IPS Sur"),
        ]
        for tipo, num, nom, ape, gen, fn, tel, dep, ciu, ips in cotizantes:
            if not db.query(Afiliado).filter_by(numero_documento=num).first():
                db.add(Afiliado(
                    tipo_documento=tipo, numero_documento=num,
                    nombres=nom, apellidos=ape, genero=gen, fecha_nacimiento=fn,
                    telefono=tel, departamento=dep, ciudad=ciu, ips_medica=ips,
                    tipo="cotizante", estado="activo",
                ))
        db.flush()

        cotizante = db.query(Afiliado).filter_by(numero_documento="1234567890").first()
        if cotizante and not db.query(Afiliado).filter_by(numero_documento="1111111111").first():
            db.add(Afiliado(
                tipo_documento="TI", numero_documento="1111111111",
                nombres="Carlos Andrés", apellidos="Pérez Soto",
                genero="M", fecha_nacimiento=date(2010, 1, 10),
                tipo="beneficiario", cotizante_id=cotizante.id, estado="activo",
            ))
        db.commit()
        print("  ✓ 2 cotizantes + 1 beneficiario")
    finally:
        db.close()


def seed_medical(engine):
    print("→ Seeding db-medical...")
    MedBase.metadata.create_all(bind=engine)
    db = sessionmaker(bind=engine)()
    try:
        esp_data = [
            ("Medicina General", "Consulta médica general",                      30, "presencial"),
            ("Cardiología",      "Especialidad del corazón y sistema circulatorio", 45, "presencial"),
            ("Pediatría",        "Atención médica a niños",                      30, "presencial"),
            ("Ginecología",      "Salud femenina",                               30, "presencial"),
        ]
        esp_map = {}
        for nombre, desc, dur, mod in esp_data:
            e = db.query(Especialidad).filter_by(nombre=nombre).first()
            if not e:
                e = Especialidad(nombre=nombre, descripcion=desc, activa=True,
                                 duracion_min=dur, modalidad=mod)
                db.add(e)
                db.flush()
            esp_map[nombre] = e.id

        sede_data = [
            ("Sede Norte",    "Bogotá",    "Av. 19 # 127-65",        time(7, 0), time(18, 0)),
            ("Sede Sur",      "Bogotá",    "Calle 40 Sur # 78-12",   time(7, 0), time(18, 0)),
            ("Sede Medellín", "Medellín",  "Carrera 43A # 18-20",    time(8, 0), time(17, 0)),
        ]
        sede_ids = []
        for nombre, ciudad, direccion, apertura, cierre in sede_data:
            s = db.query(Sede).filter_by(nombre=nombre).first()
            if not s:
                s = Sede(nombre=nombre, ciudad=ciudad, direccion=direccion, activa=True,
                         hora_apertura=apertura, hora_cierre=cierre)
                db.add(s)
                db.flush()
            sede_ids.append(s.id)

        med_data = [
            ("Luis",  "Martínez García", "RM-001", "Medicina General"),
            ("Ana",   "Rodríguez Mora",  "RM-002", "Cardiología"),
            ("Pedro", "Suárez Vega",     "RM-003", "Pediatría"),
            ("Laura", "Torres Niño",     "RM-004", "Ginecología"),
        ]
        med_ids = []
        for nom, ape, rm, esp in med_data:
            m = db.query(Medico).filter_by(registro_medico=rm).first()
            if not m:
                m = Medico(nombres=nom, apellidos=ape, registro_medico=rm,
                           especialidad_id=esp_map[esp], especialidad_nombre=esp, activo=True)
                db.add(m)
                db.flush()
            med_ids.append(m.id)

        db.commit()

        # Jornadas: Mon-Fri 08-16, 30min slots
        for i, mid in enumerate(med_ids):
            sid = sede_ids[i % len(sede_ids)]
            for dia in range(5):
                if not db.query(JornadaMedico).filter_by(medico_id=mid, dia_semana=dia).first():
                    db.add(JornadaMedico(medico_id=mid, sede_id=sid, dia_semana=dia,
                                         hora_inicio=time(8, 0), hora_fin=time(16, 0),
                                         duracion_cita_min=30))
        db.commit()

        # Generate slots for next 30 days
        today = date.today()
        for delta in range(1, 31):
            fecha = today + timedelta(days=delta)
            if fecha.weekday() >= 5:
                continue
            for mid in med_ids:
                jornadas = db.query(JornadaMedico).filter_by(medico_id=mid, dia_semana=fecha.weekday()).all()
                for j in jornadas:
                    cur = datetime.combine(fecha, j.hora_inicio)
                    fin = datetime.combine(fecha, j.hora_fin)
                    dur = timedelta(minutes=j.duracion_cita_min)
                    while cur + dur <= fin:
                        slot_fin = cur + dur
                        if not db.query(Horario).filter_by(medico_id=mid, fecha=fecha, hora_inicio=cur.time()).first():
                            db.add(Horario(medico_id=mid, sede_id=j.sede_id, fecha=fecha,
                                           hora_inicio=cur.time(), hora_fin=slot_fin.time(), estado="disponible"))
                        cur = slot_fin
        db.commit()

        festivo = today + timedelta(days=10)
        if not db.query(DiaNoHabil).filter_by(fecha=festivo).first():
            db.add(DiaNoHabil(fecha=festivo, descripcion="Festivo demo"))
            db.commit()

        print("  ✓ 4 especialidades, 3 sedes, 4 médicos, jornadas, horarios 30 días")
    finally:
        db.close()


def seed_appointments(engine):
    print("→ Seeding db-appointments...")
    ApptBase.metadata.create_all(bind=engine)
    print("  ✓ tabla citas lista (vacía — se llena por API)")


# ══════════════════════════════════════════════════════════════════════════════
# Entry point
# ══════════════════════════════════════════════════════════════════════════════
if __name__ == "__main__":
    print("OmniCitas — Seed (4 databases)")
    print("=" * 45)
    try:
        seed_auth(make_engine(DB_AUTH))
        seed_users(make_engine(DB_USERS))
        seed_medical(make_engine(DB_MED))
        seed_appointments(make_engine(DB_APPT))
        print("=" * 45)
        print("✓ Seed completado")
        print()
        print("Demo credentials:")
        print("  Admin:    admin@omnicitas.com  /  admin123")
        print("  Afiliado: CC 1234567890  /  demo123")
        print("  Afiliado: CC 9876543210  /  demo123")
    except Exception as exc:
        print(f"✗ Error: {exc}", file=sys.stderr)
        sys.exit(1)
