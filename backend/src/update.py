from __future__ import annotations

import gc
import json
import logging
import os
import time
import zipfile
from pathlib import Path
from typing import Any, Callable, Dict

import httpx
import polars as pl
from dotenv import load_dotenv

logging.basicConfig(level=logging.INFO)
load_dotenv()

ZIP_URL_DEFAULT = os.getenv('ZIP_URL_DEFAULT', '')

DATA_DIR = Path(__file__).parents[1].resolve() / 'tmp_data'

# Map CSV filenames to their dataset keys and filters
CSV_CONFIGS = [
    {
        'csv_file': 'EmendasParlamentares.csv',
        'dataset_key': 'emendas',
        'json_file': 'emendas.json',
        'filter_col': 'Localidade de aplicação do recurso',
        'filter_value': 'CAMPO GRANDE - MS',
        'filter_type': 'contains',
    },
    {
        'csv_file': 'EmendasParlamentares_Convenios.csv',
        'dataset_key': 'convenios',
        'json_file': 'emendas_convenios.json',
        'filter_col': 'Localidade do gasto',
        'filter_value': 'CAMPO GRANDE - MS',
        'filter_type': 'contains',
    },
    {
        'csv_file': 'EmendasParlamentares_PorFavorecido.csv',
        'dataset_key': 'por_favorecido',
        'json_file': 'emendas_por_favorecido.json',
        'filter_col': None,
        'filter_value': None,
        'filter_type': 'multi',
    },
]

OUTPUT_MAP = {
    'emendas': 'emendas.json',
    'convenios': 'emendas_convenios.json',
    'por_favorecido': 'emendas_por_favorecido.json',
}


def _ensure_data_dir() -> None:
    DATA_DIR.mkdir(parents=True, exist_ok=True)


async def _download_zip(url: str, target_zip: Path) -> None:
    """Download ZIP file from URL."""
    async with httpx.AsyncClient(timeout=120) as client:
        async with client.stream('GET', url) as response:
            response.raise_for_status()
            with open(target_zip, 'wb') as f:
                async for chunk in response.aiter_bytes():
                    f.write(chunk)


def _extract_csvs(zip_path: Path) -> None:
    """Extract only the CSV files we need from the ZIP."""
    with zipfile.ZipFile(zip_path, 'r') as zf:
        for config in CSV_CONFIGS:
            csv_name = config['csv_file']
            zf.extract(csv_name, DATA_DIR)
    # Delete ZIP immediately after extraction
    zip_path.unlink()


def _convert_to_utf8(csv_path: Path) -> None:
    """
    Convert a Latin-1 encoded CSV file to UTF-8 in-place.

    Reads and writes in chunks to keep memory usage low.
    """
    tmp_path = csv_path.with_suffix('.utf8.csv')
    with open(csv_path, 'r', encoding='latin1') as src, open(tmp_path, 'w', encoding='utf-8') as dst:
        while chunk := src.read(1024 * 1024):  # 1 MB chunks
            dst.write(chunk)
    csv_path.unlink()
    tmp_path.rename(csv_path)


def _read_and_filter_csv(csv_path: Path, config: Dict[str, Any]) -> pl.LazyFrame:
    """
    Read CSV and apply the appropriate filter based on config.
    """
    return pl.read_csv(csv_path, separator=';', encoding='latin1', infer_schema_length=0, low_memory=True).lazy()


def _csv_to_json(csv_path: Path, json_path: Path, config: Dict[str, Any]) -> None:
    """Convert filtered CSV to JSON in a memory-efficient batched way and delete CSV."""
    logging.info(f'Processing: {config["dataset_key"]}')

    # Write JSON in streaming fashion to minimize RAM
    with open(json_path, 'w', encoding='utf-8') as f:
        f.write('[')
        first = True

        # Use batched reader to stay within memory limits (e.g., 512MB on Render)
        # CSV must already be UTF-8
        reader = pl.read_csv_batched(csv_path, separator=';', infer_schema_length=0, batch_size=20000)

        while batch_list := reader.next_batches(1):
            batch = batch_list[0]

            filter_type = config.get('filter_type')
            if filter_type == 'contains':
                batch = batch.filter(pl.col(config['filter_col']).str.contains(config['filter_value']))
            elif filter_type == 'multi':
                # Custom filter for 'por_favorecido' dataset
                batch = batch.filter(
                    (pl.col('Município Favorecido') == 'CAMPO GRANDE') & (pl.col('UF Favorecido') == 'MS')
                )

            if batch.height == 0:
                continue

            for row in batch.to_dicts():
                if not first:
                    f.write(',')
                else:
                    first = False
                json.dump(row, f, ensure_ascii=False)

        f.write(']')

    # Release the Polars reader file handle before deleting on Windows
    del reader
    gc.collect()

    # Delete CSV with retry for Windows file-locking
    for attempt in range(5):
        try:
            csv_path.unlink()
            break
        except PermissionError:
            if attempt == 4:
                logging.warning(f'Could not delete {csv_path.name} after 5 attempts, skipping.')
            else:
                time.sleep(0.5)
    logging.info(f'Converted and deleted CSV: {csv_path.name}')


def _load_json_and_delete(json_path: Path) -> str:
    """Load JSON data as a raw string and delete the file immediately.
    """
    with open(json_path, 'r', encoding='utf-8') as f:
        data = f.read()

    # Delete JSON immediately after loading
    json_path.unlink()
    logging.info(f'Loaded and deleted JSON: {json_path.name}')

    return data


async def perform_update_streaming(db_update_callback: Callable[[str, str], None]) -> None:
    """Download, extract, and process datasets with minimal RAM usage.

    Process flow:
    1. Download ZIP
    2. Extract CSV files
    3. For each CSV:
       a. Convert to JSON (delete CSV)
       b. Load JSON data
       c. Update database via callback
       d. Delete JSON

    Args:
        db_update_callback: Function that takes (dataset_key, data) and updates the database
    """
    _ensure_data_dir()
    zip_path = DATA_DIR / 'emendas.zip'

    logging.info('Downloading ZIP')
    await _download_zip(ZIP_URL_DEFAULT, zip_path)

    logging.info('Extracting CSV files')
    _extract_csvs(zip_path)

    # Process each CSV file sequentially
    for config in CSV_CONFIGS:
        csv_path = DATA_DIR / config['csv_file']
        json_path = DATA_DIR / config['json_file']
        dataset_key = config['dataset_key']

        # Convert Latin-1 CSV to UTF-8 so Polars can read it properly
        logging.info(f'Converting encoding: {csv_path.name}')
        _convert_to_utf8(csv_path)

        # Convert CSV to JSON (deletes CSV)
        _csv_to_json(csv_path, json_path, config)

        # Load JSON data (deletes JSON)
        data = _load_json_and_delete(json_path)

        # Update database immediately
        logging.info(f'Updating database: {dataset_key}')
        db_update_callback(dataset_key, data)

        # Free memory
        del data

    logging.info('Streaming update completed')


async def perform_update() -> Dict[str, Any]:
    """Download, extract, filter, and persist datasets.

    DEPRECATED: This method loads all data into memory.
    Use perform_update_streaming() with a database callback instead.

    Returns dict mapping dataset key to list-of-dicts.
    """
    _ensure_data_dir()
    zip_path = DATA_DIR / 'emendas.zip'
    logging.info('Downloading ZIP')
    await _download_zip(ZIP_URL_DEFAULT, zip_path)
    logging.info('Extracting csv files')
    _extract_csvs(zip_path)
    logging.info('Starting save_json')
    datasets = _save_json()
    logging.info('Deleting old files')
    _delete_data_files()
    return datasets


def _read_data(file: Path) -> pl.LazyFrame:
    """Legacy function for backward compatibility."""
    return pl.read_csv(file, separator=';', encoding='latin1', infer_schema_length=0).lazy()


def _save_json() -> Dict[str, Any]:
    """Legacy function - loads all data into memory.

    DEPRECATED: Use perform_update_streaming() instead for better memory efficiency.
    """
    datasets = {}
    for config in CSV_CONFIGS:
        csv_path = DATA_DIR / config['csv_file']
        json_path = DATA_DIR / config['json_file']
        dataset_key = config['dataset_key']

        # Use the improved batched conversion
        _csv_to_json(csv_path, json_path, config)

        # Load as string to save RAM even in legacy path
        with open(json_path, 'r', encoding='utf-8') as f:
            datasets[dataset_key] = json.load(f)

        json_path.unlink()
    return datasets


def _delete_data_files() -> None:
    """Delete all CSV and JSON files from the data directory."""
    csv_files = [config['csv_file'] for config in CSV_CONFIGS]
    data_files = [*OUTPUT_MAP.values(), *csv_files, 'emendas.zip']
    for fname in data_files:
        path = DATA_DIR / fname
        if path.exists():
            path.unlink()


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
