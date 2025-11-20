import asyncio
import logging
import os
from typing import Any, Dict

from apscheduler.schedulers.asyncio import AsyncIOScheduler
from fastapi import Depends, FastAPI, HTTPException, status
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy.orm import Session

from .cache_manager import CacheManager
from .database import CachedData, SessionLocal, get_db, init_db
from .gov_api import fetch_all_datasets, refresh_datasets


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

    db = SessionLocal()
    try:
        cache = CacheManager(db)
        datasets = await fetch_all_datasets()
        for key, data in datasets.items():
            cache.set(key, data)
        logging.info(f'Scheduled update completed: {", ".join(datasets.keys())}')
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

    rows = db.query(CachedData).all()
    return {getattr(row, 'data_type'): row.updated_at.isoformat() + 'Z' for row in rows}


@app.get('/api/data/{data_type}')
def get_data(data_type: str, db: Session = Depends(get_db)) -> Any:
    cache = CacheManager(db)
    data = cache.get(data_type)
    if data is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail='Data not found')
    return data


@app.post('/api/refresh')
async def refresh(token: str | None = None, force: bool = True) -> Dict[str, str]:
    expected = os.getenv('REFRESH_TOKEN')
    if expected and token != expected:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail='Unauthorized')
    from .database import SessionLocal

    db = SessionLocal()
    try:
        cache = CacheManager(db)
        datasets = await (refresh_datasets() if force else fetch_all_datasets(force=False))
        for key, data in datasets.items():
            cache.set(key, data)
        return {'status': 'ok', 'updated': ', '.join(datasets.keys())}
    finally:
        db.close()
