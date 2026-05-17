FROM python:3.12-slim

WORKDIR /app
ENV PYTHONDONTWRITEBYTECODE=1
ENV PYTHONUNBUFFERED=1
ENV CMS_MARKET_MCP_HOST=0.0.0.0
ENV CMS_MARKET_MCP_PORT=8000
ENV CMS_MARKET_CACHE_PATH=/app/.cache/cms_market_cache.sqlite3

COPY pyproject.toml README.md requirements.txt ./
COPY src ./src
COPY data ./data
COPY docs ./docs
COPY examples ./examples
COPY scripts ./scripts

RUN pip install --no-cache-dir --upgrade pip \
    && pip install --no-cache-dir -r requirements.txt \
    && pip install --no-cache-dir -e .

EXPOSE 8000
CMD ["cms-market-mcp", "--transport", "streamable-http"]
