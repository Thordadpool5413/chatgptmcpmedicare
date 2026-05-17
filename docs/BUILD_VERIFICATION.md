# Build Verification

This package was verified locally with:

```bash
python -m pytest -q
```

Result:

```text
14 passed
```

The package entry points were also checked:

```bash
cms-market-admin doctor
cms-market-mcp --help
```

Live CMS API calls were not validated inside the build container because the container environment could not resolve external domains. The server code uses public CMS and NPPES HTTP endpoints and should run live from a normal machine or hosted environment with internet access.

Recommended first live smoke test after setup:

```bash
cms-market-admin doctor --live
```

Recommended first small cache test:

```bash
cms-market-admin cache hospice_provider_data --max-rows 100 --overwrite
cms-market-admin list-cache
cms-market-admin query-cache hospice_provider_data --filter State=FL --limit 10
```
