from __future__ import annotations

from .en import SYSTEM_PROMPT_EN
from .zh import SYSTEM_PROMPT_ZH


def get_system_prompt(language: str) -> str:
    if language == "en":
        return SYSTEM_PROMPT_EN
    return SYSTEM_PROMPT_ZH
