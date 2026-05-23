from __future__ import annotations

from app.adapters.llm.registry import get_llm
from app.schemas.deck import Deck, ScriptInput


async def script_to_deck(payload: ScriptInput) -> Deck:
    llm = get_llm(payload.llm_model)
    return await llm.generate_deck(
        payload.script, payload.language, payload.api_keys
    )
