from __future__ import annotations

from typing import Any, Optional

import httpx

from app.adapters._utils import resolve_key, resolve_str
from app.core.config import settings
from app.schemas.deck import ApiKeys

from .base import ImageAdapter

_SIZE_MAP_BY_RESOLUTION = {
    "1k": {
        "16:9": "1536x864",
        "9:16": "864x1536",
        "1:1": "1024x1024",
        "4:3": "1280x960",
        "3:4": "960x1280",
        "3:2": "1248x832",
        "2:3": "832x1248",
    },
    "2k": {
        "16:9": "2048x1152",
        "9:16": "1152x2048",
        "1:1": "2048x2048",
        "4:3": "2048x1536",
        "3:4": "1536x2048",
        "3:2": "2048x1360",
        "2:3": "1360x2048",
    },
    "4k": {
        "16:9": "3840x2160",
        "9:16": "2160x3840",
        "1:1": "2880x2880",
        "4:3": "3312x2480",
        "3:4": "2480x3312",
        "3:2": "3520x2336",
        "2:3": "2336x3520",
    },
}


def _aspect_to_pixels(size: str, resolution: str) -> str:
    if "x" in size.lower():
        return size
    bucket = _SIZE_MAP_BY_RESOLUTION.get(resolution, _SIZE_MAP_BY_RESOLUTION["2k"])
    return bucket.get(size, "2048x1152")


class SeedreamAdapter(ImageAdapter):
    name = "seedream"

    async def generate(
        self,
        prompt: str,
        size: str = "16:9",
        resolution: str = "2k",
        reference_images: Optional[list[str]] = None,
        api_keys: Optional[ApiKeys] = None,
    ) -> str:
        key = resolve_key(
            api_keys.volcano_ark_api_key if api_keys else None,
            settings.volcano_ark_api_key,
            "VOLCANO_ARK_API_KEY",
        )
        pixels = _aspect_to_pixels(size, resolution)

        if reference_images:
            model = resolve_str(
                api_keys.seedream_i2i_model if api_keys else None,
                settings.seedream_i2i_model,
            )
            payload: dict[str, Any] = {
                "model": model,
                "prompt": prompt,
                "image": reference_images[0],
                "size": pixels,
                "response_format": "url",
            }
        else:
            model = resolve_str(
                api_keys.seedream_t2i_model if api_keys else None,
                settings.seedream_t2i_model,
            )
            payload = {
                "model": model,
                "prompt": prompt,
                "size": pixels,
                "response_format": "url",
            }

        async with httpx.AsyncClient(timeout=180.0) as client:
            resp = await client.post(
                f"{settings.volcano_ark_base_url}/images/generations",
                json=payload,
                headers={
                    "Authorization": f"Bearer {key}",
                    "Content-Type": "application/json",
                },
            )
            if resp.status_code >= 400:
                raise RuntimeError(
                    f"Seedream API error {resp.status_code}: {resp.text[:300]}"
                )
            data = resp.json()
            try:
                return data["data"][0]["url"]
            except (KeyError, IndexError, TypeError) as e:
                raise RuntimeError(
                    f"Seedream response format unexpected: {data}"
                ) from e
