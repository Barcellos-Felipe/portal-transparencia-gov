from __future__ import annotations

from typing import Any, Dict

from .update import perform_update


async def refresh_datasets() -> Dict[str, Any]:
    """Explicitly perform update, bypassing cache."""
    return await perform_update()
