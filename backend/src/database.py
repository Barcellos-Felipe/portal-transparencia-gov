from datetime import datetime, timedelta, timezone

from sqlalchemy import Column, DateTime, Integer, String, Text, create_engine, text
from sqlalchemy.ext.declarative import declarative_base
from sqlalchemy.orm import sessionmaker

TZ_MINUS_4 = timezone(timedelta(hours=-4))
DATABASE_URL = 'sqlite:///./dados.db?check_same_thread=False'


engine = create_engine(
    DATABASE_URL,
    connect_args={'check_same_thread': False},
    pool_pre_ping=True
)

# Habilita modo WAL para melhorar concorrência
with engine.connect() as conn:
    conn.execute(text('PRAGMA journal_mode=WAL'))

SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
Base = declarative_base()


class CachedData(Base): # type: ignore
    __tablename__ = 'cached_data'

    id = Column(Integer, primary_key=True, index=True)
    data_type = Column(String, index=True)
    data = Column(Text)
    updated_at = Column(DateTime, default=datetime.now(tz=TZ_MINUS_4))


def init_db() -> None:
    Base.metadata.create_all(bind=engine)


def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
