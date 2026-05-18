// Direct CMS API calls — no Python server needed

const CMS_DATA_API = "https://data.cms.gov/data-api/v1";
const PROVIDER_DATA_API = "https://data.cms.gov/provider-data/api/1";
const NPPES_API = "https://npiregistry.cms.hhs.gov/api/";

const HOSPICE_UUID = "4e73f1b5-82cb-4682-8ad2-28493f0b6840";
const HOSPITAL_UUID = "690ddc6c-2767-4618-b277-420ffb2bf27c";
const NURSING_HOME_ID = "4pq5-n9py";

function num(v: unknown): number {
  if (v == null) return 0;
  const n = parseFloat(String(v).replace(/,/g, ""));
  return isNaN(n) ? 0 : n;
}

export interface HospiceRow {
  _market_share?: number;
  _volume?: number;
  provider_column_used?: string;
  [key: string]: unknown;
}

export interface HospiceResult {
  rows: HospiceRow[];
  provider_column_used: string;
  volume_column_used: string;
  market_column_used: string;
  interpretation_note: string;
}

export async function getHospiceMarketShare(state?: string, maxRows = 200): Promise<HospiceResult> {
  const params = new URLSearchParams({ size: String(Math.min(maxRows, 2000)) });
  if (state) params.set("filter[Rndrng_Prvdr_State_Abrvtn]", state);

  const res = await fetch(`${CMS_DATA_API}/dataset/${HOSPICE_UUID}/data?${params}`, {
    signal: AbortSignal.timeout(30_000),
  });
  if (!res.ok) throw new Error(`CMS API error ${res.status}`);
  const data = (await res.json()) as Record<string, unknown>[];

  // Find relevant columns
  const sample = data[0] ?? {};
  const keys = Object.keys(sample);
  const provCol = keys.find((k) => /prvdr.*org|provider.*name/i.test(k)) ?? keys[0];
  const volCol = keys.find((k) => /tot.*benes|beneficiar/i.test(k)) ?? keys.find((k) => /tot/i.test(k)) ?? keys[2];
  const stateCol = keys.find((k) => /state.*abrvtn|state/i.test(k)) ?? "";
  const mktCol = keys.find((k) => /county|city|hrr|market/i.test(k)) ?? stateCol;

  // Compute market totals per market
  const mktTotals: Record<string, number> = {};
  for (const row of data) {
    const mkt = String(row[mktCol] ?? "ALL");
    mktTotals[mkt] = (mktTotals[mkt] ?? 0) + num(row[volCol]);
  }

  const rows = data.map((row) => {
    const mkt = String(row[mktCol] ?? "ALL");
    const vol = num(row[volCol]);
    const total = mktTotals[mkt] || 1;
    return { ...row, _volume: vol, _market_share: vol / total };
  });

  rows.sort((a, b) => (b._market_share ?? 0) - (a._market_share ?? 0));

  return {
    rows: rows.slice(0, maxRows),
    provider_column_used: provCol,
    volume_column_used: volCol,
    market_column_used: mktCol,
    interpretation_note: "Market share computed from Medicare PAC utilization beneficiary volume.",
  };
}

const HOSPICE_DRG_TERMS = [
  "heart failure", "sepsis", "respiratory", "copd", "pneumonia",
  "renal failure", "kidney", "stroke", "malignancy", "cancer",
  "dementia", "cirrhosis", "liver", "failure",
];

function isDrgRelevant(drg: string): boolean {
  const d = drg.toLowerCase();
  return HOSPICE_DRG_TERMS.some((t) => d.includes(t));
}

export interface HospitalRow {
  Rndrng_Prvdr_Org_Name?: string;
  Rndrng_Prvdr_City?: string;
  Rndrng_Prvdr_State_Abrvtn?: string;
  DRG_Desc?: string;
  Tot_Dschrgs?: number;
  _opportunity_score?: number;
  [key: string]: unknown;
}

export async function getHospitalOpportunity(
  state?: string,
  city?: string,
  maxRows = 200,
): Promise<{ rows: HospitalRow[]; interpretation_note: string }> {
  const params = new URLSearchParams({ size: "2000" });
  if (state) params.set("filter[Rndrng_Prvdr_State_Abrvtn]", state);
  if (city) params.set("filter[Rndrng_Prvdr_City]", city.toUpperCase());

  const res = await fetch(`${CMS_DATA_API}/dataset/${HOSPITAL_UUID}/data?${params}`, {
    signal: AbortSignal.timeout(30_000),
  });
  if (!res.ok) throw new Error(`CMS API error ${res.status}`);
  const data = (await res.json()) as HospitalRow[];

  const rows = data.map((row) => {
    const discharges = num(row.Tot_Dschrgs);
    const relevant = isDrgRelevant(String(row.DRG_Desc ?? "")) ? 1.5 : 1.0;
    return { ...row, _opportunity_score: Math.round(discharges * relevant) };
  });

  rows.sort((a, b) => (b._opportunity_score ?? 0) - (a._opportunity_score ?? 0));

  return {
    rows: rows.slice(0, maxRows),
    interpretation_note: "Opportunity score = discharge volume weighted by hospice-relevant DRGs.",
  };
}

export interface NursingHomeRow {
  "Provider Name"?: string;
  "City/Town"?: string;
  State?: string;
  "Number of Certified Beds"?: number;
  "Overall Rating"?: string;
  _snf_opportunity_score?: number;
  [key: string]: unknown;
}

export async function getNursingHomeOpportunity(
  state?: string,
  city?: string,
  maxRows = 200,
): Promise<{ rows: NursingHomeRow[]; interpretation_note: string }> {
  const conditions: Record<string, string> = {};
  if (state) conditions["State"] = state;
  if (city) conditions["City/Town"] = city.toUpperCase();

  const body = {
    conditions: Object.entries(conditions).map(([property, value]) => ({
      property, value, operator: "=",
    })),
    limit: 2000,
    offset: 0,
  };

  const res = await fetch(`${PROVIDER_DATA_API}/datastore/query/${NURSING_HOME_ID}/0`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(30_000),
  });
  if (!res.ok) throw new Error(`Provider Data API error ${res.status}`);
  const json = (await res.json()) as { results?: NursingHomeRow[] };
  const data = json.results ?? [];

  const rows = data.map((row) => {
    const beds = num(row["Number of Certified Beds"]);
    const rating = num(row["Overall Rating"]) || 3;
    return { ...row, _snf_opportunity_score: Math.round(beds * rating * 10) };
  });

  rows.sort((a, b) => (b._snf_opportunity_score ?? 0) - (a._snf_opportunity_score ?? 0));

  return {
    rows: rows.slice(0, maxRows),
    interpretation_note: "Opportunity score = certified beds × overall rating.",
  };
}

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
