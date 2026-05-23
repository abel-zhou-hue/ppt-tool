from __future__ import annotations

from typing import Literal, Optional

from pydantic import BaseModel

Language = Literal["zh", "en"]


class Slide(BaseModel):
    id: str
    slide_script: str
    image_url: Optional[str] = None


class Deck(BaseModel):
    language: Language
    slides: list[Slide]
    style_description: str
    anchor_image_url: Optional[str] = None


class ApiKeys(BaseModel):
    """User-provided API keys + model overrides. All optional; falls back to .env."""

    deepseek_api_key: Optional[str] = None
    volcano_ark_api_key: Optional[str] = None
    apimart_api_key: Optional[str] = None
    doubao_model: Optional[str] = None
    seedream_t2i_model: Optional[str] = None
    seedream_i2i_model: Optional[str] = None


class ScriptInput(BaseModel):
    script: str
    language: Language = "zh"
    llm_model: str = "deepseek"
    image_model: str = "gpt-image-2"
    api_keys: Optional[ApiKeys] = None


class GenerateImagesInput(BaseModel):
    deck: Deck
    image_model: str = "gpt-image-2"
    api_keys: Optional[ApiKeys] = None
