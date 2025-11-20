"""High-level data access layer used by the scheduler and refresh endpoint."""

from __future__ import annotations

import os
from typing import Any, Dict

from .update import load_cached_or_update, perform_update


async def fetch_all_datasets(force: bool | None = None) -> Dict[str, Any]:
    if force is None:
        force_env = os.getenv('FORCE_UPDATE', 'false').lower() == 'true'
        force = force_env
    return await load_cached_or_update(force=force)


async def refresh_datasets() -> Dict[str, Any]:
    """Explicitly perform update, bypassing cache."""
    return await perform_update()
