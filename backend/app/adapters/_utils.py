from __future__ import annotations

from typing import Optional


def resolve_key(provided: Optional[str], fallback: str, name: str) -> str:
    """Return user-provided key if set, else env fallback. Raise if neither set."""
    val = (provided or "").strip() or (fallback or "").strip()
    if not val:
        raise RuntimeError(
            f"{name} is not configured. "
            f"Set it in the frontend Settings or in backend .env."
        )
    return val


def resolve_str(provided: Optional[str], fallback: str) -> str:
    """Return user-provided value if non-empty, else fallback."""
    return (provided or "").strip() or fallback
