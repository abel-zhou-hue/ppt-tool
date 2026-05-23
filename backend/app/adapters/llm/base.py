from __future__ import annotations

from abc import ABC, abstractmethod
from typing import Optional

from app.schemas.deck import ApiKeys, Deck


class LLMAdapter(ABC):
    name: str

    @abstractmethod
    async def generate_deck(
        self,
        script: str,
        language: str,
        api_keys: Optional[ApiKeys] = None,
    ) -> Deck:
        ...
