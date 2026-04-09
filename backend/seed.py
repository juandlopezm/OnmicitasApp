"""
Pobla la base de datos con datos iniciales para OmniCitas.

Uso:
    python seed.py

Crea:
  - 1 administrador
  - 4 especialidades
  - 4 sedes
  - 6 médicos con jornadas lunes-viernes 08:00–17:00
  - 3 cotizantes con sus beneficiarios
  - Días no hábiles 2026
  - Horarios para las próximas 2 semanas
"""

from dotenv import load_dotenv
load_dotenv()

from datetime import date, time, timedelta
from app import create_app
from app.extensions import db
from app.models import (
    AdminUsuario, Especialidad, Sede, Medico, JornadaMedico,
    Afiliado, DiaNoHabil,
)
from app.services.horario_service import generar_horarios_medico

app = create_app()

with app.app_context():
    db.drop_all()
    db.create_all()

    # ── Admin ──────────────────────────────────────────────────────────────────
    admin = AdminUsuario(nombre="Administrador OmniCitas", email="admin@omnicitas.com")
    admin.set_password("admin123")
    db.session.add(admin)

    # ── Especialidades ─────────────────────────────────────────────────────────
    especialidades_data = [
        ("Medicina General",  "Atención primaria y consulta general",          30),
        ("Cardiología",       "Enfermedades del corazón y sistema circulatorio", 45),
        ("Pediatría",         "Atención médica a niños y adolescentes",         45),
        ("Dermatología",      "Enfermedades de la piel, cabello y uñas",        45),
    ]
    especialidades = []
    for nombre, desc, duracion in especialidades_data:
        e = Especialidad(nombre=nombre, descripcion=desc, duracion_minutos=duracion)
        db.session.add(e)
        especialidades.append(e)

    # ── Sedes ──────────────────────────────────────────────────────────────────
    sedes_data = [
        ("Sede Centro",     "Cra 7 # 32-16, Bogotá"),
        ("Sede Norte",      "Av. 19 # 127-50, Bogotá"),
        ("Sede Sur",        "Calle 40 Sur # 22-18, Bogotá"),
        ("Sede Occidente",  "Cra 86 # 90-12, Bogotá"),
    ]
    sedes = []
    for nombre, direccion in sedes_data:
        s = Sede(nombre=nombre, direccion=direccion)
        db.session.add(s)
        sedes.append(s)

    db.session.flush()  # obtener IDs

    # ── Médicos ────────────────────────────────────────────────────────────────
    medicos_data = [
        ("Dr. Juan Martínez",    0, 0),  # esp_idx, sede_idx
        ("Dra. Laura Sánchez",   0, 1),
        ("Dr. Roberto Díaz",     1, 0),
        ("Dra. María Torres",    1, 2),
        ("Dr. Felipe Ruiz",      2, 0),
        ("Dra. Claudia Mora",    3, 3),
    ]
    medicos = []
    for nombre, esp_idx, sede_idx in medicos_data:
        m = Medico(
            nombre=nombre,
            especialidad_id=especialidades[esp_idx].id,
            sede_id=sedes[sede_idx].id,
        )
        db.session.add(m)
        medicos.append(m)

    db.session.flush()

    # Jornadas lunes-viernes 08:00-12:00 y 14:00-17:00
    for medico in medicos:
        for dia in range(5):  # 0=Lunes … 4=Viernes
            db.session.add(JornadaMedico(
                medico_id=medico.id,
                dia_semana=dia,
                hora_inicio=time(8, 0),
                hora_fin=time(12, 0),
            ))
            db.session.add(JornadaMedico(
                medico_id=medico.id,
                dia_semana=dia,
                hora_inicio=time(14, 0),
                hora_fin=time(17, 0),
            ))

    # ── Afiliados ──────────────────────────────────────────────────────────────
    # Cotizante 1 con cuenta activa
    c1 = Afiliado(
        tipo_documento="CC",
        numero_documento="1234567890",
        nombres="Carlos",
        apellidos="Pérez",
        genero="M",
        fecha_nacimiento=date(1985, 6, 15),
        telefono="3001234567",
        correo="demo@omnicitas.com",
        departamento="Cundinamarca",
        ciudad="Bogotá",
        ips_medica="IPS Centro",
        tipo="cotizante",
        estado="activo",
    )
    c1.set_password("demo123")
    db.session.add(c1)

    # Cotizante 2
    c2 = Afiliado(
        tipo_documento="CC",
        numero_documento="9876543210",
        nombres="Ana",
        apellidos="Gómez",
        genero="F",
        fecha_nacimiento=date(1990, 3, 22),
        telefono="3109876543",
        correo="ana@omnicitas.com",
        departamento="Cundinamarca",
        ciudad="Bogotá",
        ips_medica="IPS Norte",
        tipo="cotizante",
        estado="activo",
    )
    c2.set_password("ana123")
    db.session.add(c2)

    # Cotizante 3 (sin cuenta — debe registrarse)
    c3 = Afiliado(
        tipo_documento="CC",
        numero_documento="1122334455",
        nombres="Luis",
        apellidos="Rodríguez",
        genero="M",
        fecha_nacimiento=date(1978, 11, 5),
        telefono="3201122334",
        departamento="Antioquia",
        ciudad="Medellín",
        ips_medica="IPS Sur",
        tipo="cotizante",
        estado="activo",
    )
    db.session.add(c3)
    db.session.flush()

    # Beneficiarios de Carlos Pérez
    db.session.add(Afiliado(
        tipo_documento="TI",
        numero_documento="1001234001",
        nombres="Sofía",
        apellidos="Pérez",
        genero="F",
        fecha_nacimiento=date(2010, 4, 10),
        tipo="beneficiario",
        cotizante_id=c1.id,
        estado="activo",
        ips_medica="IPS Centro",
        departamento="Cundinamarca",
        ciudad="Bogotá",
    ))
    db.session.add(Afiliado(
        tipo_documento="CC",
        numero_documento="5556667770",
        nombres="María",
        apellidos="López",
        genero="F",
        fecha_nacimiento=date(1987, 9, 18),  # cónyuge
        tipo="beneficiario",
        cotizante_id=c1.id,
        estado="activo",
        ips_medica="IPS Centro",
        departamento="Cundinamarca",
        ciudad="Bogotá",
    ))

    # Beneficiario mayor de 24 años (debe quedar inactivo automáticamente)
    db.session.add(Afiliado(
        tipo_documento="CC",
        numero_documento="1001111000",
        nombres="Pedro",
        apellidos="Pérez",
        genero="M",
        fecha_nacimiento=date(1999, 1, 1),  # > 24 años
        tipo="beneficiario",
        cotizante_id=c1.id,
        estado="activo",
        ips_medica="IPS Centro",
        departamento="Cundinamarca",
        ciudad="Bogotá",
    ))

    # ── Días no hábiles 2026 (Colombia) ────────────────────────────────────────
    feriados_2026 = [
        (date(2026, 1, 1),  "Año Nuevo"),
        (date(2026, 1, 12), "Día de los Reyes Magos"),
        (date(2026, 3, 23), "Día de San José"),
        (date(2026, 4, 2),  "Jueves Santo"),
        (date(2026, 4, 3),  "Viernes Santo"),
        (date(2026, 5, 1),  "Día del Trabajo"),
        (date(2026, 5, 18), "Ascensión del Señor"),
        (date(2026, 6, 8),  "Corpus Christi"),
        (date(2026, 6, 15), "Sagrado Corazón"),
        (date(2026, 6, 29), "San Pedro y San Pablo"),
        (date(2026, 7, 20), "Día de la Independencia"),
        (date(2026, 8, 7),  "Batalla de Boyacá"),
        (date(2026, 8, 17), "Asunción de la Virgen"),
        (date(2026, 10, 12),"Día de la Raza"),
        (date(2026, 11, 2), "Todos los Santos"),
        (date(2026, 11, 16),"Independencia de Cartagena"),
        (date(2026, 12, 8), "Inmaculada Concepción"),
        (date(2026, 12, 25),"Navidad"),
    ]
    for fecha, desc in feriados_2026:
        db.session.add(DiaNoHabil(fecha=fecha, descripcion=desc))

    db.session.commit()

    # ── Generar horarios (próximas 2 semanas) ──────────────────────────────────
    hoy = date.today()
    fecha_inicio = hoy + timedelta(days=1)
    fecha_fin = hoy + timedelta(days=14)

    print("Generando horarios...")
    for medico in medicos:
        res = generar_horarios_medico(medico.id, fecha_inicio, fecha_fin)
        print(f"  {medico.nombre}: {res['creados']} slots creados")

    print("\n✓ Seed completado exitosamente")
    print("\nCredenciales:")
    print("  Admin:      admin@omnicitas.com  /  admin123")
    print("  Afiliado 1: demo@omnicitas.com   /  demo123")
    print("  Afiliado 2: ana@omnicitas.com    /  ana123")
    print("  Afiliado 3: doc CC 1122334455 (sin cuenta — usar /api/auth/register)")
