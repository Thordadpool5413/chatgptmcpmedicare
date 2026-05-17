#!/usr/bin/env bash
set -euo pipefail
. .venv/bin/activate
cms-market-admin cache-core --max-rows-per-dataset "${CMS_MARKET_CACHE_MAX_ROWS:-250000}"
