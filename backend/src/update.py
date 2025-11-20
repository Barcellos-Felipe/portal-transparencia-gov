"""Data retrieval and transformation utilities.

Converted from a run-on-import script into reusable functions.
Use perform_update() to download, process, and persist datasets.
"""

from __future__ import annotations

import json
import os
import zipfile
from pathlib import Path
from typing import Any, Dict

import httpx
import polars as pl
from dotenv import load_dotenv

load_dotenv()

ZIP_URL_DEFAULT = os.getenv('ZIP_URL_DEFAULT', '')

DATA_DIR = Path(__file__).parents[1].resolve() / 'tmp_data'

FILENAMES = [
    'EmendasParlamentares.csv',
    'EmendasParlamentares_Convenios.csv',
    'EmendasParlamentares_PorFavorecido.csv',
]

OUTPUT_MAP = {
    'emendas': 'emendas.json',
    'convenios': 'emendas_convenios.json',
    'por_favorecido': 'emendas_por_favorecido.json',
}


def _ensure_data_dir() -> None:
    DATA_DIR.mkdir(parents=True, exist_ok=True)


async def _download_zip(url: str, target_zip: Path) -> None:
    async with httpx.AsyncClient(timeout=120) as client:
        r = await client.get(url)
        r.raise_for_status()
        target_zip.write_bytes(r.content)


def _extract_csvs(zip_path: Path) -> None:
    with zipfile.ZipFile(zip_path, 'r') as zf:
        for name in FILENAMES:
            zf.extract(name, DATA_DIR)


def _read_data(file: Path) -> pl.DataFrame:
    return pl.read_csv(file, separator=';', encoding='latin1', infer_schema_length=0)


def _load_filter() -> Dict[str, pl.DataFrame]:
    emendas_path = DATA_DIR / 'EmendasParlamentares.csv'
    convenios_path = DATA_DIR / 'EmendasParlamentares_Convenios.csv'
    favorecido_path = DATA_DIR / 'EmendasParlamentares_PorFavorecido.csv'

    df_emendas = _read_data(emendas_path).filter(
        pl.col('Localidade de aplicação do recurso').str.contains('CAMPO GRANDE - MS')
    )

    df_convenios = _read_data(convenios_path).filter(
        pl.col('Localidade do gasto').str.contains('CAMPO GRANDE - MS')
    )

    df_por_fav = _read_data(favorecido_path).filter(
        (pl.col('Município Favorecido') == 'CAMPO GRANDE') & (pl.col('UF Favorecido') == 'MS')
    )

    return {
        'emendas': df_emendas,
        'convenios': df_convenios,
        'por_favorecido': df_por_fav,
    }


def _save_json(datasets: Dict[str, Any]) -> None:
    for key, rows in datasets.items():
        out_name = OUTPUT_MAP.get(key)
        if not out_name:
            continue
        out_path = DATA_DIR / out_name
        with open(out_path, 'w', encoding='utf-8') as f:
            json.dump(rows, f, ensure_ascii=False, indent=2)

def _delete_data_files() -> None:
    data_files = [*OUTPUT_MAP.values(),*FILENAMES , 'emendas.zip']
    for fname in data_files:
        path = DATA_DIR / fname
        if path.exists():
            path.unlink()


async def perform_update() -> Dict[str, Any]:
    """Download, extract, filter, and persist datasets.

    Returns dict mapping dataset key to list-of-dicts.
    """
    _ensure_data_dir()
    zip_path = DATA_DIR / 'emendas.zip'
    await _download_zip(ZIP_URL_DEFAULT, zip_path)
    _extract_csvs(zip_path)
    dataframes = _load_filter()
    datasets: Dict[str, Any] = {k: df.to_dicts() for k, df in dataframes.items()}
    _save_json(datasets)
    _delete_data_files()
    return datasets


async def load_cached_or_update(force: bool = False) -> Dict[str, Any]:
    """Return cached datasets if they exist; otherwise perform update.

    Set FORCE_UPDATE env var or pass force=True to bypass cache.
    """
    _ensure_data_dir()
    if not force and all((DATA_DIR / v).exists() for v in OUTPUT_MAP.values()):
        loaded: Dict[str, Any] = {}
        for key, fname in OUTPUT_MAP.items():
            path = DATA_DIR / fname
            try:
                with open(path, 'r', encoding='utf-8') as f:
                    loaded[key] = json.load(f)
            except Exception:
                return await perform_update()
        return loaded
    return await perform_update()
