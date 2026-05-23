from __future__ import annotations

from fastapi import APIRouter, HTTPException, Response

from app.adapters.image.registry import list_image_names
from app.adapters.llm.registry import list_llm_names
from app.schemas.deck import Deck, GenerateImagesInput, ScriptInput
from app.services.image_pipeline import generate_deck_images
from app.services.pptx_assembler import assemble_pptx
from app.services.script_to_deck import script_to_deck

router = APIRouter()

PPTX_MEDIA_TYPE = (
    "application/vnd.openxmlformats-officedocument.presentationml.presentation"
)


@router.get("/health")
async def health() -> dict:
    return {"status": "ok"}


@router.get("/adapters/llm")
async def get_llm_adapters() -> list[str]:
    return list_llm_names()


@router.get("/adapters/image")
async def get_image_adapters() -> list[str]:
    return list_image_names()


@router.post("/decks/generate", response_model=Deck)
async def generate_deck_endpoint(payload: ScriptInput) -> Deck:
    try:
        return await script_to_deck(payload)
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/decks/generate-images", response_model=Deck)
async def generate_images_endpoint(payload: GenerateImagesInput) -> Deck:
    try:
        return await generate_deck_images(
            payload.deck, payload.image_model, payload.api_keys
        )
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/decks/export")
async def export_deck_endpoint(deck: Deck) -> Response:
    try:
        pptx_bytes = await assemble_pptx(deck)
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
    return Response(
        content=pptx_bytes,
        media_type=PPTX_MEDIA_TYPE,
        headers={"Content-Disposition": 'attachment; filename="deck.pptx"'},
    )
