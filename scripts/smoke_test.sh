#!/usr/bin/env bash
set -euo pipefail
. .venv/bin/activate
python -m pytest
cms-market-admin doctor
cms-market-admin list-cache
