from __future__ import annotations

from pathlib import Path


PROJECT_ROOT = Path(__file__).resolve().parents[1]
KNOWLEDGE_BASE_ROOT = PROJECT_ROOT.parent / "knowledge-base"
OUTPUT_ROOT = PROJECT_ROOT / "outputs" / "knowledge"

STRUCTURED_DATA_PATH = OUTPUT_ROOT / "structured.json"
EMBEDDINGS_DATA_PATH = OUTPUT_ROOT / "embeddings.json"
SCHEMA_CACHE_PATH = OUTPUT_ROOT / "schema_cache.json"


def ensure_output_dirs() -> None:
    OUTPUT_ROOT.mkdir(parents=True, exist_ok=True)
