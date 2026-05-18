// Direct CMS API calls — no Python server needed

const CMS_DATA_API = "https://data.cms.gov/data-api/v1";
const PROVIDER_DATA_API = "https://data.cms.gov/provider-data/api/1";
const NPPES_API = "https://npiregistry.cms.hhs.gov/api/";

const HOSPICE_UUID = "4e73f1b5-82cb-4682-8ad2-28493f0b6840";
const HOSPITAL_UUID = "690ddc6c-2767-4618-b277-420ffb2bf27c";
const NURSING_HOME_ID = "4pq5-n9py";

export function num(v: unknown): number {
  if (v == null) return 0;
  const n = parseFloat(String(v).replace(/,/g, "").replace(/\$/g, "").replace(/%/g, ""));
  return isNaN(n) ? 0 : n;
}

function findCol(row: Record<string, unknown>, candidates: string[]): string | null {
  const keys = Object.keys(row);
  for (const c of candidates) {
    const found = keys.find((k) => k.toLowerCase().replace(/[_\s-]/g, "") === c.toLowerCase().replace(/[_\s-]/g, ""));
    if (found) return found;
  }
  return null;
}

const HOSPICE_DRG_TERMS = [
  "heart failure","sepsis","respiratory","copd","pneumonia","renal failure",
  "kidney","stroke","malignancy","cancer","dementia","cirrhosis","liver","failure",
];

// ─── Hospice Market Share ─────────────────────────────────────────────────────

export interface HospiceRow {
  _provider_name: string;
  _market: string;
  _market_volume: number;
  _market_total_volume: number;
  _market_share_pct: number;
  _rank: number;
  Rndrng_Prvdr_Org_Name?: string;
  Rndrng_Prvdr_City?: string;
  Rndrng_Prvdr_State_Abrvtn?: string;
  Rndrng_Prvdr_Zip_Cd?: string;
  Tot_Benes?: number;
  Tot_Mdcr_Pymt_Amt?: number;
  Bene_Avg_Age?: number;
  Bene_Avg_Risk_Scre?: number;
  [key: string]: unknown;
}

export interface HospiceResult {
  rows: HospiceRow[];
  provider_column_used: string;
  volume_column_used: string;
  market_column_used: string;
  total_volume: number;
  market_totals: Record<string, number>;
  interpretation_note: string;
}

export async function getHospiceMarketShare(state?: string, maxRows = 200): Promise<HospiceResult> {
  const params = new URLSearchParams({ size: "2000" });
  if (state) params.set("filter[Rndrng_Prvdr_State_Abrvtn]", state);

  const res = await fetch(`${CMS_DATA_API}/dataset/${HOSPICE_UUID}/data?${params}`, {
    signal: AbortSignal.timeout(30_000),
  });
  if (!res.ok) throw new Error(`CMS API error ${res.status}`);
  const data = (await res.json()) as Record<string, unknown>[];
  if (!data.length) return { rows: [], provider_column_used: "", volume_column_used: "", market_column_used: "", total_volume: 0, market_totals: {}, interpretation_note: "No data found." };

  const sample = data[0];
  const provCol = findCol(sample, ["Rndrng_Prvdr_Org_Name","ProviderName","Provider"]) ?? Object.keys(sample)[0];
  const volCol = findCol(sample, ["Tot_Benes","TotBenes","Beneficiaries","Total_Benes"]) ?? findCol(sample, ["Tot"]) ?? Object.keys(sample)[2];
  const mktCol = findCol(sample, ["Rndrng_Prvdr_City","City"]) ?? findCol(sample, ["County","HRR"]) ?? findCol(sample, ["Rndrng_Prvdr_State_Abrvtn","State"]) ?? "";

  const mktTotals: Record<string, number> = {};
  let totalVolume = 0;
  for (const row of data) {
    const mkt = String(row[mktCol] ?? "All");
    const vol = num(row[volCol]);
    mktTotals[mkt] = (mktTotals[mkt] ?? 0) + vol;
    totalVolume += vol;
  }

  const rows: HospiceRow[] = data.map((row) => {
    const mkt = String(row[mktCol] ?? "All");
    const vol = num(row[volCol]);
    const total = mktTotals[mkt] || 1;
    return {
      ...row,
      _provider_name: String(row[provCol] ?? ""),
      _market: mkt,
      _market_volume: vol,
      _market_total_volume: total,
      _market_share_pct: parseFloat(((vol / total) * 100).toFixed(2)),
    } as HospiceRow;
  });

  rows.sort((a, b) => b._market_share_pct - a._market_share_pct);
  rows.forEach((r, i) => { r._rank = i + 1; });

  return {
    rows: rows.slice(0, maxRows),
    provider_column_used: provCol,
    volume_column_used: volCol!,
    market_column_used: mktCol,
    total_volume: totalVolume,
    market_totals: mktTotals,
    interpretation_note: "Market share = provider beneficiary volume ÷ market (city) total. Source: Medicare PAC Utilization Hospice.",
  };
}

// ─── Hospital Opportunity ─────────────────────────────────────────────────────

export interface HospitalRow {
  Rndrng_Prvdr_CCN?: string;
  Rndrng_Prvdr_Org_Name?: string;
  Rndrng_Prvdr_City?: string;
  Rndrng_Prvdr_State_Abrvtn?: string;
  Rndrng_Prvdr_Zip_Cd?: string;
  DRG_Cd?: string;
  DRG_Desc?: string;
  Tot_Dschrgs?: number;
  Avg_Submtd_Cvrd_Chrg?: number;
  Avg_Tot_Pymt_Amt?: number;
  Avg_Mdcr_Pymt_Amt?: number;
  _opportunity_score: number;
  _matched_hospice_terms: string[];
  _opportunity_reason: string;
  [key: string]: unknown;
}

export async function getHospitalOpportunity(
  state?: string, city?: string, maxRows = 200,
): Promise<{ rows: HospitalRow[]; total_records: number; interpretation_note: string }> {
  const params = new URLSearchParams({ size: "2000" });
  if (state) params.set("filter[Rndrng_Prvdr_State_Abrvtn]", state);
  if (city) params.set("filter[Rndrng_Prvdr_City]", city.toUpperCase());

  const res = await fetch(`${CMS_DATA_API}/dataset/${HOSPITAL_UUID}/data?${params}`, {
    signal: AbortSignal.timeout(30_000),
  });
  if (!res.ok) throw new Error(`CMS API error ${res.status}`);
  const data = (await res.json()) as Record<string, unknown>[];

  const rows: HospitalRow[] = data.map((row) => {
    const drg = String(row.DRG_Desc ?? "").toLowerCase();
    const discharges = num(row.Tot_Dschrgs);
    const payment = num(row.Avg_Mdcr_Pymt_Amt);
    const matched = HOSPICE_DRG_TERMS.filter((t) => drg.includes(t));
    const clinicalWeight = 1.0 + 0.35 * matched.length;
    const paymentWeight = Math.min(payment / 10000, 10);
    const score = discharges * clinicalWeight + paymentWeight;
    return {
      ...row,
      _opportunity_score: parseFloat(score.toFixed(2)),
      _matched_hospice_terms: matched,
      _opportunity_reason: matched.length
        ? `Hospice-relevant DRGs: ${matched.slice(0, 3).join(", ")}`
        : "Discharge volume only — no hospice-specific DRG match",
    } as HospitalRow;
  });

  rows.sort((a, b) => b._opportunity_score - a._opportunity_score);

  return {
    rows: rows.slice(0, maxRows),
    total_records: data.length,
    interpretation_note: "Score = discharges × clinical weight (DRG relevance) + payment weight. Source: Medicare Inpatient Hospitals by Provider & Service.",
  };
}

// ─── Nursing Home Opportunity ─────────────────────────────────────────────────

export interface NursingHomeRow {
  "Provider Name"?: string;
  "Provider Address"?: string;
  "City/Town"?: string;
  State?: string;
  "ZIP Code"?: string;
  "Phone Number"?: string;
  "CMS Certification Number (CCN)"?: string;
  "Ownership Type"?: string;
  "Number of Certified Beds"?: number;
  "Number of Residents in Certified Beds"?: number;
  "Overall Rating"?: number;
  "Health Inspection Rating"?: number;
  "QM Rating"?: number;
  "Staffing Rating"?: number;
  "RN Staffing Rating"?: number;
  _snf_opportunity_score: number;
  _beds_used_for_score: number;
  _quality_pressure_component: number;
  [key: string]: unknown;
}

export async function getNursingHomeOpportunity(
  state?: string, city?: string, maxRows = 200,
): Promise<{ rows: NursingHomeRow[]; total_records: number; interpretation_note: string }> {
  const conditions: { property: string; value: string; operator: string }[] = [];
  if (state) conditions.push({ property: "State", value: state, operator: "=" });
  if (city) conditions.push({ property: "City/Town", value: city.toUpperCase(), operator: "=" });

  const res = await fetch(`${PROVIDER_DATA_API}/datastore/query/${NURSING_HOME_ID}/0`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ conditions, limit: 2000, offset: 0 }),
    signal: AbortSignal.timeout(30_000),
  });
  if (!res.ok) throw new Error(`Provider Data API error ${res.status}`);
  const json = (await res.json()) as { results?: Record<string, unknown>[] };
  const data = json.results ?? [];

  const rows: NursingHomeRow[] = data.map((row) => {
    const beds = num(row["Number of Certified Beds"]);
    const overall = num(row["Overall Rating"]) || 3;
    const staffing = num(row["Staffing Rating"]) || 3;
    const qm = num(row["QM Rating"]) || 3;
    const qualityPressure =
      Math.max(0, 5 - overall) + Math.max(0, 5 - staffing) * 0.5 + Math.max(0, 5 - qm) * 0.35;
    const score = beds + qualityPressure * 18;
    return {
      ...row,
      _snf_opportunity_score: parseFloat(score.toFixed(2)),
      _beds_used_for_score: beds,
      _quality_pressure_component: parseFloat(qualityPressure.toFixed(2)),
    } as NursingHomeRow;
  });

  rows.sort((a, b) => b._snf_opportunity_score - a._snf_opportunity_score);

  return {
    rows: rows.slice(0, maxRows),
    total_records: data.length,
    interpretation_note: "Score = beds + quality pressure × 18. Lower star ratings = higher pressure = higher hospice opportunity.",
  };
}

// ─── NPI Lookup ───────────────────────────────────────────────────────────────

export interface NpiResult {
  rows: Record<string, unknown>[];
  result_count: number;
}

export async function lookupNpi(params: {
  first_name?: string;
  last_name?: string;
  organization_name?: string;
  state?: string;
  city?: string;
  taxonomy_description?: string;
  limit?: number;
}): Promise<NpiResult> {
  const q = new URLSearchParams({ version: "2.1", limit: String(params.limit ?? 20) });
  if (params.first_name) q.set("first_name", params.first_name);
  if (params.last_name) q.set("last_name", params.last_name);
  if (params.organization_name) q.set("organization_name", params.organization_name);
  if (params.state) q.set("state", params.state);
  if (params.city) q.set("city", params.city);
  if (params.taxonomy_description) q.set("taxonomy_description", params.taxonomy_description);

  const res = await fetch(`${NPPES_API}?${q}`, { signal: AbortSignal.timeout(30_000) });
  if (!res.ok) throw new Error(`NPPES API error ${res.status}`);
  const json = (await res.json()) as { results?: unknown[]; result_count?: number };

  return {
    rows: (json.results ?? []) as Record<string, unknown>[],
    result_count: json.result_count ?? 0,
  };
}
