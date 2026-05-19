import { NextResponse } from "next/server";

const HOSPICE_UUID = "4e73f1b5-82cb-4682-8ad2-28493f0b6840";
const CMS_DATA_API = "https://data.cms.gov/data-api/v1";

async function tryFetch(label: string, url: string) {
  try {
    const res = await fetch(url, { signal: AbortSignal.timeout(20_000) });
    const status = res.status;
    const text = await res.text();
    let parsed: unknown = null;
    let parseError: string | null = null;
    try { parsed = JSON.parse(text); } catch (e) { parseError = String(e); }

    let type = "unknown";
    let count = 0;
    let keys: string[] = [];
    let sample = "";

    if (Array.isArray(parsed)) {
      type = "array";
      count = parsed.length;
      if (count > 0) keys = Object.keys(parsed[0] as object).slice(0, 12);
    } else if (parsed && typeof parsed === "object") {
      type = "object";
      const obj = parsed as Record<string, unknown>;
      keys = Object.keys(obj).slice(0, 12);
      // Try common array fields
      for (const k of ["data", "results", "rows", "items", "records"]) {
        if (Array.isArray(obj[k])) {
          const arr = obj[k] as unknown[];
          count = arr.length;
          type = `object.${k}[${count}]`;
          if (count > 0) keys = Object.keys(arr[0] as object).slice(0, 12);
          break;
        }
      }
    }

    sample = text.slice(0, 300);

    return { label, url, status, ok: res.ok, type, count, keys, sample, parseError };
  } catch (e) {
    return { label, url, status: 0, ok: false, type: "error", count: 0, keys: [], sample: "", parseError: String(e) };
  }
}

export async function GET() {
  const tests = await Promise.all([
    tryFetch("Hospice DKAN no filter (size=10)", `${CMS_DATA_API}/dataset/${HOSPICE_UUID}/data?size=10`),
    tryFetch("Hospice DKAN limit=10", `${CMS_DATA_API}/dataset/${HOSPICE_UUID}/data?limit=10`),
    tryFetch("Hospice DKAN filter TX (size=10)", `${CMS_DATA_API}/dataset/${HOSPICE_UUID}/data?size=10&filter[Rndrng_Prvdr_State_Abrvtn]=TX`),
    tryFetch("Hospice DKAN metadata", `${CMS_DATA_API}/dataset/${HOSPICE_UUID}`),
  ]);

  return NextResponse.json({ tests });
}
