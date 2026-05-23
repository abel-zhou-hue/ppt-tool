from __future__ import annotations

import json
from typing import Optional

from openai import AsyncOpenAI

from app.adapters._utils import resolve_key, resolve_str
from app.core.config import settings
from app.prompts import get_system_prompt
from app.schemas.deck import ApiKeys, Deck

from .base import LLMAdapter


class DoubaoAdapter(LLMAdapter):
    name = "doubao"

    async def generate_deck(
        self,
        script: str,
        language: str,
        api_keys: Optional[ApiKeys] = None,
    ) -> Deck:
        key = resolve_key(
            api_keys.volcano_ark_api_key if api_keys else None,
            settings.volcano_ark_api_key,
            "VOLCANO_ARK_API_KEY",
        )
        model = resolve_str(
            api_keys.doubao_model if api_keys else None,
            settings.doubao_model,
        )
        client = AsyncOpenAI(api_key=key, base_url=settings.volcano_ark_base_url)
        system = get_system_prompt(language)
        resp = await client.chat.completions.create(
            model=model,
            messages=[
                {"role": "system", "content": system},
                {"role": "user", "content": script},
            ],
            response_format={"type": "json_object"},
            temperature=0.7,
        )
        raw = resp.choices[0].message.content or "{}"
        data = json.loads(raw)
        return Deck.model_validate(data)
