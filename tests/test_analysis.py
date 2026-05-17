from cms_market_mcp.analysis import (
    canonicalize_account_name,
    compute_market_share,
    fuzzy_score,
    match_internal_accounts_to_public_opportunity,
    score_hospital_rows,
    score_nursing_home_rows,
    summarize_internal_admissions_csv,
    validate_admissions_csv,
)


def test_compute_market_share():
    rows = [
        {"Provider": "A", "State": "FL", "Tot_Dschrgs": "75"},
        {"Provider": "B", "State": "FL", "Tot_Dschrgs": "25"},
    ]
    result = compute_market_share(rows, market_column="State")
    assert result["total_volume"] == 100
    assert result["rows"][0]["_market_share_pct"] == 75.0
    assert result["market_totals"]["FL"] == 100


def test_score_hospital_rows():
    rows = [
        {"Hospital": "A", "DRG_Desc": "Heart failure and shock", "Tot_Dschrgs": "10"},
        {"Hospital": "B", "DRG_Desc": "Simple pneumonia", "Tot_Dschrgs": "30"},
    ]
    result = score_hospital_rows(rows)
    assert result[0]["_opportunity_score"] >= result[1]["_opportunity_score"]
    assert result[0]["_matched_hospice_terms"]


def test_score_nursing_home_rows():
    rows = [
        {"Provider Name": "A", "Number of Certified Beds": "100", "Overall Rating": "2", "Staffing Rating": "2"},
        {"Provider Name": "B", "Number of Certified Beds": "20", "Overall Rating": "5", "Staffing Rating": "5"},
    ]
    result = score_nursing_home_rows(rows)
    assert result[0]["Provider Name"] == "A"
    assert result[0]["_snf_opportunity_score"] > result[1]["_snf_opportunity_score"]


def test_summarize_internal_admissions_csv(tmp_path):
    csv_path = tmp_path / "admissions.csv"
    csv_path.write_text(
        "admit_date,referral_source,payer,market,marketer,admission_status\n"
        "2026-01-01,Hospital A,Medicare,Brevard,Amy,Admitted\n"
        "2026-01-02,Hospital A,Medicare,Brevard,Amy,Admitted\n"
        "2026-02-01,SNF A,MA,Orange,Jordan,Declined\n",
        encoding="utf-8",
    )
    summary = summarize_internal_admissions_csv(str(csv_path))
    assert summary["admission_count"] == 3
    assert summary["top_referral_sources"][0] == ("Hospital A", 2)
    assert summary["admitted_count"] == 2


def test_validate_admissions_csv(tmp_path):
    csv_path = tmp_path / "admissions.csv"
    csv_path.write_text(
        "admit_date,referral_source,payer,market,marketer,admission_status\n"
        "2026-01-01,Hospital A,Medicare,Brevard,Amy,Admitted\n",
        encoding="utf-8",
    )
    validation = validate_admissions_csv(str(csv_path))
    assert validation["row_count"] == 1
    assert validation["quality_score_pct"] >= 80


def test_account_name_canonicalization_and_fuzzy_score():
    assert canonicalize_account_name("The Example Medical Center LLC") == "example"
    assert fuzzy_score("Example Hospital", "Example Medical Center") >= 0.7


def test_gap_analysis_matches_internal_to_public():
    admissions = [
        {"referral_source": "Example Hospital"},
        {"referral_source": "Example Hospital"},
    ]
    public = [
        {"Rndrng_Prvdr_Org_Name": "Example Medical Center", "_opportunity_score": 50},
        {"Rndrng_Prvdr_Org_Name": "Ignored Facility", "_opportunity_score": 20},
    ]
    result = match_internal_accounts_to_public_opportunity(
        admissions_rows=admissions,
        opportunity_rows=public,
        public_account_column="Rndrng_Prvdr_Org_Name",
        threshold=0.7,
    )
    assert result["matches"]
    assert result["rows"][0]["_gap_score"] >= result["rows"][1]["_gap_score"]


def test_cached_filter_rows_uses_fuzzy_column_names():
    from cms_market_mcp.cache import filter_rows

    rows = [
        {"Rndrng_Prvdr_State_Abrvtn": "FL", "Rndrng_Prvdr_Org_Name": "Example Hospital"},
        {"Rndrng_Prvdr_State_Abrvtn": "GA", "Rndrng_Prvdr_Org_Name": "Other Hospital"},
    ]
    matched = filter_rows(rows, {"State": "FL", "Provider": "Example"})
    assert len(matched) == 1
    assert matched[0]["Rndrng_Prvdr_Org_Name"] == "Example Hospital"


def test_cache_roundtrip(tmp_path):
    from cms_market_mcp.cache import cache_rows, list_cached_datasets, load_cached_rows

    db = tmp_path / "cache.sqlite3"
    result = cache_rows(
        dataset_key="demo",
        rows=[{"State": "FL", "Provider Name": "Alpha"}, {"State": "GA", "Provider Name": "Beta"}],
        source_name="Demo",
        source_url="https://example.com",
        cache_path=db,
    )
    assert result["row_count"] == 2
    assert list_cached_datasets(cache_path=db)[0]["dataset_key"] == "demo"
    loaded = load_cached_rows("demo", keywords=["alpha"], cache_path=db)
    assert len(loaded) == 1
    assert loaded[0]["Provider Name"] == "Alpha"
