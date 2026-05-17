from __future__ import annotations

import argparse
import json
import platform
import sys
from pathlib import Path
from typing import Any

from .cache import cache_rows, cache_status, filter_rows, list_cached_datasets, load_cached_rows
from .cms_client import CmsApiError, cms_data_paginated, provider_data_paginated
from .config import DEFAULT_CACHE_PATH, DEFAULT_MAX_ROWS, PROJECT_ROOT
from .registry import dataset_uuid, load_registry, provider_dataset_id

CORE_DATASET_KEYS = [
    "pac_hospice_latest",
    "inpatient_provider_service_latest",
    "hospice_provider_data",
    "hospice_general_information",
    "nursing_home_provider_information",
]


def parse_filter_pairs(values: list[str] | None) -> dict[str, str] | None:
    if not values:
        return None
    filters: dict[str, str] = {}
    for item in values:
        if "=" not in item:
            raise SystemExit(f"Invalid filter '{item}'. Use key=value.")
        key, value = item.split("=", 1)
        key = key.strip()
        value = value.strip()
        if key and value:
            filters[key] = value
    return filters or None


def print_json(payload: Any) -> None:
    print(json.dumps(payload, indent=2, ensure_ascii=False))


def command_doctor(args: argparse.Namespace) -> None:
    registry = load_registry()
    payload: dict[str, Any] = {
        "project_root": str(PROJECT_ROOT),
        "python_version": sys.version.split()[0],
        "platform": platform.platform(),
        "cache_path": str(Path(DEFAULT_CACHE_PATH).expanduser().resolve()),
        "registered_dataset_keys": sorted(registry.get("datasets", {}).keys()),
        "live_api_check": "skipped",
    }
    if args.live:
        try:
            key = "hospice_provider_data"
            rows = provider_data_paginated(provider_dataset_id(key), max_rows=1).rows
            payload["live_api_check"] = {"status": "ok", "dataset_key": key, "rows_returned": len(rows)}
        except Exception as exc:  # pragma: no cover, live network dependent
            payload["live_api_check"] = {"status": "failed", "error": str(exc)}
    print_json(payload)


def fetch_dataset(dataset_key: str, max_rows: int, keywords: list[str] | None = None):
    registry_entry = load_registry()["datasets"].get(dataset_key)
    if not registry_entry:
        raise SystemExit(f"Unknown dataset key: {dataset_key}")
    kind = registry_entry.get("kind")
    if kind == "cms_data_api":
        response = cms_data_paginated(dataset_uuid(dataset_key), keywords=keywords, filters=None, max_rows=max_rows)
    elif kind == "provider_data_catalog_api":
        response = provider_data_paginated(provider_dataset_id(dataset_key), filters=None, max_rows=max_rows)
    else:
        raise SystemExit(f"Dataset key {dataset_key} is not cacheable through this CLI.")
    return registry_entry, response


def command_cache(args: argparse.Namespace) -> None:
    registry_entry, response = fetch_dataset(args.dataset_key, args.max_rows, args.keyword)
    payload = cache_rows(
        dataset_key=args.dataset_key,
        rows=response.rows,
        source_name=str(registry_entry.get("name", args.dataset_key)),
        source_url=response.source_url or str(registry_entry.get("landing_page", "")),
        cache_scope="national_public_rows",
        notes="Cached from free public CMS data. This is market intelligence, not exact referral flow.",
        overwrite=args.overwrite,
    )
    payload["api_meta"] = response.meta
    print_json(payload)


def command_cache_core(args: argparse.Namespace) -> None:
    results: dict[str, Any] = {}
    for key in CORE_DATASET_KEYS:
        try:
            registry_entry, response = fetch_dataset(key, args.max_rows_per_dataset, None)
            results[key] = cache_rows(
                dataset_key=key,
                rows=response.rows,
                source_name=str(registry_entry.get("name", key)),
                source_url=response.source_url or str(registry_entry.get("landing_page", "")),
                cache_scope="national_public_rows",
                notes="Cached by cache-core. Public opportunity data only.",
                overwrite=args.overwrite,
            )
            results[key]["api_meta"] = response.meta
        except Exception as exc:
            results[key] = {"status": "failed", "error": str(exc)}
    print_json({"results": results})


def command_list_cache(args: argparse.Namespace) -> None:
    print_json({"cached_datasets": list_cached_datasets()})


def command_query_cache(args: argparse.Namespace) -> None:
    status = cache_status(args.dataset_key)
    if not status:
        raise SystemExit(f"Dataset {args.dataset_key} is not cached yet.")
    filters = parse_filter_pairs(args.filter)
    rows = load_cached_rows(args.dataset_key, limit=args.scan_limit, keywords=args.keyword)
    rows = filter_rows(rows, filters=filters, contains=not args.exact)
    offset = max(0, args.offset)
    limit = max(1, min(args.limit, 5000))
    print_json(
        {
            "dataset_key": args.dataset_key,
            "cache_status": status,
            "filters": filters or {},
            "keywords": args.keyword or [],
            "total_matching_rows": len(rows),
            "rows": rows[offset : offset + limit],
        }
    )


def build_parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(description="CMS Public Market Intelligence MCP admin CLI")
    sub = parser.add_subparsers(dest="command", required=True)

    doctor = sub.add_parser("doctor", help="Show local environment and registry status.")
    doctor.add_argument("--live", action="store_true", help="Run a one row public API smoke test.")
    doctor.set_defaults(func=command_doctor)

    cache = sub.add_parser("cache", help="Download and cache one national public dataset.")
    cache.add_argument("dataset_key")
    cache.add_argument("--max-rows", type=int, default=DEFAULT_MAX_ROWS)
    cache.add_argument("--keyword", action="append", default=None)
    cache.add_argument("--overwrite", action="store_true")
    cache.set_defaults(func=command_cache)

    cache_core = sub.add_parser("cache-core", help="Download and cache the core national public datasets.")
    cache_core.add_argument("--max-rows-per-dataset", type=int, default=DEFAULT_MAX_ROWS)
    cache_core.add_argument("--overwrite", action="store_true")
    cache_core.set_defaults(func=command_cache_core)

    list_cache = sub.add_parser("list-cache", help="List local national cache contents.")
    list_cache.set_defaults(func=command_list_cache)

    query_cache = sub.add_parser("query-cache", help="Filter a cached national public dataset.")
    query_cache.add_argument("dataset_key")
    query_cache.add_argument("--filter", action="append", help="Filter as key=value. Repeat for multiple filters.")
    query_cache.add_argument("--keyword", action="append", default=None)
    query_cache.add_argument("--limit", type=int, default=100)
    query_cache.add_argument("--offset", type=int, default=0)
    query_cache.add_argument("--scan-limit", type=int, default=250000)
    query_cache.add_argument("--exact", action="store_true", help="Use exact matching instead of contains matching.")
    query_cache.set_defaults(func=command_query_cache)
    return parser


def main(argv: list[str] | None = None) -> None:
    parser = build_parser()
    args = parser.parse_args(argv)
    try:
        args.func(args)
    except CmsApiError as exc:
        raise SystemExit(f"CMS public API error: {exc}") from exc


if __name__ == "__main__":
    main()
