from __future__ import annotations

from .base import ImageAdapter
from .gpt_image_2 import GPTImage2Adapter
from .seedream import SeedreamAdapter

_registry: dict[str, ImageAdapter] = {
    "gpt-image-2": GPTImage2Adapter(),
    "seedream": SeedreamAdapter(),
}


def get_image(name: str) -> ImageAdapter:
    if name not in _registry:
        raise ValueError(
            f"Unknown image adapter: {name!r}. Available: {list(_registry.keys())}"
        )
    return _registry[name]


def list_image_names() -> list[str]:
    return list(_registry.keys())
