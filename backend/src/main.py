import logging
import os
from typing import Any, Dict

from apscheduler.schedulers.asyncio import AsyncIOScheduler
from fastapi import Depends, FastAPI, HTTPException, Response, status
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy.orm import Session

from .cache_manager import CacheManager
from .database import CachedData, SessionLocal, get_db, init_db
from .gov_api import fetch_all_datasets


def get_allowed_origins() -> list[str]:
    origins_env = os.getenv('FRONTEND_ORIGINS')
    if origins_env:
        return [o.strip() for o in origins_env.split(',') if o.strip()]
    return []


async def lifespan(app: FastAPI):
    logging.basicConfig(level=logging.INFO)
    init_db()

    hour = int(os.getenv('UPDATE_HOUR', '2'))  # UTC-4 hour
    minute = int(os.getenv('UPDATE_MINUTE', '0'))
    scheduler = AsyncIOScheduler(timezone='America/Campo_Grande')
    scheduler.add_job(
        _run_update, 'cron', hour=hour, minute=minute, misfire_grace_time=3600, coalesce=True, id='daily_update'
    )
    scheduler.start()
    app.state.scheduler = scheduler
    logging.info(f'Scheduler started (UTC-4 {hour:02d}:{minute:02d} daily)')

    db = SessionLocal()
    try:
        if db.query(CachedData).count() == 0:
            logging.info('Cache empty; running initial update.')
            await _run_update()
    finally:
        db.close()

    yield
    # Shutdown
    scheduler = getattr(app.state, 'scheduler', None)
    if scheduler and scheduler.running:
        scheduler.shutdown(wait=False)
        logging.info('Scheduler shut down.')


app = FastAPI(title='Portal Transparência API', lifespan=lifespan)
app.add_middleware(
    CORSMiddleware,
    allow_origins=get_allowed_origins(),
    allow_credentials=True,
    allow_methods=['GET', 'POST'],
    allow_headers=['*'],
)


async def _run_update():
    from .database import SessionLocal
    from .update import perform_update_streaming

    db = SessionLocal()
    try:
        cache = CacheManager(db)

        def update_db(dataset_key: str, data: str) -> None:
            """Callback to update database for each dataset."""
            cache.set(dataset_key, data)
            logging.info(f'Updated dataset: {dataset_key}')

        await perform_update_streaming(update_db)
        logging.info('Scheduled update completed')
    except Exception as e:
        logging.exception(f'Scheduled update failed: {e}')
    finally:
        db.close()


@app.get('/api/')
async def root() -> Dict[str, Any]:
    return {'message': 'Portal Transparência API'}


@app.get('/api/data')
def list_data(db: Session = Depends(get_db)) -> Dict[str, Any]:
    from .database import CachedData

    # Only select metadata to avoid loading giant data blobs into memory
    rows = db.query(CachedData.data_type, CachedData.updated_at).all()
    return {row.data_type: row.updated_at.isoformat() + 'Z' for row in rows}


@app.get('/api/data/{data_type}')
def get_data(data_type: str, db: Session = Depends(get_db)) -> Any:
    cache = CacheManager(db)
    data = cache.get(data_type)
    if data is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail='Data not found')

    # Return as Response with application/json media type to avoid FastAPI 
    # re-serializing the string (which would use more RAM and be slower)
    return Response(content=data, media_type='application/json')


@app.post('/api/refresh')
async def refresh(token: str | None = None, force: bool = True) -> Dict[str, str]:
    expected = os.getenv('REFRESH_TOKEN')
    if expected and token != expected:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail='Unauthorized')
    from .database import SessionLocal
    from .update import perform_update_streaming

    db = SessionLocal()
    try:
        cache = CacheManager(db)
        updated_keys = []

        def update_db(dataset_key: str, data: str) -> None:
            """Callback to update database for each dataset."""
            cache.set(dataset_key, data)
            updated_keys.append(dataset_key)

        if force:
            await perform_update_streaming(update_db)
        else:
            await perform_update_streaming(update_db)

        return {'status': 'ok', 'updated': ', '.join(updated_keys)}
    finally:
        db.close()
