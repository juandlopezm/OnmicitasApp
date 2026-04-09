"""
Servicio SSE (Server-Sent Events) — sincronización en tiempo real.

Cada cliente SSE recibe su propio Queue. emit_event() distribuye a todos.
Funciona con --workers 1 --threads N (un solo proceso, múltiples hilos).
Para escalar a múltiples workers: reemplazar _subscribers con Redis Pub/Sub.
"""

import json
import queue
import threading
from typing import Any

_subscribers: list[queue.Queue] = []
_lock = threading.Lock()


def subscribe() -> queue.Queue:
    q: queue.Queue = queue.Queue(maxsize=100)
    with _lock:
        _subscribers.append(q)
    return q


def unsubscribe(q: queue.Queue) -> None:
    with _lock:
        try:
            _subscribers.remove(q)
        except ValueError:
            pass


def emit_event(event_type: str, data: Any) -> None:
    """Emite un evento a todos los clientes conectados. Descarta clientes lentos."""
    payload = json.dumps({"type": event_type, "data": data}, default=str)
    with _lock:
        lentos: list[queue.Queue] = []
        for q in _subscribers:
            try:
                q.put_nowait(payload)
            except queue.Full:
                lentos.append(q)
        for q in lentos:
            _subscribers.remove(q)
