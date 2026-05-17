# ChatGPT App Setup

This project is built as a remote MCP server that can be connected to ChatGPT as a custom app when your ChatGPT plan and workspace settings allow custom MCP apps.

## Reality check

ChatGPT can connect to custom MCP apps, but the server must be reachable through a public HTTPS endpoint. A local address such as `http://127.0.0.1:8000/mcp` works for local MCP clients, but ChatGPT cannot reach your laptop unless you expose it with an HTTPS tunnel or deploy it to a cloud host.

Current OpenAI terminology uses apps for this experience. Older documentation and UI may still mention connectors.

## Local run

```bash
python -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
pip install -e .
python -m pytest
cms-market-mcp --transport streamable-http
```

Windows activation:

```powershell
.venv\Scripts\Activate.ps1
```

Local MCP endpoint:

```text
http://127.0.0.1:8000/mcp
```

## HTTPS tunnel for testing

Use ngrok, Cloudflare Tunnel, or another HTTPS tunnel.

Example with ngrok:

```bash
ngrok http 8000
```

Your ChatGPT app endpoint should be the HTTPS tunnel URL plus `/mcp`.

Example:

```text
https://your-tunnel-domain.ngrok-free.app/mcp
```

## ChatGPT app metadata

Name:

```text
CMS Public Market Intelligence
```

Description:

```text
Search and analyze free public CMS healthcare market data nationally, then filter by state, county, city, ZIP code, provider, CCN, NPI, hospital opportunity, nursing home opportunity, hospice market share proxies, hospice public quality data, and optional internal admissions CSV gap analysis. This app does not provide exact referral leakage unless the connected internal admissions data supports it.
```

Tool approval guidance:

```text
Read only public CMS data and local CSV analysis. Does not write to CMS systems. Does not access restricted claims, CCW, VRDC, CASPER, iQIES, raw OASIS, raw HOPE, or beneficiary level files.
```

## Recommended first ChatGPT prompts

```text
List the free data sources in this MCP app.
```

```text
Cache the core national datasets.
```

```text
List cached national datasets.
```

```text
Run national hospice market share proxy and show the top providers nationally.
```

```text
Filter national hospital hospice opportunity to Florida.
```

```text
Filter national nursing home opportunity to Florida.
```

```text
Validate my internal admissions CSV.
```

```text
Compare my internal admissions against hospital opportunity and show the biggest referral gaps.
```

## Important plan limitation

Custom MCP apps are controlled by ChatGPT product plan and workspace settings. If your account does not show developer mode or custom app creation, you can still use the server with Claude Desktop, Cursor, or another MCP client while you wait for ChatGPT access or deploy through a workspace that supports it.
