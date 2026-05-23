from __future__ import annotations

import json
from typing import Optional

from openai import AsyncOpenAI

from app.adapters._utils import resolve_key
from app.core.config import settings
from app.prompts import get_system_prompt
from app.schemas.deck import ApiKeys, Deck

from .base import LLMAdapter


class DeepSeekAdapter(LLMAdapter):
    name = "deepseek"

    async def generate_deck(
        self,
        script: str,
        language: str,
        api_keys: Optional[ApiKeys] = None,
    ) -> Deck:
        key = resolve_key(
            api_keys.deepseek_api_key if api_keys else None,
            settings.deepseek_api_key,
            "DEEPSEEK_API_KEY",
        )
        client = AsyncOpenAI(api_key=key, base_url=settings.deepseek_base_url)
        system = get_system_prompt(language)
        resp = await client.chat.completions.create(
            model="deepseek-chat",
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
