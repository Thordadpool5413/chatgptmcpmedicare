# MCP tool reference

## list_free_data_sources

Returns the built in public dataset registry and a plain English data access note.

## explain_data_access_reality

Returns what is free now and what is restricted, paid, or internal only.

## get_dataset_metadata

Returns metadata for a registered dataset key, direct CMS Data API UUID, or Provider Data Catalog id.

## query_cms_data

Queries any public data.cms.gov dataset by UUID.

## query_registered_dataset

Queries one of the registry keys in data/dataset_registry.json.

## query_provider_data_catalog

Queries a Provider Data Catalog dataset by short id.

## lookup_npi

Looks up public NPI records using NPPES API version 2.1.

## search_hospice_public_quality

Searches public hospice provider quality rows.

## hospice_market_share_proxy

Estimates hospice market share using public CMS PAC Hospice utilization rows.

## hospital_hospice_opportunity

Ranks hospital discharge rows using hospice relevant DRG language and discharge volume.

## nursing_home_opportunity

Ranks nursing homes using certified beds and public quality pressure signals.

## validate_internal_admissions_csv

Checks whether your internal admissions CSV has the columns needed for referral intelligence.

## summarize_internal_admissions

Summarizes internal admissions by referral source, account type, payer, market, marketer, status, and month.

## hospital_referral_gap_analysis

Matches internal admissions against public hospital opportunity and produces gap scoring.

## snf_referral_gap_analysis

Matches internal admissions against public nursing home opportunity and produces gap scoring.

## build_market_intelligence_brief

Builds a compact market brief using public opportunity data and optional internal admissions data.
