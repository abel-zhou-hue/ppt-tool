from __future__ import annotations

from .base import LLMAdapter
from .deepseek import DeepSeekAdapter
from .doubao import DoubaoAdapter

_registry: dict[str, LLMAdapter] = {
    "deepseek": DeepSeekAdapter(),
    "doubao": DoubaoAdapter(),
}


def get_llm(name: str) -> LLMAdapter:
    if name not in _registry:
        raise ValueError(
            f"Unknown LLM adapter: {name!r}. Available: {list(_registry.keys())}"
        )
    return _registry[name]


def list_llm_names() -> list[str]:
    return list(_registry.keys())
