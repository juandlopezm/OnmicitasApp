"""
Gestión de afiliados (admin + perfil propio).

Admin:
  GET    /api/admin/afiliados                         → lista con filtros
  GET    /api/admin/afiliados/<id>
  POST   /api/admin/afiliados                         → crear cotizante o beneficiario
  PUT    /api/admin/afiliados/<id>
  PUT    /api/admin/afiliados/<id>/estado             → cambiar estado
  PUT    /api/admin/afiliados/<id>/promover           → beneficiario → cotizante
  GET    /api/admin/afiliados/<id>/beneficiarios      → beneficiarios de un cotizante
  POST   /api/admin/afiliados/<id>/beneficiarios      → añadir beneficiario

Afiliado (perfil propio):
  GET    /api/afiliados/me/beneficiarios              → mis beneficiarios
"""

from flask import Blueprint, request, jsonify
from flask_jwt_extended import get_jwt_identity
from app.extensions import db
from app.models.afiliado import Afiliado
from app.utils.decorators import admin_required, afiliado_required
from datetime import date

afiliados_bp = Blueprint("afiliados", __name__)

TIPOS_DOC = ("CC", "TI", "PA", "CE")
GENEROS = ("M", "F", "O")
ESTADOS = ("activo", "inactivo", "suspendido")


def _validar_campos_obligatorios(data: dict) -> str | None:
    requeridos = ["tipo_documento", "numero_documento", "nombres", "apellidos",
                  "genero", "fecha_nacimiento"]
    for campo in requeridos:
        if not data.get(campo):
            return f"El campo '{campo}' es requerido"
    if data["tipo_documento"] not in TIPOS_DOC:
        return f"tipo_documento debe ser uno de: {TIPOS_DOC}"
    if data["genero"] not in GENEROS:
        return f"genero debe ser uno de: {GENEROS}"
    try:
        date.fromisoformat(data["fecha_nacimiento"])
    except ValueError:
        return "fecha_nacimiento debe ser YYYY-MM-DD"
    return None


# ── Rutas admin ────────────────────────────────────────────────────────────────

@afiliados_bp.get("/api/admin/afiliados")
@admin_required
def listar():
    """
    Listar afiliados (admin)
    ---
    tags:
      - Afiliados
    security:
      - Bearer: []
    parameters:
      - name: tipo
        in: query
        type: string
        enum: [cotizante, beneficiario]
      - name: estado
        in: query
        type: string
        enum: [activo, inactivo, suspendido]
      - name: q
        in: query
        type: string
        description: Búsqueda por nombre, documento o correo
    responses:
      200:
        description: Lista de afiliados
        schema:
          type: array
          items:
            $ref: '#/definitions/Afiliado'
    """
    query = Afiliado.query

    tipo = request.args.get("tipo")
    estado = request.args.get("estado")
    buscar = request.args.get("q", "").strip()

    if tipo:
        query = query.filter_by(tipo=tipo)
    if estado:
        query = query.filter_by(estado=estado)
    if buscar:
        like = f"%{buscar}%"
        query = query.filter(
            db.or_(
                Afiliado.nombres.ilike(like),
                Afiliado.apellidos.ilike(like),
                Afiliado.numero_documento.ilike(like),
                Afiliado.correo.ilike(like),
            )
        )

    afiliados = query.order_by(Afiliado.apellidos, Afiliado.nombres).all()

    cambios = False
    for a in afiliados:
        if a.verificar_inactivacion_por_edad():
            cambios = True
    if cambios:
        db.session.commit()

    return jsonify([a.to_dict() for a in afiliados]), 200


@afiliados_bp.get("/api/admin/afiliados/<int:afiliado_id>")
@admin_required
def obtener(afiliado_id):
    """
    Obtener afiliado por ID (admin)
    ---
    tags:
      - Afiliados
    security:
      - Bearer: []
    parameters:
      - name: afiliado_id
        in: path
        type: integer
        required: true
    responses:
      200:
        description: Afiliado encontrado
        schema:
          $ref: '#/definitions/Afiliado'
      404:
        description: No encontrado
    """
    a = Afiliado.query.get_or_404(afiliado_id)
    a.verificar_inactivacion_por_edad()
    db.session.commit()
    return jsonify(a.to_dict(include_beneficiarios=(a.tipo == "cotizante"))), 200


@afiliados_bp.post("/api/admin/afiliados")
@admin_required
def crear():
    """
    Crear afiliado (admin)
    ---
    tags:
      - Afiliados
    security:
      - Bearer: []
    parameters:
      - in: body
        name: body
        required: true
        schema:
          type: object
          required: [tipo_documento, numero_documento, nombres, apellidos, genero, fecha_nacimiento]
          properties:
            tipo_documento:
              type: string
              enum: [CC, TI, PA, CE]
            numero_documento:
              type: string
            nombres:
              type: string
            apellidos:
              type: string
            genero:
              type: string
              enum: [M, F, O]
            fecha_nacimiento:
              type: string
              format: date
            telefono:
              type: string
            correo:
              type: string
              format: email
            departamento:
              type: string
            ciudad:
              type: string
            ips_medica:
              type: string
            tipo:
              type: string
              enum: [cotizante, beneficiario]
              default: cotizante
            cotizante_id:
              type: integer
              description: Requerido si tipo=beneficiario
            estado:
              type: string
              enum: [activo, inactivo, suspendido]
              default: activo
    responses:
      201:
        description: Afiliado creado
        schema:
          $ref: '#/definitions/Afiliado'
      400:
        description: Campos inválidos
      409:
        description: Documento duplicado
    """
    data = request.get_json(silent=True) or {}
    error = _validar_campos_obligatorios(data)
    if error:
        return jsonify({"error": error}), 400

    if Afiliado.query.filter_by(numero_documento=data["numero_documento"]).first():
        return jsonify({"error": "Ya existe un afiliado con ese número de documento"}), 409

    correo_nuevo = (data.get("correo") or "").strip().lower() or None
    if correo_nuevo and Afiliado.query.filter_by(correo=correo_nuevo).first():
        return jsonify({"error": "Ya existe un afiliado con ese correo electrónico"}), 409

    tipo = data.get("tipo", "cotizante")
    cotizante_id = data.get("cotizante_id")

    if tipo == "beneficiario":
        if not cotizante_id:
            return jsonify({"error": "cotizante_id es requerido para beneficiarios"}), 400
        cotizante = Afiliado.query.get(cotizante_id)
        if not cotizante or cotizante.tipo != "cotizante":
            return jsonify({"error": "cotizante_id no válido"}), 400

    afiliado = Afiliado(
        tipo_documento=data["tipo_documento"],
        numero_documento=data["numero_documento"],
        nombres=data["nombres"].strip(),
        apellidos=data["apellidos"].strip(),
        genero=data["genero"],
        fecha_nacimiento=date.fromisoformat(data["fecha_nacimiento"]),
        telefono=data.get("telefono"),
        correo=correo_nuevo,
        departamento=data.get("departamento"),
        ciudad=data.get("ciudad"),
        ips_medica=data.get("ips_medica"),
        tipo=tipo,
        cotizante_id=cotizante_id,
        estado=data.get("estado", "activo"),
    )
    db.session.add(afiliado)
    db.session.commit()
    return jsonify(afiliado.to_dict()), 201


@afiliados_bp.put("/api/admin/afiliados/<int:afiliado_id>")
@admin_required
def actualizar(afiliado_id):
    """
    Actualizar datos del afiliado (admin)
    ---
    tags:
      - Afiliados
    security:
      - Bearer: []
    parameters:
      - name: afiliado_id
        in: path
        type: integer
        required: true
      - in: body
        name: body
        schema:
          type: object
          properties:
            nombres:
              type: string
            apellidos:
              type: string
            telefono:
              type: string
            correo:
              type: string
            departamento:
              type: string
            ciudad:
              type: string
            ips_medica:
              type: string
            genero:
              type: string
              enum: [M, F, O]
            fecha_nacimiento:
              type: string
              format: date
    responses:
      200:
        description: Afiliado actualizado
        schema:
          $ref: '#/definitions/Afiliado'
      404:
        description: No encontrado
      409:
        description: Correo en uso
    """
    afiliado = Afiliado.query.get_or_404(afiliado_id)
    data = request.get_json(silent=True) or {}

    # Tipo y número de documento (admin puede modificarlos)
    if "tipo_documento" in data:
        if data["tipo_documento"] not in TIPOS_DOC:
            return jsonify({"error": f"tipo_documento debe ser uno de: {TIPOS_DOC}"}), 400
        afiliado.tipo_documento = data["tipo_documento"]

    if "numero_documento" in data:
        nuevo_num = str(data["numero_documento"]).strip()
        if nuevo_num and nuevo_num != afiliado.numero_documento:
            if Afiliado.query.filter_by(numero_documento=nuevo_num).first():
                return jsonify({"error": "Ya existe un afiliado con ese número de documento"}), 409
        afiliado.numero_documento = nuevo_num

    campos_simples = ["nombres", "apellidos", "telefono", "departamento",
                      "ciudad", "ips_medica"]
    for campo in campos_simples:
        if campo in data:
            setattr(afiliado, campo, data[campo])

    if "correo" in data:
        nuevo_correo = data["correo"].strip().lower() or None
        if nuevo_correo and nuevo_correo != afiliado.correo:
            if Afiliado.query.filter_by(correo=nuevo_correo).first():
                return jsonify({"error": "Ese correo ya está en uso"}), 409
        afiliado.correo = nuevo_correo

    if "genero" in data:
        if data["genero"] not in GENEROS:
            return jsonify({"error": f"genero debe ser uno de: {GENEROS}"}), 400
        afiliado.genero = data["genero"]

    if "fecha_nacimiento" in data:
        try:
            afiliado.fecha_nacimiento = date.fromisoformat(data["fecha_nacimiento"])
        except ValueError:
            return jsonify({"error": "fecha_nacimiento debe ser YYYY-MM-DD"}), 400

    if "ips_medica" in data:
        afiliado.ips_medica = data["ips_medica"]

    if "estado" in data:
        if data["estado"] not in ESTADOS:
            return jsonify({"error": f"estado debe ser uno de: {ESTADOS}"}), 400
        afiliado.estado = data["estado"]

    db.session.commit()
    return jsonify(afiliado.to_dict()), 200


@afiliados_bp.put("/api/admin/afiliados/<int:afiliado_id>/estado")
@admin_required
def cambiar_estado(afiliado_id):
    """
    Cambiar estado del afiliado
    ---
    tags:
      - Afiliados
    security:
      - Bearer: []
    parameters:
      - name: afiliado_id
        in: path
        type: integer
        required: true
      - in: body
        name: body
        required: true
        schema:
          type: object
          required: [estado]
          properties:
            estado:
              type: string
              enum: [activo, inactivo, suspendido]
    responses:
      200:
        description: Estado actualizado
        schema:
          $ref: '#/definitions/Afiliado'
      400:
        description: Estado inválido
      404:
        description: No encontrado
    """
    afiliado = Afiliado.query.get_or_404(afiliado_id)
    data = request.get_json(silent=True) or {}
    nuevo_estado = data.get("estado")

    if nuevo_estado not in ESTADOS:
        return jsonify({"error": f"estado debe ser uno de: {ESTADOS}"}), 400

    afiliado.estado = nuevo_estado
    db.session.commit()
    return jsonify(afiliado.to_dict()), 200


@afiliados_bp.put("/api/admin/afiliados/<int:afiliado_id>/promover")
@admin_required
def promover_a_cotizante(afiliado_id):
    """
    Promover beneficiario a cotizante
    ---
    tags:
      - Afiliados
    security:
      - Bearer: []
    parameters:
      - name: afiliado_id
        in: path
        type: integer
        required: true
    responses:
      200:
        description: Beneficiario promovido a cotizante
        schema:
          $ref: '#/definitions/Afiliado'
      404:
        description: No encontrado
      409:
        description: Ya es cotizante
    """
    afiliado = Afiliado.query.get_or_404(afiliado_id)

    if afiliado.tipo == "cotizante":
        return jsonify({"error": "El afiliado ya es cotizante"}), 409

    afiliado.tipo = "cotizante"
    afiliado.cotizante_id = None
    afiliado.estado = "activo"
    db.session.commit()
    return jsonify(afiliado.to_dict()), 200


@afiliados_bp.get("/api/admin/afiliados/<int:afiliado_id>/beneficiarios")
@admin_required
def listar_beneficiarios_admin(afiliado_id):
    """
    Listar beneficiarios de un cotizante (admin)
    ---
    tags:
      - Afiliados
    security:
      - Bearer: []
    parameters:
      - name: afiliado_id
        in: path
        type: integer
        required: true
    responses:
      200:
        description: Lista de beneficiarios
        schema:
          type: array
          items:
            $ref: '#/definitions/Afiliado'
      400:
        description: El afiliado no es cotizante
      404:
        description: No encontrado
    """
    cotizante = Afiliado.query.get_or_404(afiliado_id)
    if cotizante.tipo != "cotizante":
        return jsonify({"error": "El afiliado no es cotizante"}), 400

    bens = list(cotizante.beneficiarios)
    cambios = False
    for b in bens:
        if b.verificar_inactivacion_por_edad():
            cambios = True
    if cambios:
        db.session.commit()

    return jsonify([b.to_dict() for b in bens]), 200


@afiliados_bp.post("/api/admin/afiliados/<int:afiliado_id>/beneficiarios")
@admin_required
def agregar_beneficiario(afiliado_id):
    """
    Agregar beneficiario a un cotizante (admin)
    ---
    tags:
      - Afiliados
    security:
      - Bearer: []
    parameters:
      - name: afiliado_id
        in: path
        type: integer
        required: true
      - in: body
        name: body
        required: true
        schema:
          type: object
          required: [tipo_documento, numero_documento, nombres, apellidos, genero, fecha_nacimiento]
          properties:
            tipo_documento:
              type: string
              enum: [CC, TI, PA, CE]
            numero_documento:
              type: string
            nombres:
              type: string
            apellidos:
              type: string
            genero:
              type: string
              enum: [M, F, O]
            fecha_nacimiento:
              type: string
              format: date
            telefono:
              type: string
            correo:
              type: string
    responses:
      201:
        description: Beneficiario creado
        schema:
          $ref: '#/definitions/Afiliado'
      400:
        description: Campos inválidos o afiliado no es cotizante
      404:
        description: Cotizante no encontrado
      409:
        description: Documento duplicado
    """
    cotizante = Afiliado.query.get_or_404(afiliado_id)
    if cotizante.tipo != "cotizante":
        return jsonify({"error": "El afiliado referenciado no es cotizante"}), 400

    data = request.get_json(silent=True) or {}
    error = _validar_campos_obligatorios(data)
    if error:
        return jsonify({"error": error}), 400

    if Afiliado.query.filter_by(numero_documento=data["numero_documento"]).first():
        return jsonify({"error": "Ya existe un afiliado con ese número de documento"}), 409

    beneficiario = Afiliado(
        tipo_documento=data["tipo_documento"],
        numero_documento=data["numero_documento"],
        nombres=data["nombres"].strip(),
        apellidos=data["apellidos"].strip(),
        genero=data["genero"],
        fecha_nacimiento=date.fromisoformat(data["fecha_nacimiento"]),
        telefono=data.get("telefono"),
        correo=data.get("correo", "").strip().lower() or None,
        departamento=data.get("departamento"),
        ciudad=data.get("ciudad"),
        ips_medica=cotizante.ips_medica,
        tipo="beneficiario",
        cotizante_id=afiliado_id,
        estado="activo",
    )
    db.session.add(beneficiario)
    db.session.commit()
    return jsonify(beneficiario.to_dict()), 201


# ── Rutas afiliado ─────────────────────────────────────────────────────────────

@afiliados_bp.get("/api/afiliados/me/beneficiarios")
@afiliado_required
def mis_beneficiarios():
    """
    Mis beneficiarios (afiliado autenticado)
    ---
    tags:
      - Afiliados
    security:
      - Bearer: []
    responses:
      200:
        description: Lista de beneficiarios del cotizante autenticado
        schema:
          type: array
          items:
            $ref: '#/definitions/Afiliado'
      401:
        description: Token inválido
    """
    afiliado_id = int(get_jwt_identity())
    afiliado = Afiliado.query.get_or_404(afiliado_id)

    bens = list(afiliado.beneficiarios)
    cambios = False
    for b in bens:
        if b.verificar_inactivacion_por_edad():
            cambios = True
    if cambios:
        db.session.commit()

    return jsonify([b.to_dict() for b in bens]), 200
