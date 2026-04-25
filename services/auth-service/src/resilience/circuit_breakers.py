"""
Circuit Breaker instances for auth-service outbound HTTP calls.
Pattern: CLOSED → (fail_max failures) → OPEN → (reset_timeout s) → HALF-OPEN → CLOSED
"""

import logging
import pybreaker

logger = logging.getLogger(__name__)


class _LogListener(pybreaker.CircuitBreakerListener):
    def state_change(self, cb, old_state, new_state):
        logger.warning("[CircuitBreaker] %s: %s → %s", cb.name, old_state.name, new_state.name)

    def failure(self, cb, exc):
        logger.error("[CircuitBreaker] %s failure: %s", cb.name, exc)


_listener = _LogListener()

USER_SERVICE_CB = pybreaker.CircuitBreaker(
    fail_max=3,
    reset_timeout=30,
    name="user-service",
    listeners=[_listener],
)
