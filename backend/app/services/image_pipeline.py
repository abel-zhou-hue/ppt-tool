from __future__ import annotations

import asyncio
import logging
from typing import Optional

from app.adapters.image.registry import get_image
from app.schemas.deck import ApiKeys, Deck, Slide

logger = logging.getLogger(__name__)


def _build_image_prompt(slide_script: str, style: str, language: str) -> str:
    if language == "en":
        return (
            "Render this as a clean, professional 16:9 presentation slide. "
            "Display the following content clearly with appropriate typography, layout, "
            "and decorative elements. Avoid clutter; keep text crisp and readable.\n\n"
            f"Visual style: {style}\n\n"
            f"Content to display on the slide:\n{slide_script}"
        )
    return (
        "把以下内容渲染为一张干净、专业的 16:9 PPT 幻灯片。"
        "清晰展示文字内容，配合合适的排版、布局和装饰元素。"
        "避免拥挤，文字要清晰可读。\n\n"
        f"视觉风格：{style}\n\n"
        f"页面要显示的内容：\n{slide_script}"
    )


async def generate_deck_images(
    deck: Deck,
    image_model: str = "gpt-image-2",
    api_keys: Optional[ApiKeys] = None,
) -> Deck:
    adapter = get_image(image_model)
    if not deck.slides:
        return deck

    style = deck.style_description
    lang = deck.language

    first = deck.slides[0]
    first_prompt = _build_image_prompt(first.slide_script, style, lang)
    try:
        first.image_url = await adapter.generate(
            prompt=first_prompt,
            size="16:9",
            resolution="2k",
            api_keys=api_keys,
        )
        deck.anchor_image_url = first.image_url
        logger.info(f"Anchor (slide 1) generated: {first.image_url}")
    except Exception:
        logger.exception("Anchor (slide 1) image generation failed")

    remaining = deck.slides[1:]
    if not remaining:
        return deck

    ref_images = [deck.anchor_image_url] if deck.anchor_image_url else None

    async def _gen(slide: Slide) -> None:
        prompt = _build_image_prompt(slide.slide_script, style, lang)
        try:
            slide.image_url = await adapter.generate(
                prompt=prompt,
                size="16:9",
                resolution="2k",
                reference_images=ref_images,
                api_keys=api_keys,
            )
            logger.info(f"Slide {slide.id} image generated")
        except Exception:
            logger.exception(f"Image gen failed for slide {slide.id}")
            slide.image_url = None

    await asyncio.gather(*[_gen(s) for s in remaining])
    return deck
