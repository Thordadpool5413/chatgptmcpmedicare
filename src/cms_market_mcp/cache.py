from __future__ import annotations

import json
import sqlite3
from datetime import datetime, timezone
from pathlib import Path
from typing import Any, Iterable

from .config import DEFAULT_CACHE_PATH


def utc_now() -> str:
    return datetime.now(timezone.utc).isoformat(timespec="seconds")


def normalize_text(value: Any) -> str:
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



def pick_filter_column(wanted_key: str, normalized_columns: dict[str, str]) -> str | None:
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

def row_search_text(row: dict[str, Any]) -> str:
    parts: list[str] = []
    for key, value in row.items():
        parts.append(str(key))
        parts.append(str(value))
    return normalize_text(" ".join(parts))


def connect_cache(path: str | Path | None = None) -> sqlite3.Connection:
    db_path = Path(path or DEFAULT_CACHE_PATH).expanduser().resolve()
    db_path.parent.mkdir(parents=True, exist_ok=True)
    conn = sqlite3.connect(db_path)
    conn.row_factory = sqlite3.Row
    conn.execute("PRAGMA journal_mode=WAL")
    conn.execute("PRAGMA synchronous=NORMAL")
    init_cache(conn)
    return conn


def init_cache(conn: sqlite3.Connection) -> None:
    conn.execute(
        """
        CREATE TABLE IF NOT EXISTS dataset_cache_meta (
            dataset_key TEXT PRIMARY KEY,
            source_name TEXT,
            source_url TEXT,
            row_count INTEGER NOT NULL,
            cached_at TEXT NOT NULL,
            cache_scope TEXT NOT NULL,
            notes TEXT
        )
        """
    )
    conn.execute(
        """
        CREATE TABLE IF NOT EXISTS dataset_cache_rows (
            dataset_key TEXT NOT NULL,
            row_index INTEGER NOT NULL,
            row_json TEXT NOT NULL,
            search_text TEXT NOT NULL,
            PRIMARY KEY (dataset_key, row_index)
        )
        """
    )
    conn.execute("CREATE INDEX IF NOT EXISTS idx_cache_rows_dataset ON dataset_cache_rows(dataset_key)")
    conn.execute("CREATE INDEX IF NOT EXISTS idx_cache_rows_search ON dataset_cache_rows(dataset_key, search_text)")
    conn.commit()


def cache_rows(
    dataset_key: str,
    rows: Iterable[dict[str, Any]],
    source_name: str = "",
    source_url: str = "",
    cache_scope: str = "national",
    notes: str = "",
    overwrite: bool = True,
    cache_path: str | Path | None = None,
) -> dict[str, Any]:
    rows_list = list(rows)
    with connect_cache(cache_path) as conn:
        if overwrite:
            conn.execute("DELETE FROM dataset_cache_rows WHERE dataset_key = ?", (dataset_key,))
        else:
            existing = conn.execute(
                "SELECT COUNT(*) AS row_count FROM dataset_cache_rows WHERE dataset_key = ?",
                (dataset_key,),
            ).fetchone()["row_count"]
            if existing:
                return {
                    "dataset_key": dataset_key,
                    "row_count": existing,
                    "cache_path": str(Path(cache_path or DEFAULT_CACHE_PATH).expanduser().resolve()),
                    "status": "kept_existing_cache",
                }
        conn.executemany(
            """
            INSERT OR REPLACE INTO dataset_cache_rows(dataset_key, row_index, row_json, search_text)
            VALUES (?, ?, ?, ?)
            """,
            [
                (
                    dataset_key,
                    index,
                    json.dumps(row, ensure_ascii=False, sort_keys=True),
                    row_search_text(row),
                )
                for index, row in enumerate(rows_list)
            ],
        )
        conn.execute(
            """
            INSERT OR REPLACE INTO dataset_cache_meta(dataset_key, source_name, source_url, row_count, cached_at, cache_scope, notes)
            VALUES (?, ?, ?, ?, ?, ?, ?)
            """,
            (dataset_key, source_name, source_url, len(rows_list), utc_now(), cache_scope, notes),
        )
        conn.commit()
    return {
        "dataset_key": dataset_key,
        "row_count": len(rows_list),
        "cache_scope": cache_scope,
        "cache_path": str(Path(cache_path or DEFAULT_CACHE_PATH).expanduser().resolve()),
        "status": "cached",
    }


def list_cached_datasets(cache_path: str | Path | None = None) -> list[dict[str, Any]]:
    with connect_cache(cache_path) as conn:
        rows = conn.execute(
            """
            SELECT dataset_key, source_name, source_url, row_count, cached_at, cache_scope, notes
            FROM dataset_cache_meta
            ORDER BY cached_at DESC
            """
        ).fetchall()
    return [dict(row) for row in rows]


def cache_status(dataset_key: str, cache_path: str | Path | None = None) -> dict[str, Any] | None:
    with connect_cache(cache_path) as conn:
        row = conn.execute(
            """
            SELECT dataset_key, source_name, source_url, row_count, cached_at, cache_scope, notes
            FROM dataset_cache_meta
            WHERE dataset_key = ?
            """,
            (dataset_key,),
        ).fetchone()
    return dict(row) if row else None


def load_cached_rows(
    dataset_key: str,
    limit: int = 1000,
    offset: int = 0,
    keywords: list[str] | None = None,
    cache_path: str | Path | None = None,
) -> list[dict[str, Any]]:
    limit = max(1, min(int(limit), 250000))
    offset = max(0, int(offset))
    keywords = [normalize_text(word) for word in (keywords or []) if normalize_text(word)]
    with connect_cache(cache_path) as conn:
        if keywords:
            clauses = " AND ".join(["search_text LIKE ?" for _ in keywords])
            params: list[Any] = [dataset_key] + [f"%{word}%" for word in keywords] + [limit, offset]
            sql = f"""
                SELECT row_json
                FROM dataset_cache_rows
                WHERE dataset_key = ? AND {clauses}
                ORDER BY row_index
                LIMIT ? OFFSET ?
            """
            rows = conn.execute(sql, params).fetchall()
        else:
            rows = conn.execute(
                """
                SELECT row_json
                FROM dataset_cache_rows
                WHERE dataset_key = ?
                ORDER BY row_index
                LIMIT ? OFFSET ?
                """,
                (dataset_key, limit, offset),
            ).fetchall()
    return [json.loads(row["row_json"]) for row in rows]


def filter_rows(rows: Iterable[dict[str, Any]], filters: dict[str, Any] | None = None, contains: bool = True) -> list[dict[str, Any]]:
    if not filters:
        return list(rows)
    wanted = {normalize_text(key): value for key, value in filters.items() if value not in (None, "")}
    filtered: list[dict[str, Any]] = []
    for row in rows:
        normalized_columns = {normalize_text(key): key for key in row.keys()}
        keep = True
        for wanted_key, expected in wanted.items():
            actual_key = pick_filter_column(wanted_key, normalized_columns)
            if actual_key is None:
                keep = False
                break
            actual_text = normalize_text(row.get(actual_key))
            expected_text = normalize_text(expected)
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
