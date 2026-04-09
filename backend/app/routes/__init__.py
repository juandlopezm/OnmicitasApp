from .auth import auth_bp
from .admin_auth import admin_auth_bp
from .afiliados import afiliados_bp
from .especialidades import esp_bp
from .sedes import sedes_bp
from .medicos import medicos_bp
from .horarios import horarios_bp
from .citas import citas_bp
from .events import events_bp
from .canal import canal_bp

all_blueprints = [
    auth_bp,
    admin_auth_bp,
    afiliados_bp,
    esp_bp,
    sedes_bp,
    medicos_bp,
    horarios_bp,
    citas_bp,
    events_bp,
    canal_bp,
]
