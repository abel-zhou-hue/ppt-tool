from __future__ import annotations

import asyncio
from typing import Any, Optional

import httpx

from app.adapters._utils import resolve_key
from app.core.config import settings
from app.schemas.deck import ApiKeys

from .base import ImageAdapter

INITIAL_POLL_DELAY_SECONDS = 12
POLL_INTERVAL_SECONDS = 4
MAX_POLL_ATTEMPTS = 60


class GPTImage2Adapter(ImageAdapter):
    name = "gpt-image-2"

    async def generate(
        self,
        prompt: str,
        size: str = "16:9",
        resolution: str = "2k",
        reference_images: Optional[list[str]] = None,
        api_keys: Optional[ApiKeys] = None,
    ) -> str:
        key = resolve_key(
            api_keys.apimart_api_key if api_keys else None,
            settings.apimart_api_key,
            "APIMART_API_KEY",
        )
        headers = {"Authorization": f"Bearer {key}"}
        payload: dict[str, Any] = {
            "model": "gpt-image-2",
            "prompt": prompt,
            "n": 1,
            "size": size,
            "resolution": resolution,
        }
        if reference_images:
            payload["image_urls"] = reference_images

        async with httpx.AsyncClient(timeout=120.0) as client:
            submit_resp = await client.post(
                f"{settings.apimart_base_url}/v1/images/generations",
                json=payload,
                headers=headers,
            )
            submit_resp.raise_for_status()
            task_id = submit_resp.json()["data"][0]["task_id"]

            await asyncio.sleep(INITIAL_POLL_DELAY_SECONDS)
            for _ in range(MAX_POLL_ATTEMPTS):
                poll_resp = await client.get(
                    f"{settings.apimart_base_url}/v1/tasks/{task_id}",
                    headers=headers,
                )
                poll_resp.raise_for_status()
                data = poll_resp.json()["data"]
                status = data.get("status")
                if status == "completed":
                    return data["result"]["images"][0]["url"][0]
                if status == "failed":
                    err = data.get("error", {}).get("message", "unknown error")
                    raise RuntimeError(f"Image generation failed: {err}")
                await asyncio.sleep(POLL_INTERVAL_SECONDS)

        raise TimeoutError(f"Image generation timed out: task_id={task_id}")
