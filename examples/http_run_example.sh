#!/usr/bin/env bash
set -euo pipefail
python -m cms_market_mcp.server --transport streamable-http
