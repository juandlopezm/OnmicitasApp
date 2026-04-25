# Import all models to register them with SQLAlchemy metadata
from src.models.especialidad import Especialidad  # noqa: F401
from src.models.sede import Sede  # noqa: F401
from src.models.medico import Medico  # noqa: F401
from src.models.jornada_medico import JornadaMedico  # noqa: F401
from src.models.horario import Horario  # noqa: F401
from src.models.dia_no_habil import DiaNoHabil  # noqa: F401
