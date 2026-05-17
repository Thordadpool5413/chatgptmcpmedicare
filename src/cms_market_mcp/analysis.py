from __future__ import annotations

import csv
import re
from collections import Counter, defaultdict
from difflib import SequenceMatcher
from pathlib import Path
from statistics import mean
from typing import Any

MISSING_VALUES = {"", "NA", "N/A", "Not Available", "Not Applicable", "*", "null", "None"}

HOSPICE_RELEVANT_DRG_TERMS = [
    "heart failure",
    "sepsis",
    "respiratory",
    "copd",
    "pneumonia",
    "renal failure",
    "kidney failure",
    "stroke",
    "intracranial",
    "malignancy",
    "neoplasm",
    "cancer",
    "dementia",
    "degenerative nervous",
    "cirrhosis",
    "liver",
    "failure",
]

STOP_WORDS_FOR_ACCOUNT_MATCHING = {
    "the",
    "inc",
    "llc",
    "ltd",
    "corp",
    "corporation",
    "company",
    "health",
    "healthcare",
    "medical",
    "center",
    "centre",
    "hospital",
    "hospitals",
    "rehab",
    "rehabilitation",
    "nursing",
    "home",
    "skilled",
    "facility",
    "services",
    "service",
}


def as_number(value: Any) -> float:
    if value is None:
        return 0.0
    text = str(value).strip().replace(",", "").replace("$", "").replace("%", "")
    if text in MISSING_VALUES:
        return 0.0
    try:
        return float(text)
    except ValueError:
        return 0.0


def normalize_key(value: str) -> str:
    return re.sub(r"\s+", " ", str(value).replace("_", " ").replace("-", " ").strip().lower())


def find_column(row: dict[str, Any], candidates: list[str]) -> str | None:
    if not row:
        return None
    normalized = {normalize_key(str(key)): key for key in row.keys()}
    for candidate in candidates:
        wanted = normalize_key(candidate)
        if wanted in normalized:
            return normalized[wanted]
    for candidate in candidates:
        wanted = normalize_key(candidate)
        for norm, original in normalized.items():
            if wanted in norm:
                return original
    return None


def find_column_from_rows(rows: list[dict[str, Any]], candidates: list[str]) -> str | None:
    for row in rows:
        found = find_column(row, candidates)
        if found:
            return found
    return None


def pick_provider_column(row: dict[str, Any]) -> str | None:
    return find_column(
        row,
        [
            "Provider Name",
            "Provider",
            "Rndrng_Prvdr_Org_Name",
            "Organization Name",
            "Facility Name",
            "Legal Business Name",
            "Hospice Name",
            "Hospital",
        ],
    )


def pick_market_column(row: dict[str, Any]) -> str | None:
    return find_column(row, ["State", "Rndrng_Prvdr_State_Abrvtn", "County", "City", "ZIP Code", "Zip"])


def pick_volume_column(row: dict[str, Any]) -> str | None:
    candidates = [
        "Tot_Benes",
        "Total Beneficiaries",
        "Tot_Benes_Hospice",
        "Bene_Cnt",
        "Beneficiary Count",
        "Total Patients",
        "Total Stays",
        "Tot_Dschrgs",
        "Total Discharges",
        "Discharges",
        "Tot_Hospice_Days",
        "Total Days",
        "Avg_Daily_Census",
        "Medicare Payment Amount",
        "Avg_Mdcr_Pymt_Amt",
    ]
    return find_column(row, candidates)


def compute_market_share(
    rows: list[dict[str, Any]],
    market_column: str | None = None,
    provider_column: str | None = None,
    volume_column: str | None = None,
) -> dict[str, Any]:
    if not rows:
        return {"rows": [], "total_volume": 0, "volume_column": volume_column, "market_column": market_column}

    sample = rows[0]
    volume_column = volume_column or pick_volume_column(sample)
    provider_column = provider_column or pick_provider_column(sample)
    market_column = market_column or pick_market_column(sample)
    if not volume_column:
        return {
            "rows": rows,
            "total_volume": None,
            "warning": "No obvious volume column found. Supply volume_column manually.",
            "available_columns": list(sample.keys()),
        }

    market_totals: dict[str, float] = defaultdict(float)
    total_volume = 0.0
    for row in rows:
        market = str(row.get(market_column, "All Returned Rows") or "All Returned Rows") if market_column else "All Returned Rows"
        volume = as_number(row.get(volume_column))
        market_totals[market] += volume
        total_volume += volume

    enriched: list[dict[str, Any]] = []
    for row in rows:
        market = str(row.get(market_column, "All Returned Rows") or "All Returned Rows") if market_column else "All Returned Rows"
        provider = str(row.get(provider_column, "Unknown Provider") or "Unknown Provider") if provider_column else "Unknown Provider"
        volume = as_number(row.get(volume_column))
        market_total = market_totals.get(market, 0.0)
        share = (volume / market_total * 100.0) if market_total else 0.0
        copy = dict(row)
        copy["_market"] = market
        copy["_provider_name"] = provider
        copy["_market_volume"] = volume
        copy["_market_total_volume"] = round(market_total, 2)
        copy["_market_share_pct"] = round(share, 2)
        enriched.append(copy)

    enriched.sort(key=lambda row: (row.get("_market", ""), row.get("_market_volume", 0)), reverse=True)
    return {
        "rows": enriched,
        "total_volume": round(total_volume, 2),
        "market_totals": {key: round(value, 2) for key, value in sorted(market_totals.items())},
        "volume_column": volume_column,
        "provider_column": provider_column,
        "market_column": market_column,
    }


def score_hospital_rows(rows: list[dict[str, Any]], terms: list[str] | None = None) -> list[dict[str, Any]]:
    terms = [term.lower() for term in (terms or HOSPICE_RELEVANT_DRG_TERMS)]
    scored: list[dict[str, Any]] = []
    for row in rows:
        drg_col = find_column(row, ["DRG_Desc", "DRG Desc", "DRG Description", "MS DRG Description", "Description"])
        discharge_col = find_column(row, ["Tot_Dschrgs", "Total Discharges", "Discharges"])
        payment_col = find_column(row, ["Avg_Mdcr_Pymt_Amt", "Average Medicare Payments", "Medicare Payment Amount"])
        description = str(row.get(drg_col, "")).lower() if drg_col else ""
        discharges = as_number(row.get(discharge_col)) if discharge_col else 0.0
        payment = as_number(row.get(payment_col)) if payment_col else 0.0
        matched_terms = [term for term in terms if term in description]
        clinical_weight = 1.0 + 0.35 * len(matched_terms)
        payment_weight = min(payment / 10000.0, 10.0) if payment else 0.0
        score = discharges * clinical_weight + payment_weight
        enriched = dict(row)
        enriched["_matched_hospice_terms"] = matched_terms
        enriched["_total_discharges_used_for_score"] = discharges
        enriched["_opportunity_score"] = round(score, 2)
        enriched["_opportunity_reason"] = "High discharge volume with hospice relevant DRG language" if matched_terms else "Discharge volume present, but no hospice term matched"
        scored.append(enriched)
    scored.sort(key=lambda row: row.get("_opportunity_score", 0), reverse=True)
    return scored


def score_nursing_home_rows(rows: list[dict[str, Any]]) -> list[dict[str, Any]]:
    scored: list[dict[str, Any]] = []
    for row in rows:
        beds_col = find_column(row, ["Number of Certified Beds", "Certified Bed Count", "Certified beds", "Beds"])
        overall_col = find_column(row, ["Overall Rating", "Overall star rating", "Rating"])
        staffing_col = find_column(row, ["Staffing Rating", "Staffing star rating"])
        qm_col = find_column(row, ["QM Rating", "Quality Measure Rating", "Quality star rating"])
        beds = as_number(row.get(beds_col)) if beds_col else 0.0
        overall = as_number(row.get(overall_col)) if overall_col else 3.0
        staffing = as_number(row.get(staffing_col)) if staffing_col else 3.0
        qm = as_number(row.get(qm_col)) if qm_col else 3.0
        quality_pressure = max(0.0, 5.0 - overall) + max(0.0, 5.0 - staffing) * 0.5 + max(0.0, 5.0 - qm) * 0.35
        score = beds + quality_pressure * 18.0
        enriched = dict(row)
        enriched["_snf_opportunity_score"] = round(score, 2)
        enriched["_beds_used_for_score"] = beds
        enriched["_quality_pressure_component"] = round(quality_pressure, 2)
        enriched["_opportunity_reason"] = "Large bed count plus public quality pressure signals" if quality_pressure > 2 else "Opportunity mostly driven by bed count"
        scored.append(enriched)
    scored.sort(key=lambda row: row.get("_snf_opportunity_score", 0), reverse=True)
    return scored


def load_csv_rows(path: str) -> tuple[list[dict[str, Any]], list[str]]:
    csv_path = Path(path).expanduser().resolve()
    if not csv_path.exists():
        raise FileNotFoundError(f"CSV file not found: {csv_path}")
    with csv_path.open("r", newline="", encoding="utf-8-sig") as handle:
        reader = csv.DictReader(handle)
        rows = list(reader)
        columns = reader.fieldnames or []
    return rows, columns


def _counter(rows: list[dict[str, Any]], column: str | None) -> list[tuple[str, int]]:
    if not column:
        return [("Unknown", len(rows))] if rows else []
    return Counter(str(row.get(column, "Unknown") or "Unknown").strip() for row in rows).most_common()


def summarize_internal_admissions_csv(
    path: str,
    referral_source_column: str = "referral_source",
    admit_date_column: str = "admit_date",
    payer_column: str = "payer",
    market_column: str = "market",
    marketer_column: str = "marketer",
    referral_source_type_column: str = "referral_source_type",
    admission_status_column: str = "admission_status",
) -> dict[str, Any]:
    rows, columns = load_csv_rows(path)
    sample = rows[0] if rows else {column: "" for column in columns}

    referral_source_column = find_column(sample, [referral_source_column, "Referral Source", "Account", "Source Name"]) or referral_source_column
    admit_date_column = find_column(sample, [admit_date_column, "Admit Date", "Admission Date", "SOC Date"]) or admit_date_column
    payer_column = find_column(sample, [payer_column, "Payor", "Payment Source", "Insurance"]) or payer_column
    market_column = find_column(sample, [market_column, "Territory", "County", "Service Area"]) or market_column
    marketer_column = find_column(sample, [marketer_column, "Rep", "Sales Rep", "Liaison", "Account Owner"]) or marketer_column
    referral_source_type_column = find_column(sample, [referral_source_type_column, "Source Type", "Account Type"]) or referral_source_type_column
    admission_status_column = find_column(sample, [admission_status_column, "Status", "Referral Status"]) or admission_status_column

    monthly_counts: dict[str, int] = defaultdict(int)
    for row in rows:
        date_value = row.get(admit_date_column, "") or ""
        month = str(date_value)[:7] if len(str(date_value)) >= 7 else "Unknown"
        monthly_counts[month] += 1

    status_counts = _counter(rows, admission_status_column)
    admitted_count = 0
    for status, count in status_counts:
        if normalize_key(status) in {"admitted", "admit", "accepted", "taken under care", "tuc"}:
            admitted_count += count
    conversion_rate = round(admitted_count / len(rows) * 100.0, 2) if rows else 0.0

    referral_source_counts = _counter(rows, referral_source_column)
    top_accounts = []
    for account, count in referral_source_counts[:50]:
        account_rows = [row for row in rows if str(row.get(referral_source_column, "Unknown") or "Unknown").strip() == account]
        months = {str(row.get(admit_date_column, ""))[:7] for row in account_rows if row.get(admit_date_column)}
        top_accounts.append(
            {
                "referral_source": account,
                "admission_count": count,
                "active_month_count": len(months),
                "average_admissions_per_active_month": round(count / len(months), 2) if months else count,
                "payer_mix": _counter(account_rows, payer_column),
                "marketer_mix": _counter(account_rows, marketer_column),
            }
        )

    return {
        "csv_path": str(Path(path).expanduser().resolve()),
        "admission_count": len(rows),
        "admitted_count": admitted_count,
        "conversion_rate_pct_if_status_present": conversion_rate,
        "top_referral_sources": referral_source_counts[:25],
        "top_accounts_enriched": top_accounts,
        "referral_source_type_mix": _counter(rows, referral_source_type_column),
        "payer_mix": _counter(rows, payer_column),
        "market_mix": _counter(rows, market_column),
        "marketer_mix": _counter(rows, marketer_column),
        "status_mix": status_counts,
        "monthly_admissions": sorted(monthly_counts.items()),
        "columns_found": columns,
        "columns_used": {
            "referral_source": referral_source_column,
            "admit_date": admit_date_column,
            "payer": payer_column,
            "market": market_column,
            "marketer": marketer_column,
            "referral_source_type": referral_source_type_column,
            "admission_status": admission_status_column,
        },
    }


def canonicalize_account_name(name: Any) -> str:
    text = normalize_key(str(name or ""))
    text = re.sub(r"[^a-z0-9 ]+", " ", text)
    words = [word for word in text.split() if word not in STOP_WORDS_FOR_ACCOUNT_MATCHING]
    return " ".join(words) or text


def fuzzy_score(left: Any, right: Any) -> float:
    left_key = canonicalize_account_name(left)
    right_key = canonicalize_account_name(right)
    if not left_key or not right_key:
        return 0.0
    if left_key == right_key:
        return 1.0
    left_words = set(left_key.split())
    right_words = set(right_key.split())
    overlap = len(left_words & right_words) / max(1, len(left_words | right_words))
    ratio = SequenceMatcher(None, left_key, right_key).ratio()
    return round(max(ratio, overlap), 4)


def match_internal_accounts_to_public_opportunity(
    admissions_rows: list[dict[str, Any]],
    opportunity_rows: list[dict[str, Any]],
    admission_account_column: str | None = None,
    public_account_column: str | None = None,
    public_score_column: str = "_opportunity_score",
    threshold: float = 0.72,
) -> dict[str, Any]:
    admission_account_column = admission_account_column or find_column_from_rows(admissions_rows, ["referral_source", "Referral Source", "Account", "Source Name"])
    public_account_column = public_account_column or find_column_from_rows(opportunity_rows, ["Provider Name", "Rndrng_Prvdr_Org_Name", "Hospital", "Facility Name"])
    if not admission_account_column or not public_account_column:
        return {
            "matches": [],
            "unmatched_public_opportunities": opportunity_rows,
            "warning": "Could not find account columns in one or both inputs.",
        }

    admissions_by_account = Counter(str(row.get(admission_account_column, "Unknown") or "Unknown").strip() for row in admissions_rows)
    public_scored = []
    for public_row in opportunity_rows:
        public_name = str(public_row.get(public_account_column, "") or "")
        best_account = None
        best_score = 0.0
        for account in admissions_by_account:
            score = fuzzy_score(account, public_name)
            if score > best_score:
                best_account = account
                best_score = score
        opportunity_score = as_number(public_row.get(public_score_column))
        admission_count = admissions_by_account.get(best_account or "", 0) if best_score >= threshold else 0
        gap_score = round(opportunity_score / max(1, admission_count + 1), 2)
        enriched = dict(public_row)
        enriched["_matched_internal_referral_source"] = best_account if best_score >= threshold else None
        enriched["_match_confidence"] = best_score
        enriched["_internal_admission_count"] = admission_count
        enriched["_gap_score"] = gap_score
        public_scored.append(enriched)

    public_scored.sort(key=lambda row: row.get("_gap_score", 0), reverse=True)
    return {
        "matches": [row for row in public_scored if row.get("_matched_internal_referral_source")],
        "unmatched_public_opportunities": [row for row in public_scored if not row.get("_matched_internal_referral_source")],
        "rows": public_scored,
        "matching_threshold": threshold,
        "public_account_column": public_account_column,
        "admission_account_column": admission_account_column,
        "interpretation_note": "Gap score is public opportunity divided by internal admissions plus one. It is a prioritization proxy, not referral leakage proof.",
    }


def validate_admissions_csv(path: str) -> dict[str, Any]:
    rows, columns = load_csv_rows(path)
    sample = rows[0] if rows else {column: "" for column in columns}
    recommended = {
        "admit_date": ["admit_date", "admission date", "soc date"],
        "referral_source": ["referral_source", "referral source", "account", "source name"],
        "referral_source_type": ["referral_source_type", "source type", "account type"],
        "market": ["market", "territory", "county", "service area"],
        "payer": ["payer", "payor", "payment source", "insurance"],
        "marketer": ["marketer", "rep", "sales rep", "liaison", "account owner"],
        "admission_status": ["admission_status", "status", "referral status"],
    }
    found = {key: find_column(sample, candidates) for key, candidates in recommended.items()}
    missing = [key for key, value in found.items() if not value]
    duplicate_patient_ids = 0
    patient_col = find_column(sample, ["patient_id", "patient id", "mrn"])
    if patient_col:
        values = [row.get(patient_col) for row in rows if row.get(patient_col)]
        duplicate_patient_ids = len(values) - len(set(values))
    source_counts = _counter(rows, found.get("referral_source"))
    return {
        "row_count": len(rows),
        "columns_found": columns,
        "recognized_columns": found,
        "missing_recommended_columns": missing,
        "duplicate_patient_identifier_count": duplicate_patient_ids,
        "top_referral_sources_preview": source_counts[:10],
        "quality_score_pct": round((len(recommended) - len(missing)) / len(recommended) * 100.0, 2),
        "privacy_note": "Use anonymous patient ids. Do not place PHI into MCP clients unless your environment and agreements permit it.",
    }


def summarize_numeric_column(rows: list[dict[str, Any]], column: str) -> dict[str, Any]:
    values = [as_number(row.get(column)) for row in rows if row.get(column) not in (None, "")]
    if not values:
        return {"column": column, "count": 0}
    return {
        "column": column,
        "count": len(values),
        "sum": round(sum(values), 2),
        "mean": round(mean(values), 2),
        "min": round(min(values), 2),
        "max": round(max(values), 2),
    }
