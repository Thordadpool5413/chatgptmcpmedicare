# National Cache Workflow

The server is designed to download national public CMS datasets once, store them in SQLite, and filter them later.

## Why cache first

Public CMS APIs are useful, but national searches can require paging through many rows. Caching makes repeated analysis faster and keeps filtering consistent.

## Cache all core datasets

```bash
cms-market-admin cache-core --max-rows-per-dataset 250000
```

For a small first test:

```bash
cms-market-admin cache-core --max-rows-per-dataset 5000
```

## Cache one dataset

```bash
cms-market-admin cache pac_hospice_latest --max-rows 250000 --overwrite
```

Available cacheable dataset keys:

```text
pac_hospice_latest
inpatient_provider_service_latest
hospice_provider_data
hospice_general_information
nursing_home_provider_information
```

## List cached datasets

```bash
cms-market-admin list-cache
```

## Query cached data

```bash
cms-market-admin query-cache hospice_provider_data --filter State=FL --limit 25
```

```bash
cms-market-admin query-cache nursing_home_provider_information --filter State=FL --filter City=Melbourne --limit 25
```

```bash
cms-market-admin query-cache inpatient_provider_service_latest --keyword sepsis --filter State=FL --limit 25
```

## Recommended production cache strategy

Start with `5000` rows per dataset to test install and filtering.

Move to `250000` rows per dataset after local tests pass.

Use a stable cache path by setting:

```bash
export CMS_MARKET_CACHE_PATH=/absolute/path/to/cms_market_cache.sqlite3
```

Do not commit `.cache` or internal admissions data to Git.
