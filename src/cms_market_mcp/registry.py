from __future__ import annotations

import json
from functools import lru_cache
from typing import Any

from .config import REGISTRY_PATH


@lru_cache(maxsize=1)
def load_registry() -> dict[str, Any]:
    with REGISTRY_PATH.open("r", encoding="utf-8") as handle:
        return json.load(handle)


def get_dataset(key: str) -> dict[str, Any]:
    registry = load_registry()
    try:
        return registry["datasets"][key]
    except KeyError as exc:
        available = ", ".join(sorted(registry.get("datasets", {}).keys()))
        raise KeyError(f"Unknown dataset key '{key}'. Available dataset keys: {available}") from exc


def dataset_uuid(key: str) -> str:
    dataset = get_dataset(key)
    value = dataset.get("dataset_uuid")
    if not value:
        raise KeyError(f"Dataset '{key}' does not have a CMS Data API UUID")
    return str(value)


def provider_dataset_id(key: str) -> str:
    dataset = get_dataset(key)
    value = dataset.get("provider_dataset_id")
    if not value:
        raise KeyError(f"Dataset '{key}' does not have a Provider Data Catalog id")
    return str(value)
