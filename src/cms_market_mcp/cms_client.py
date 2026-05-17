from __future__ import annotations

import json
import time
import urllib.error
import urllib.parse
import urllib.request
from dataclasses import dataclass
from typing import Any, Iterable

from .config import DEFAULT_TIMEOUT_SECONDS, DEFAULT_USER_AGENT

CMS_DATA_BASE = "https://data.cms.gov/data-api/v1"
PROVIDER_DATA_BASE = "https://data.cms.gov/provider-data/api/1"
NPPES_BASE = "https://npiregistry.cms.hhs.gov/api/"


class CmsApiError(RuntimeError):
    """Raised when a CMS or NPPES public API request fails."""


@dataclass(frozen=True)
class ApiResponse:
    rows: list[dict[str, Any]]
    meta: dict[str, Any]
    source_url: str


def _clean_params(params: dict[str, Any] | None) -> dict[str, Any]:
    cleaned: dict[str, Any] = {}
    for key, value in (params or {}).items():
        if value is None or value == "":
            continue
        cleaned[key] = value
    return cleaned


def _build_url(url: str, params: dict[str, Any] | None = None) -> str:
    params = _clean_params(params)
    if not params:
        return url
    return f"{url}?{urllib.parse.urlencode(params, doseq=True)}"


def _get_json(
    url: str,
    params: dict[str, Any] | None = None,
    timeout: int = DEFAULT_TIMEOUT_SECONDS,
    attempts: int = 3,
) -> tuple[dict[str, Any] | list[Any], str]:
    full_url = _build_url(url, params)
    last_error: Exception | None = None
    for attempt in range(1, max(1, attempts) + 1):
        request = urllib.request.Request(full_url, headers={"User-Agent": DEFAULT_USER_AGENT})
        try:
            with urllib.request.urlopen(request, timeout=timeout) as response:
                payload = response.read().decode("utf-8")
                return json.loads(payload), full_url
        except urllib.error.HTTPError as exc:
            body = exc.read().decode("utf-8", errors="replace")[:1500]
            if 400 <= exc.code < 500:
                raise CmsApiError(f"Public API returned HTTP {exc.code}: {body}") from exc
            last_error = exc
        except urllib.error.URLError as exc:
            last_error = exc
        except json.JSONDecodeError as exc:
            raise CmsApiError(f"Public API did not return JSON from {full_url}") from exc
        if attempt < attempts:
            time.sleep(0.3 * attempt)
    raise CmsApiError(f"Could not reach public API after {attempts} attempts: {last_error}")


def rows_from_cms_payload(payload: dict[str, Any] | list[Any]) -> tuple[list[dict[str, Any]], dict[str, Any]]:
    if isinstance(payload, list):
        return [row for row in payload if isinstance(row, dict)], {"shape": "list"}

    if "data" in payload and isinstance(payload.get("data"), list):
        meta = payload.get("meta", {}) if isinstance(payload.get("meta"), dict) else {}
        headers = meta.get("headers") or []
        data = payload.get("data") or []
        if data and isinstance(data[0], list) and headers:
            rows = [dict(zip(headers, row)) for row in data]
        else:
            rows = [row for row in data if isinstance(row, dict)]
        return rows, meta

    if "results" in payload and isinstance(payload.get("results"), list):
        rows = [row for row in payload.get("results", []) if isinstance(row, dict)]
        return rows, {k: v for k, v in payload.items() if k != "results"}

    if "result" in payload and isinstance(payload.get("result"), list):
        rows = [row for row in payload.get("result", []) if isinstance(row, dict)]
        return rows, {k: v for k, v in payload.items() if k != "result"}

    return [], {"raw_payload_keys": list(payload.keys()) if isinstance(payload, dict) else []}


def _normalize_filter_text(value: Any) -> str:
    text = " ".join(str(value or "").lower().replace("_", " ").replace("-", " ").split())
    replacements = {
        "prvdr": "provider",
        "org": "organization",
        "dschrgs": "discharges",
        "abrvtn": "abbreviation",
        "rndrng": "rendering",
        "zip cd": "zip code",
    }
    for source, target in replacements.items():
        text = text.replace(source, target)
    return text



def _pick_filter_column(wanted_key: str, normalized_columns: dict[str, str]) -> str | None:
    exact = normalized_columns.get(wanted_key)
    if exact is not None:
        return exact
    candidates: list[tuple[int, str]] = []
    for normalized_key, original_key in normalized_columns.items():
        if wanted_key in normalized_key or normalized_key in wanted_key:
            score = 1
            if wanted_key == "provider" and ("name" in normalized_key or "organization" in normalized_key):
                score += 5
            if wanted_key == "provider" and any(term in normalized_key for term in ["state", "city", "zip", "county", "address", "phone", "ccn"]):
                score -= 4
            if wanted_key == "state" and "state" in normalized_key:
                score += 5
            if wanted_key == "city" and "city" in normalized_key:
                score += 5
            if wanted_key == "county" and "county" in normalized_key:
                score += 5
            if wanted_key in ["zip", "zip code"] and "zip" in normalized_key:
                score += 5
            if wanted_key == "ccn" and "ccn" in normalized_key:
                score += 5
            candidates.append((score, original_key))
    if not candidates:
        return None
    candidates.sort(key=lambda item: item[0], reverse=True)
    return candidates[0][1] if candidates[0][0] > 0 else None

def local_filter_rows(
    rows: Iterable[dict[str, Any]],
    filters: dict[str, Any] | None = None,
    contains: bool = True,
) -> list[dict[str, Any]]:
    if not filters:
        return list(rows)
    wanted = {_normalize_filter_text(k): v for k, v in filters.items() if v not in (None, "")}
    filtered: list[dict[str, Any]] = []
    for row in rows:
        normalized_columns = {_normalize_filter_text(k): k for k in row.keys()}
        keep = True
        for wanted_key, expected in wanted.items():
            actual_key = _pick_filter_column(wanted_key, normalized_columns)
            if actual_key is None:
                keep = False
                break
            actual_text = _normalize_filter_text(row.get(actual_key))
            expected_text = _normalize_filter_text(expected)
            if contains:
                if expected_text not in actual_text:
                    keep = False
                    break
            elif expected_text != actual_text:
                keep = False
                break
        if keep:
            filtered.append(row)
    return filtered


def cms_data_query(
    dataset_uuid: str,
    columns: list[str] | None = None,
    keywords: list[str] | None = None,
    limit: int = 100,
    offset: int = 0,
    sort_by: str | None = None,
    sort_order: str = "ASC",
    filters: dict[str, Any] | None = None,
    use_viewer: bool = True,
) -> ApiResponse:
    endpoint = "data-viewer" if use_viewer else "data"
    url = f"{CMS_DATA_BASE}/dataset/{dataset_uuid}/{endpoint}"
    params: dict[str, Any] = {
        "size": max(1, min(int(limit), 1000)),
        "offset": max(0, int(offset)),
    }
    if columns:
        params["column"] = columns
    if keywords:
        params["keyword"] = keywords
    if sort_by:
        params["sort_by"] = sort_by
        params["sort_order"] = sort_order.upper() if sort_order else "ASC"
    payload, source_url = _get_json(url, params)
    rows, meta = rows_from_cms_payload(payload)
    raw_rows_returned = len(rows)
    rows = local_filter_rows(rows, filters, contains=True)
    if isinstance(meta, dict):
        meta = dict(meta)
        meta["_raw_rows_returned_before_local_filter"] = raw_rows_returned
        meta["_rows_returned_after_local_filter"] = len(rows)
    return ApiResponse(rows=rows, meta=meta, source_url=source_url)


def cms_data_paginated(
    dataset_uuid: str,
    keywords: list[str] | None = None,
    filters: dict[str, Any] | None = None,
    max_rows: int = 5000,
    page_size: int = 1000,
) -> ApiResponse:
    all_rows: list[dict[str, Any]] = []
    last_meta: dict[str, Any] = {}
    last_url = ""
    offset = 0
    page_size = max(1, min(int(page_size), 1000))
    max_rows = max(1, int(max_rows))
    while len(all_rows) < max_rows:
        response = cms_data_query(
            dataset_uuid=dataset_uuid,
            keywords=keywords,
            filters=filters,
            limit=page_size,
            offset=offset,
            use_viewer=True,
        )
        all_rows.extend(response.rows)
        last_meta = response.meta
        last_url = response.source_url
        returned = int(
            last_meta.get("_raw_rows_returned_before_local_filter")
            or last_meta.get("size", len(response.rows))
            or len(response.rows)
        )
        total = int(last_meta.get("total_rows", 0) or 0)
        if returned == 0 or (total and offset + page_size >= total):
            break
        offset += page_size
        time.sleep(0.05)
    return ApiResponse(rows=all_rows[:max_rows], meta=last_meta, source_url=last_url)


def cms_data_metadata(dataset_uuid: str) -> ApiResponse:
    candidate_urls = [
        f"{CMS_DATA_BASE}/dataset/{dataset_uuid}/metadata",
        f"{CMS_DATA_BASE}/dataset/{dataset_uuid}",
    ]
    last_error: Exception | None = None
    for url in candidate_urls:
        try:
            payload, source_url = _get_json(url)
            rows, meta = rows_from_cms_payload(payload)
            if not rows and isinstance(payload, dict):
                rows = [payload]
            return ApiResponse(rows=rows, meta=meta, source_url=source_url)
        except CmsApiError as exc:
            last_error = exc
    raise CmsApiError(f"Could not retrieve CMS dataset metadata: {last_error}")


def provider_data_query(
    dataset_id: str,
    limit: int = 100,
    offset: int = 0,
    filters: dict[str, Any] | None = None,
) -> ApiResponse:
    params = {"limit": max(1, min(int(limit), 1000)), "offset": max(0, int(offset))}
    candidate_urls = [
        f"{PROVIDER_DATA_BASE}/datastore/query/{dataset_id}/0",
        f"{PROVIDER_DATA_BASE}/datastore/query/{dataset_id}",
    ]
    last_error: Exception | None = None
    for url in candidate_urls:
        try:
            payload, source_url = _get_json(url, params)
            rows, meta = rows_from_cms_payload(payload)
            raw_rows_returned = len(rows)
            rows = local_filter_rows(rows, filters, contains=True)
            if isinstance(meta, dict):
                meta = dict(meta)
                meta["_raw_rows_returned_before_local_filter"] = raw_rows_returned
                meta["_rows_returned_after_local_filter"] = len(rows)
            return ApiResponse(rows=rows, meta=meta, source_url=source_url)
        except CmsApiError as exc:
            last_error = exc
    raise CmsApiError(f"Could not query Provider Data Catalog dataset {dataset_id}: {last_error}")


def provider_data_metadata(dataset_id: str) -> ApiResponse:
    url = f"{PROVIDER_DATA_BASE}/metastore/schemas/dataset/items/{dataset_id}"
    payload, source_url = _get_json(url)
    rows, meta = rows_from_cms_payload(payload)
    if not rows and isinstance(payload, dict):
        rows = [payload]
    return ApiResponse(rows=rows, meta=meta, source_url=source_url)


def nppes_lookup(
    number: str | None = None,
    first_name: str | None = None,
    last_name: str | None = None,
    organization_name: str | None = None,
    city: str | None = None,
    state: str | None = None,
    postal_code: str | None = None,
    taxonomy_description: str | None = None,
    enumeration_type: str | None = None,
    limit: int = 20,
    skip: int = 0,
) -> ApiResponse:
    params: dict[str, Any] = {
        "version": "2.1",
        "number": number,
        "first_name": first_name,
        "last_name": last_name,
        "organization_name": organization_name,
        "city": city,
        "state": state,
        "postal_code": postal_code,
        "taxonomy_description": taxonomy_description,
        "enumeration_type": enumeration_type,
        "limit": max(1, min(int(limit), 200)),
        "skip": max(0, int(skip)),
    }
    payload, source_url = _get_json(NPPES_BASE, params)
    rows = payload.get("results", []) if isinstance(payload, dict) else []
    meta = {k: v for k, v in payload.items() if k != "results"} if isinstance(payload, dict) else {}
    return ApiResponse(rows=rows, meta=meta, source_url=source_url)


def provider_data_paginated(
    dataset_id: str,
    filters: dict[str, Any] | None = None,
    max_rows: int = 5000,
    page_size: int = 1000,
) -> ApiResponse:
    all_rows: list[dict[str, Any]] = []
    last_meta: dict[str, Any] = {}
    last_url = ""
    offset = 0
    page_size = max(1, min(int(page_size), 1000))
    max_rows = max(1, int(max_rows))
    while len(all_rows) < max_rows:
        response = provider_data_query(dataset_id, filters=filters, limit=page_size, offset=offset)
        all_rows.extend(response.rows)
        last_meta = response.meta
        last_url = response.source_url
        returned = int(last_meta.get("_raw_rows_returned_before_local_filter") or len(response.rows))
        count = int(last_meta.get("count", 0) or 0)
        if returned == 0 or (count and offset + page_size >= count):
            break
        offset += page_size
        time.sleep(0.05)
    return ApiResponse(rows=all_rows[:max_rows], meta=last_meta, source_url=last_url)
