from backend.cache import LRUCache


def test_cache_put_and_get():
    c = LRUCache(max_size=10)
    c.put("a", 123)
    assert c.get("a") == 123
    assert c.get("nonexistent") is None


def test_cache_eviction():
    c = LRUCache(max_size=2)
    c.put("a", 1)
    c.put("b", 2)
    c.put("c", 3)
    assert c.get("a") is None
    assert c.get("b") == 2
    assert c.get("c") == 3


def test_cache_invalidate():
    c = LRUCache(max_size=10)
    c.put("a", 1)
    c.put("b", 2)
    c.invalidate("a")
    assert c.get("a") is None
    assert c.get("b") == 2


def test_cache_clear():
    c = LRUCache(max_size=10)
    c.put("a", 1)
    c.put("b", 2)
    c.clear()
    assert c.get("a") is None
    assert c.get("b") is None
