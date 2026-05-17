#!/usr/bin/env bash
set -euo pipefail
. .venv/bin/activate
cms-market-mcp --transport stdio
