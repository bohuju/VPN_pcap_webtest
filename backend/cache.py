from __future__ import annotations
import time
from collections import OrderedDict
from typing import Any, Optional


class LRUCache:
    """Thread-unsafe LRU cache with per-key TTL."""

    def __init__(self, max_size: int = 128, ttl_seconds: float = 3600.0):
        self.max_size = max_size
        self.ttl = ttl_seconds
        self._store: OrderedDict[str, tuple[float, Any]] = OrderedDict()

    def get(self, key: str) -> Optional[Any]:
        if key not in self._store:
            return None
        ts, val = self._store[key]
        if time.time() - ts > self.ttl:
            del self._store[key]
            return None
        self._store.move_to_end(key)
        return val

    def put(self, key: str, value: Any) -> None:
        if key in self._store:
            self._store.move_to_end(key)
        self._store[key] = (time.time(), value)
        while len(self._store) > self.max_size:
            self._store.popitem(last=False)

    def invalidate(self, key: str) -> None:
        self._store.pop(key, None)

    def clear(self) -> None:
        self._store.clear()

    def __len__(self) -> int:
        return len(self._store)
