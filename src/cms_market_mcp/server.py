from __future__ import annotations

import argparse
import json
import os
from pathlib import Path
from typing import Any

from mcp.server.fastmcp import FastMCP

from .analysis import (
    HOSPICE_RELEVANT_DRG_TERMS,
    compute_market_share,
    load_csv_rows,
    match_internal_accounts_to_public_opportunity,
    score_hospital_rows,
    score_nursing_home_rows,
    summarize_internal_admissions_csv,
    validate_admissions_csv,
)
from .cms_client import (
    cms_data_metadata,
    cms_data_paginated,
    cms_data_query,
    nppes_lookup,
    provider_data_metadata,
    provider_data_paginated,
    provider_data_query,
)
from .config import DEFAULT_MAX_ROWS, DEFAULT_MCP_HOST, DEFAULT_MCP_PORT, PROJECT_ROOT
from .registry import dataset_uuid, load_registry, provider_dataset_id

from .cache import (
    cache_rows,
    cache_status,
    filter_rows as filter_cached_rows,
    list_cached_datasets,
    load_cached_rows,
)

mcp = FastMCP("CMS Public Market Intelligence", json_response=True, host=DEFAULT_MCP_HOST, port=DEFAULT_MCP_PORT)

DATA_ACCESS_REALITY = {
    "free_public_now": [
        "CMS Data API public datasets",
        "CMS Provider Data Catalog datasets",
        "NPPES NPI Registry API",
        "PAC hospice utilization and payment public use files",
        "Medicare inpatient hospital provider and service public datasets",
        "Hospice and nursing home public quality datasets",
        "Your own internal admissions CSV when you export it locally",
    ],
    "not_free_public": [
        "Exact hospital to hospice referral flow",
        "Exact physician to hospice referral flow",
        "Beneficiary level Medicare claims",
        "CCW research identifiable files",
        "VRDC access",
        "CASPER or iQIES restricted provider reports",
        "Raw patient level OASIS or HOPE assessment files",
    ],
    "sales_strategy_translation": "The free build can rank opportunity, estimate market share, compare competitors, and expose gaps against your internal admissions. It cannot prove exact referral leakage without internal data, approved restricted access, or paid claims intelligence.",
}


def _limit_rows(rows: list[dict[str, Any]], limit: int) -> list[dict[str, Any]]:
    return rows[: max(1, min(int(limit), 5000))]


def _filters_from(**kwargs: str | None) -> dict[str, str] | None:
    filters = {key: value for key, value in kwargs.items() if value not in (None, "")}
    return filters or None


@mcp.resource("cms-market://registry")
def registry_resource() -> str:
    """Return the built in public dataset registry."""
    return json.dumps(load_registry(), indent=2)


@mcp.resource("cms-market://data-access-reality")
def data_access_reality_resource() -> str:
    """Return the free versus restricted data matrix."""
    return json.dumps(DATA_ACCESS_REALITY, indent=2)


@mcp.resource("cms-market://admissions-template")
def admissions_template_resource() -> str:
    """Return the recommended internal admissions CSV headers and example rows."""
    path = PROJECT_ROOT / "examples" / "admissions_template.csv"
    return path.read_text(encoding="utf-8")


@mcp.prompt()
def market_intelligence_brief_prompt(market: str, branch: str = "your branch") -> str:
    """Create a reusable prompt for a hospice market intelligence brief."""
    return (
        f"Build a hospice market intelligence brief for {market} using the CMS Public Market Intelligence MCP. "
        f"Focus on competitor market share proxies, hospital discharge opportunity, nursing home opportunity, hospice quality positioning, and gaps against {branch}'s internal admissions data if a CSV is available. "
        "Clearly separate public opportunity signals from actual referral proof."
    )


@mcp.prompt()
def referral_account_plan_prompt(account_name: str, account_type: str = "referral account") -> str:
    """Create a reusable prompt for turning public and internal data into an account plan."""
    return (
        f"Create an account plan for {account_name}, a {account_type}. Use public CMS signals, NPI identity data, quality context, and internal admissions trends if available. "
        "Include opportunity, likely decision makers, relevant hospice education angles, quality based talking points, and next actions. Avoid claiming exact referral leakage unless the internal data proves it."
    )


@mcp.tool()
def list_free_data_sources() -> dict[str, Any]:
    """List the free public data sources wired into this MCP server."""
    return {
        "registry": load_registry(),
        "plain_english_note": DATA_ACCESS_REALITY["sales_strategy_translation"],
    }


@mcp.tool()
def explain_data_access_reality() -> dict[str, Any]:
    """Explain what the server can access for free and what is restricted or paid."""
    return DATA_ACCESS_REALITY


@mcp.tool()
def get_dataset_metadata(dataset_key: str | None = None, dataset_uuid_value: str | None = None, provider_dataset_id_value: str | None = None) -> dict[str, Any]:
    """Get metadata for a registered or directly supplied CMS dataset."""
    if dataset_key:
        registry = load_registry()["datasets"].get(dataset_key, {})
        if registry.get("kind") == "cms_data_api":
            response = cms_data_metadata(str(registry["dataset_uuid"]))
        elif registry.get("kind") == "provider_data_catalog_api":
            response = provider_data_metadata(str(registry["provider_dataset_id"]))
        else:
            return {"dataset_key": dataset_key, "registry_entry": registry, "note": "This source does not expose metadata through a CMS endpoint."}
    elif dataset_uuid_value:
        response = cms_data_metadata(dataset_uuid_value)
    elif provider_dataset_id_value:
        response = provider_data_metadata(provider_dataset_id_value)
    else:
        raise ValueError("Provide dataset_key, dataset_uuid_value, or provider_dataset_id_value.")
    return {"rows": response.rows, "meta": response.meta, "source_url": response.source_url}


@mcp.tool()
def query_cms_data(
    dataset_uuid_value: str,
    keywords: list[str] | None = None,
    columns: list[str] | None = None,
    filters: dict[str, str] | None = None,
    limit: int = 100,
    offset: int = 0,
) -> dict[str, Any]:
    """Query any public data.cms.gov dataset by UUID."""
    response = cms_data_query(
        dataset_uuid=dataset_uuid_value,
        columns=columns,
        keywords=keywords,
        filters=filters,
        limit=limit,
        offset=offset,
    )
    return {"rows": response.rows, "meta": response.meta, "source_url": response.source_url}


@mcp.tool()
def query_registered_dataset(
    dataset_key: str,
    keywords: list[str] | None = None,
    filters: dict[str, str] | None = None,
    max_rows: int = 1000,
) -> dict[str, Any]:
    """Query a dataset from the built in registry by key."""
    registry_entry = load_registry()["datasets"][dataset_key]
    if registry_entry["kind"] == "cms_data_api":
        response = cms_data_paginated(dataset_uuid(dataset_key), keywords=keywords, filters=filters, max_rows=max_rows)
    elif registry_entry["kind"] == "provider_data_catalog_api":
        response = provider_data_paginated(provider_dataset_id(dataset_key), filters=filters, max_rows=max_rows)
    else:
        raise ValueError(f"Dataset key {dataset_key} is not queryable through a public API in this server.")
    return {"dataset": registry_entry, "rows": response.rows, "meta": response.meta, "source_url": response.source_url}


@mcp.tool()
def query_provider_data_catalog(
    provider_dataset_id_value: str,
    filters: dict[str, str] | None = None,
    limit: int = 100,
    offset: int = 0,
) -> dict[str, Any]:
    """Query a Provider Data Catalog dataset by short id, such as 252m-zfp9."""
    response = provider_data_query(provider_dataset_id_value, filters=filters, limit=limit, offset=offset)
    return {"rows": response.rows, "meta": response.meta, "source_url": response.source_url}


@mcp.tool()
def lookup_npi(
    number: str | None = None,
    first_name: str | None = None,
    last_name: str | None = None,
    organization_name: str | None = None,
    city: str | None = None,
    state: str | None = None,
    postal_code: str | None = None,
    taxonomy_description: str | None = None,
    enumeration_type: str | None = None,
    limit: int = 20,
) -> dict[str, Any]:
    """Look up public NPI records using the official NPPES API."""
    response = nppes_lookup(
        number=number,
        first_name=first_name,
        last_name=last_name,
        organization_name=organization_name,
        city=city,
        state=state,
        postal_code=postal_code,
        taxonomy_description=taxonomy_description,
        enumeration_type=enumeration_type,
        limit=limit,
    )
    return {"rows": response.rows, "meta": response.meta, "source_url": response.source_url}


@mcp.tool()
def search_hospice_public_quality(
    state: str | None = None,
    city: str | None = None,
    provider_name: str | None = None,
    ccn: str | None = None,
    limit: int = 500,
) -> dict[str, Any]:
    """Search public hospice provider quality rows from CMS Provider Data Catalog."""
    filters = _filters_from(State=state, City=city, **{"Provider Name": provider_name, "CMS Certification Number": ccn})
    response = provider_data_paginated(provider_dataset_id("hospice_provider_data"), filters=filters, max_rows=limit)
    return {
        "dataset": "Hospice Provider Data",
        "rows": response.rows,
        "meta": response.meta,
        "source_url": response.source_url,
        "interpretation_note": "These are public quality and provider comparison records. They are not referral source records.",
    }


@mcp.tool()
def hospice_market_share_proxy(
    state: str | None = None,
    provider_name: str | None = None,
    ccn: str | None = None,
    keywords: list[str] | None = None,
    market_column: str | None = None,
    provider_column: str | None = None,
    volume_column: str | None = None,
    max_rows: int = DEFAULT_MAX_ROWS,
) -> dict[str, Any]:
    """Estimate hospice market share from free CMS PAC Hospice public utilization rows."""
    filters = _filters_from(State=state, Provider=provider_name, CCN=ccn)
    response = cms_data_paginated(dataset_uuid("pac_hospice_latest"), keywords=keywords, filters=filters, max_rows=max_rows)
    share = compute_market_share(response.rows, market_column=market_column, provider_column=provider_column, volume_column=volume_column)
    return {
        "dataset": "Medicare Post Acute Care Utilization Hospice",
        "source_url": response.source_url,
        "meta": response.meta,
        "volume_column_used": share.get("volume_column"),
        "provider_column_used": share.get("provider_column"),
        "market_column_used": share.get("market_column"),
        "total_volume_in_returned_rows": share.get("total_volume"),
        "market_totals": share.get("market_totals"),
        "rows": share.get("rows", [])[:max_rows],
        "interpretation_note": "This is market share by public CMS utilization volume from returned rows. It is not exact referral source flow.",
    }


@mcp.tool()
def hospital_hospice_opportunity(
    state: str | None = None,
    city: str | None = None,
    hospital_name: str | None = None,
    ccn: str | None = None,
    drg_terms: list[str] | None = None,
    max_rows: int = DEFAULT_MAX_ROWS,
) -> dict[str, Any]:
    """Rank hospital DRG rows by hospice relevant discharge opportunity."""
    filters = _filters_from(
        Rndrng_Prvdr_State_Abrvtn=state,
        Rndrng_Prvdr_City=city,
        Rndrng_Prvdr_Org_Name=hospital_name,
        Rndrng_Prvdr_CCN=ccn,
    )
    keywords = drg_terms or HOSPICE_RELEVANT_DRG_TERMS
    response = cms_data_paginated(dataset_uuid("inpatient_provider_service_latest"), keywords=keywords, filters=filters, max_rows=max_rows)
    scored = score_hospital_rows(response.rows, terms=drg_terms)
    return {
        "dataset": "Medicare Inpatient Hospitals by Provider and Service",
        "source_url": response.source_url,
        "meta": response.meta,
        "rows": _limit_rows(scored, max_rows),
        "interpretation_note": "This ranks hospital discharge opportunity by hospice relevant DRG terms and discharge volume. It does not prove actual referrals.",
    }


@mcp.tool()
def nursing_home_opportunity(
    state: str | None = None,
    city: str | None = None,
    facility_name: str | None = None,
    max_rows: int = 1000,
) -> dict[str, Any]:
    """Rank public nursing home rows by bed volume and quality pressure opportunity."""
    filters = _filters_from(State=state, **{"City/Town": city, "Provider Name": facility_name})
    response = provider_data_paginated(provider_dataset_id("nursing_home_provider_information"), filters=filters, max_rows=max_rows)
    scored = score_nursing_home_rows(response.rows)
    return {
        "dataset": "Nursing Home Provider Information",
        "source_url": response.source_url,
        "meta": response.meta,
        "rows": _limit_rows(scored, max_rows),
        "interpretation_note": "This is a public opportunity score using available beds and quality pressure. It does not prove actual referrals.",
    }


@mcp.tool()
def validate_internal_admissions_csv(csv_path: str) -> dict[str, Any]:
    """Validate your internal admissions CSV for referral intelligence readiness."""
    return validate_admissions_csv(csv_path)


@mcp.tool()
def summarize_internal_admissions(
    csv_path: str | None = None,
    referral_source_column: str = "referral_source",
    admit_date_column: str = "admit_date",
    payer_column: str = "payer",
    market_column: str = "market",
    marketer_column: str = "marketer",
    referral_source_type_column: str = "referral_source_type",
    admission_status_column: str = "admission_status",
) -> dict[str, Any]:
    """Summarize your own admissions CSV into source, payer, market, marketer, status, and trend intelligence."""
    csv_path = csv_path or os.getenv("CMS_MARKET_INTERNAL_ADMISSIONS_CSV")
    if not csv_path:
        raise ValueError("Provide csv_path or set CMS_MARKET_INTERNAL_ADMISSIONS_CSV.")
    return summarize_internal_admissions_csv(
        path=csv_path,
        referral_source_column=referral_source_column,
        admit_date_column=admit_date_column,
        payer_column=payer_column,
        market_column=market_column,
        marketer_column=marketer_column,
        referral_source_type_column=referral_source_type_column,
        admission_status_column=admission_status_column,
    )


@mcp.tool()
def hospital_referral_gap_analysis(
    csv_path: str,
    state: str | None = None,
    city: str | None = None,
    drg_terms: list[str] | None = None,
    max_rows: int = 1000,
    match_threshold: float = 0.72,
) -> dict[str, Any]:
    """Compare internal admissions against public hospital discharge opportunity to find likely referral gaps."""
    admissions_rows, _ = load_csv_rows(csv_path)
    opportunity = hospital_hospice_opportunity(state=state, city=city, drg_terms=drg_terms, max_rows=max_rows)
    gap = match_internal_accounts_to_public_opportunity(
        admissions_rows=admissions_rows,
        opportunity_rows=opportunity["rows"],
        public_account_column="Rndrng_Prvdr_Org_Name",
        public_score_column="_opportunity_score",
        threshold=match_threshold,
    )
    return {
        "source_url": opportunity.get("source_url"),
        "gap_analysis": gap,
        "interpretation_note": "Highest gap scores are public opportunities with little or no matching internal admissions. This is targeting logic, not proof of competitor referrals.",
    }


@mcp.tool()
def snf_referral_gap_analysis(
    csv_path: str,
    state: str | None = None,
    city: str | None = None,
    max_rows: int = 1000,
    match_threshold: float = 0.72,
) -> dict[str, Any]:
    """Compare internal admissions against public nursing home opportunity to find likely referral gaps."""
    admissions_rows, _ = load_csv_rows(csv_path)
    opportunity = nursing_home_opportunity(state=state, city=city, max_rows=max_rows)
    gap = match_internal_accounts_to_public_opportunity(
        admissions_rows=admissions_rows,
        opportunity_rows=opportunity["rows"],
        public_account_column="Provider Name",
        public_score_column="_snf_opportunity_score",
        threshold=match_threshold,
    )
    return {
        "source_url": opportunity.get("source_url"),
        "gap_analysis": gap,
        "interpretation_note": "Highest gap scores are public opportunities with little or no matching internal admissions. This is targeting logic, not proof of competitor referrals.",
    }


@mcp.tool()
def build_market_intelligence_brief(
    state: str,
    city: str | None = None,
    csv_path: str | None = None,
    max_rows_per_section: int = 50,
) -> dict[str, Any]:
    """Build a compact hospice market intelligence brief from free public data and optional internal admissions."""
    hospice_share = hospice_market_share_proxy(state=state, max_rows=max_rows_per_section)
    hospital_opportunity = hospital_hospice_opportunity(state=state, city=city, max_rows=max_rows_per_section)
    snf_opportunity = nursing_home_opportunity(state=state, city=city, max_rows=max_rows_per_section)
    brief: dict[str, Any] = {
        "market": {"state": state, "city": city},
        "hospice_market_share_proxy": {k: hospice_share[k] for k in hospice_share if k != "rows"} | {"top_rows": hospice_share.get("rows", [])[:10]},
        "hospital_opportunity_top_rows": hospital_opportunity.get("rows", [])[:10],
        "snf_opportunity_top_rows": snf_opportunity.get("rows", [])[:10],
        "data_reality": DATA_ACCESS_REALITY["sales_strategy_translation"],
    }
    if csv_path:
        brief["internal_admissions_summary"] = summarize_internal_admissions(csv_path=csv_path)
        brief["hospital_gap_analysis_top_rows"] = hospital_referral_gap_analysis(csv_path=csv_path, state=state, city=city, max_rows=max_rows_per_section)["gap_analysis"]["rows"][:10]
        brief["snf_gap_analysis_top_rows"] = snf_referral_gap_analysis(csv_path=csv_path, state=state, city=city, max_rows=max_rows_per_section)["gap_analysis"]["rows"][:10]
    return brief



def _dataset_response_for_cache(dataset_key: str, max_rows: int, keywords: list[str] | None = None) -> dict[str, Any]:
    registry_entry = load_registry()["datasets"][dataset_key]
    if registry_entry["kind"] == "cms_data_api":
        response = cms_data_paginated(dataset_uuid(dataset_key), keywords=keywords, filters=None, max_rows=max_rows)
    elif registry_entry["kind"] == "provider_data_catalog_api":
        response = provider_data_paginated(provider_dataset_id(dataset_key), filters=None, max_rows=max_rows)
    else:
        raise ValueError(f"Dataset key {dataset_key} is not cacheable through a public API in this server.")
    return {"registry_entry": registry_entry, "response": response}


def _default_public_filters(
    state: str | None = None,
    county: str | None = None,
    city: str | None = None,
    zip_code: str | None = None,
    provider_name: str | None = None,
    ccn: str | None = None,
) -> dict[str, str] | None:
    return _filters_from(
        State=state,
        County=county,
        City=city,
        Zip=zip_code,
        Provider=provider_name,
        CCN=ccn,
    )


@mcp.tool()
def cache_national_dataset(
    dataset_key: str,
    max_rows: int = 250000,
    overwrite: bool = True,
    keywords: list[str] | None = None,
) -> dict[str, Any]:
    """Download a national public CMS dataset into the local SQLite cache so it can be filtered afterward."""
    result = _dataset_response_for_cache(dataset_key=dataset_key, max_rows=max_rows, keywords=keywords)
    registry_entry = result["registry_entry"]
    response = result["response"]
    return cache_rows(
        dataset_key=dataset_key,
        rows=response.rows,
        source_name=str(registry_entry.get("name", dataset_key)),
        source_url=response.source_url or str(registry_entry.get("landing_page", "")),
        cache_scope="national_public_rows",
        notes="Cached from free public CMS data. This is filterable market intelligence, not exact referral flow.",
        overwrite=overwrite,
    ) | {"api_meta": response.meta}


@mcp.tool()
def cache_core_national_datasets(max_rows_per_dataset: int = 250000, overwrite: bool = False) -> dict[str, Any]:
    """Cache the core national public datasets used for hospice market, hospital opportunity, SNF opportunity, and hospice quality."""
    dataset_keys = [
        "pac_hospice_latest",
        "inpatient_provider_service_latest",
        "hospice_provider_data",
        "hospice_general_information",
        "nursing_home_provider_information",
    ]
    results: dict[str, Any] = {}
    for key in dataset_keys:
        try:
            results[key] = cache_national_dataset(dataset_key=key, max_rows=max_rows_per_dataset, overwrite=overwrite)
        except Exception as exc:
            results[key] = {"status": "failed", "error": str(exc)}
    return {
        "results": results,
        "note": "Caching national datasets can take time because CMS pages public data in chunks. Run again later with overwrite false to keep existing cached datasets.",
    }


@mcp.tool()
def list_cached_national_datasets() -> dict[str, Any]:
    """List national public datasets already downloaded into the local cache."""
    return {"cached_datasets": list_cached_datasets()}


@mcp.tool()
def query_cached_national_dataset(
    dataset_key: str,
    filters: dict[str, str] | None = None,
    keywords: list[str] | None = None,
    limit: int = 1000,
    offset: int = 0,
    scan_limit: int = 250000,
) -> dict[str, Any]:
    """Filter a locally cached national dataset by any available column after download."""
    status = cache_status(dataset_key)
    if not status:
        raise ValueError(f"Dataset {dataset_key} is not cached yet. Run cache_national_dataset first.")
    candidate_rows = load_cached_rows(dataset_key=dataset_key, limit=scan_limit, offset=0, keywords=keywords)
    matched_rows = filter_cached_rows(candidate_rows, filters=filters, contains=True)
    limit = max(1, min(int(limit), 5000))
    offset = max(0, int(offset))
    return {
        "dataset_key": dataset_key,
        "cache_status": status,
        "filters": filters or {},
        "keywords": keywords or [],
        "total_matching_rows": len(matched_rows),
        "rows": matched_rows[offset : offset + limit],
        "interpretation_note": "These are filtered rows from the local national public CMS cache. They are not exact referral flow records.",
    }


@mcp.tool()
def national_hospice_market_share_proxy(
    state: str | None = None,
    county: str | None = None,
    city: str | None = None,
    zip_code: str | None = None,
    provider_name: str | None = None,
    ccn: str | None = None,
    market_column: str | None = None,
    provider_column: str | None = None,
    volume_column: str | None = None,
    use_cache: bool = True,
    max_rows: int = 250000,
) -> dict[str, Any]:
    """Estimate national or filtered hospice market share using all available public CMS hospice rows."""
    filters = _default_public_filters(state=state, county=county, city=city, zip_code=zip_code, provider_name=provider_name, ccn=ccn)
    dataset_key = "pac_hospice_latest"
    if use_cache and cache_status(dataset_key):
        rows = load_cached_rows(dataset_key=dataset_key, limit=max_rows)
        rows = filter_cached_rows(rows, filters=filters)
        source = cache_status(dataset_key)
    else:
        response = cms_data_paginated(dataset_uuid(dataset_key), filters=filters, max_rows=max_rows)
        rows = response.rows
        source = {"source_url": response.source_url, "meta": response.meta}
    share = compute_market_share(rows, market_column=market_column, provider_column=provider_column, volume_column=volume_column)
    return {
        "dataset": "Medicare Post Acute Care Utilization Hospice",
        "scope": "national unless filters were supplied",
        "filters": filters or {},
        "source": source,
        "volume_column_used": share.get("volume_column"),
        "provider_column_used": share.get("provider_column"),
        "market_column_used": share.get("market_column"),
        "total_volume_in_matching_rows": share.get("total_volume"),
        "market_totals": share.get("market_totals"),
        "rows": share.get("rows", [])[: min(max_rows, 5000)],
        "interpretation_note": "This is public national utilization based market share logic. It is a proxy, not exact referral source flow.",
    }


@mcp.tool()
def national_hospital_hospice_opportunity(
    state: str | None = None,
    county: str | None = None,
    city: str | None = None,
    zip_code: str | None = None,
    hospital_name: str | None = None,
    ccn: str | None = None,
    drg_terms: list[str] | None = None,
    use_cache: bool = True,
    max_rows: int = 250000,
) -> dict[str, Any]:
    """Rank national or filtered hospitals by hospice relevant inpatient discharge opportunity."""
    filters = _default_public_filters(state=state, county=county, city=city, zip_code=zip_code, provider_name=hospital_name, ccn=ccn)
    dataset_key = "inpatient_provider_service_latest"
    keywords = drg_terms or HOSPICE_RELEVANT_DRG_TERMS
    if use_cache and cache_status(dataset_key):
        rows = load_cached_rows(dataset_key=dataset_key, limit=max_rows, keywords=keywords)
        rows = filter_cached_rows(rows, filters=filters)
        source = cache_status(dataset_key)
    else:
        response = cms_data_paginated(dataset_uuid(dataset_key), keywords=keywords, filters=filters, max_rows=max_rows)
        rows = response.rows
        source = {"source_url": response.source_url, "meta": response.meta}
    scored = score_hospital_rows(rows, terms=drg_terms)
    return {
        "dataset": "Medicare Inpatient Hospitals by Provider and Service",
        "scope": "national unless filters were supplied",
        "filters": filters or {},
        "source": source,
        "rows": _limit_rows(scored, min(max_rows, 5000)),
        "interpretation_note": "This ranks public discharge opportunity. It does not prove actual hospice referrals.",
    }


@mcp.tool()
def national_nursing_home_opportunity(
    state: str | None = None,
    county: str | None = None,
    city: str | None = None,
    zip_code: str | None = None,
    facility_name: str | None = None,
    use_cache: bool = True,
    max_rows: int = 250000,
) -> dict[str, Any]:
    """Rank national or filtered nursing homes by bed volume and public quality pressure."""
    filters = _default_public_filters(state=state, county=county, city=city, zip_code=zip_code, provider_name=facility_name)
    dataset_key = "nursing_home_provider_information"
    if use_cache and cache_status(dataset_key):
        rows = load_cached_rows(dataset_key=dataset_key, limit=max_rows)
        rows = filter_cached_rows(rows, filters=filters)
        source = cache_status(dataset_key)
    else:
        response = provider_data_paginated(provider_dataset_id(dataset_key), filters=filters, max_rows=max_rows)
        rows = response.rows
        source = {"source_url": response.source_url, "meta": response.meta}
    scored = score_nursing_home_rows(rows)
    return {
        "dataset": "Nursing Home Provider Information",
        "scope": "national unless filters were supplied",
        "filters": filters or {},
        "source": source,
        "rows": _limit_rows(scored, min(max_rows, 5000)),
        "interpretation_note": "This is public nursing home opportunity scoring. It does not prove actual referrals.",
    }

def main() -> None:
    parser = argparse.ArgumentParser(description="Run the CMS Public Market Intelligence MCP server.")
    parser.add_argument("--transport", choices=["stdio", "streamable-http"], default=os.getenv("MCP_TRANSPORT", "stdio"))
    args = parser.parse_args()
    mcp.run(transport=args.transport)


if __name__ == "__main__":
    main()
