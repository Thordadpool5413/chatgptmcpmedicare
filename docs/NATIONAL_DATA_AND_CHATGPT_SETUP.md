# National data and ChatGPT setup

This project is built to work nationally first, then filter down after the national public datasets are cached locally.

## National first workflow

Run the MCP server locally, then call:

```text
cache_core_national_datasets
```

This downloads the core public CMS datasets into a local SQLite cache. Once cached, use:

```text
query_cached_national_dataset
national_hospice_market_share_proxy
national_hospital_hospice_opportunity
national_nursing_home_opportunity
```

The core design is:

1. Download national public data.
2. Store it locally in SQLite.
3. Filter later by state, county, city, ZIP, provider name, CCN, keywords, and available dataset columns.
4. Add your internal admissions CSV as the truth layer for actual referral source history.

## What this does not unlock

The cache does not create exact hospital to hospice referral flow. It stores free public CMS rows. Actual referral source data still comes from your internal admissions data, approved restricted claims access, or paid claims analytics.

## Run as local HTTP for ChatGPT testing

```bash
python -m cms_market_mcp.server --transport streamable-http
```

By default this exposes:

```text
http://127.0.0.1:8000/mcp
```

ChatGPT requires a public HTTPS endpoint for remote MCP testing. For local development, expose your local server with a tunnel such as ngrok or Cloudflare Tunnel and use the public HTTPS URL ending in `/mcp`.

Example connector URL:

```text
https://your-tunnel.example/mcp
```

## ChatGPT app metadata

Suggested connector name:

```text
CMS Public Market Intelligence
```

Suggested description:

```text
Search and analyze free public CMS healthcare market data nationally, then filter by state, county, city, ZIP, provider, CCN, NPI, hospital opportunity, SNF opportunity, hospice market share proxies, and optional internal admissions CSV gap analysis. Does not provide exact referral leakage unless internal admissions data supports it.
```

## ChatGPT setup steps

1. Turn on developer mode in ChatGPT if your plan and workspace allow it.
2. Run this server using streamable HTTP.
3. Expose it through HTTPS.
4. In ChatGPT, go to Settings, then Connectors or Apps, then Create.
5. Add the public `/mcp` endpoint.
6. Refresh tools after each code change.

## Recommended first prompts inside ChatGPT

```text
Use CMS Public Market Intelligence to list available free national datasets.
```

```text
Cache the core national datasets.
```

```text
Show cached national datasets.
```

```text
Run national hospice market share proxy and show the top providers.
```

```text
Filter national hospital hospice opportunity to Florida.
```

```text
Filter nursing home opportunity to ZIP code 32937.
```
