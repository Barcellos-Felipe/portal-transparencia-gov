from datetime import datetime, timedelta, timezone
from typing import Any, Optional

from sqlalchemy.orm import Session

from .database import CachedData

TZ_MINUS_4 = timezone(timedelta(hours=-4))

class CacheManager:
    def __init__(self, db: Session):
        self.db = db

    def get(self, data_type: str) -> Optional[Any]:
        row = self.db.query(CachedData).filter(CachedData.data_type == data_type).first()
        return row.data if row else None

    def set(self, data_type: str, data: Any) -> None:
        row = self.db.query(CachedData).filter(CachedData.data_type == data_type).first()
        if row:
            row.data = data
            row.updated_at = datetime.now(tz=TZ_MINUS_4)  # type: ignore
        else:
            row = CachedData(
                data_type=data_type,
                data=data,
                updated_at=datetime.now(tz=TZ_MINUS_4),
            )
            self.db.add(row)
        self.db.commit()
        self.db.refresh(row)
