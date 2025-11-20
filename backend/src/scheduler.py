import logging
from datetime import datetime, timedelta, timezone
from typing import Callable

from apscheduler.schedulers.background import BackgroundScheduler

TZ_MINUS_4 = timezone(timedelta(hours=-4))

def create_scheduler(update_func: Callable[[], None], hour: int = 2) -> BackgroundScheduler:
    scheduler = BackgroundScheduler()
    scheduler.add_job(update_func, "cron", hour=hour)
    return scheduler


def log_heartbeat(prefix: str = "Scheduler") -> None:
    logging.info(f"{prefix} tick at {datetime.now(tz=TZ_MINUS_4).isoformat()}")
