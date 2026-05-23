from __future__ import annotations

from abc import ABC, abstractmethod
from typing import Optional

from app.schemas.deck import ApiKeys


class ImageAdapter(ABC):
    name: str

    @abstractmethod
    async def generate(
        self,
        prompt: str,
        size: str = "16:9",
        resolution: str = "2k",
        reference_images: Optional[list[str]] = None,
        api_keys: Optional[ApiKeys] = None,
    ) -> str:
        ...
