# Deployment Options

## Option 1: Local MCP client

Use stdio mode for clients such as Claude Desktop or local developer tools.

```bash
cms-market-mcp --transport stdio
```

## Option 2: Local HTTP server

Use streamable HTTP for ChatGPT app testing or remote MCP clients.

```bash
cms-market-mcp --transport streamable-http
```

Endpoint:

```text
http://127.0.0.1:8000/mcp
```

## Option 3: Docker

```bash
docker compose up --build
```

Endpoint:

```text
http://127.0.0.1:8000/mcp
```

## Option 4: HTTPS tunnel

Run the local HTTP server, then expose port 8000 through ngrok or Cloudflare Tunnel.

ChatGPT needs the HTTPS URL ending in `/mcp`.

## Option 5: Cloud host

Deploy the Docker image to a host that supports long running HTTP streaming and TLS. Good examples include a small VM, Render, Railway, Fly.io, Azure Container Apps, Google Cloud Run with streaming support, or AWS App Runner.

For production, set:

```bash
CMS_MARKET_MCP_HOST=0.0.0.0
CMS_MARKET_MCP_PORT=8000
CMS_MARKET_CACHE_PATH=/app/.cache/cms_market_cache.sqlite3
```
