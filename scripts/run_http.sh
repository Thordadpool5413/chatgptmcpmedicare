#!/usr/bin/env bash
set -euo pipefail
. .venv/bin/activate
export CMS_MARKET_MCP_HOST="${CMS_MARKET_MCP_HOST:-127.0.0.1}"
export CMS_MARKET_MCP_PORT="${CMS_MARKET_MCP_PORT:-8000}"
cms-market-mcp --transport streamable-http
