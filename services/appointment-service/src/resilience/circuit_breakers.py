import pybreaker
import logging

logger = logging.getLogger(__name__)


class _StateChangeListener(pybreaker.CircuitBreakerListener):
    def state_change(self, cb, old_state, new_state):
        logger.warning(f"[CircuitBreaker] {cb.name}: {old_state} → {new_state}")


_listener = _StateChangeListener()

MEDICAL_SERVICE_CB = pybreaker.CircuitBreaker(
    fail_max=3,
    reset_timeout=30,
    name="medical-service",
    listeners=[_listener],
)

USER_SERVICE_CB = pybreaker.CircuitBreaker(
    fail_max=3,
    reset_timeout=30,
    name="user-service",
    listeners=[_listener],
)
