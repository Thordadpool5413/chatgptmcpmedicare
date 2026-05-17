from __future__ import annotations

import os
from pathlib import Path

MODULE_DIR = Path(__file__).resolve().parent
PROJECT_ROOT = Path(__file__).resolve().parents[2]
REGISTRY_PATH = PROJECT_ROOT / "data" / "dataset_registry.json"
DEFAULT_CACHE_PATH = Path(os.getenv("CMS_MARKET_CACHE_PATH", PROJECT_ROOT / ".cache" / "cms_market_cache.sqlite3"))
DEFAULT_USER_AGENT = os.getenv("CMS_MARKET_USER_AGENT", "cms-public-market-mcp/0.3")
DEFAULT_TIMEOUT_SECONDS = int(os.getenv("CMS_MARKET_TIMEOUT_SECONDS", "30"))
DEFAULT_MAX_ROWS = int(os.getenv("CMS_MARKET_DEFAULT_MAX_ROWS", "5000"))

DEFAULT_MCP_HOST = os.getenv("CMS_MARKET_MCP_HOST", "127.0.0.1")
DEFAULT_MCP_PORT = int(os.getenv("CMS_MARKET_MCP_PORT", "8000"))
