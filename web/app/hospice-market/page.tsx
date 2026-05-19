"use client";

import { useState, useEffect } from "react";
import { Search, ExternalLink, AlertCircle } from "lucide-react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { StateSelect } from "@/components/shared/state-select";
import { LoadingSpinner } from "@/components/shared/loading-spinner";
import { ErrorBanner } from "@/components/shared/error-banner";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { mcp } from "@/lib/api";
import { formatNumber } from "@/lib/utils";
import type { HospiceResult, HospiceRow } from "@/lib/cms-direct";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

function currency(v: unknown) {
  const n = parseFloat(String(v ?? "0").replace(/,/g, ""));
  if (!n || isNaN(n)) return "—";
  return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 }).format(n);
}

function ShareBar({ share }: { share: number }) {
  const width = Math.min(share * 3, 100);
  return (
    <div className="flex items-center gap-2 min-w-[120px]">
      <div className="h-2 flex-1 rounded-full bg-[hsl(var(--border))]">
        <div className="h-2 rounded-full bg-[hsl(var(--primary))]" style={{ width: `${width}%` }} />
      </div>
      <span className="text-xs font-medium w-10 text-right">{share.toFixed(1)}%</span>
    </div>
  );
}

function CondPill({ label, value }: { label: string; value: unknown }) {
  const n = parseFloat(String(value ?? "0"));
  if (!n || isNaN(n)) return null;
  const display = n > 1 ? n : n * 100;
  if (display < 1) return null;
  return (
    <span className="inline-block rounded bg-[hsl(var(--muted))] px-1.5 py-0.5 text-xs whitespace-nowrap" title={label}>
      {label.slice(0, 3)}: {display.toFixed(0)}%
    </span>
  );
}

export default function HospiceMarketPage() {
  const [state, setState] = useState("TX");
  const [city, setCity] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<HospiceResult | null>(null);

  async function doSearch(s: string, c: string) {
    setLoading(true);
    setError(null);
    try {
      const data = (await mcp("hospice_market_share_proxy", {
        ...(s ? { state: s } : {}),
        ...(c ? { city: c } : {}),
        max_rows: 200,
      })) as HospiceResult;
      setResult(data);
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Request failed";
      setError(msg);
    } finally {
      setLoading(false);
    }
  }

  // Auto-load on mount with default state TX
  useEffect(() => { doSearch("TX", ""); }, []); // eslint-disable-line react-hooks/exhaustive-deps

  function handleSearch(e: React.FormEvent) {
    e.preventDefault();
    doSearch(state, city);
  }

  const isEmpty = result && result.rows.length === 0;

  return (
    <div className="mx-auto max-w-7xl px-4 py-8">
      <div className="mb-6">
        <h1 className="text-2xl font-bold tracking-tight">Hospice Market Share</h1>
        <p className="mt-1 text-sm text-[hsl(var(--muted-foreground))]">
          Medicare PAC utilization — beneficiary volume ranked by market share. Click any provider for full profile.
        </p>
      </div>

      <form onSubmit={handleSearch} className="mb-6 flex flex-wrap gap-3 items-end">
        <div>
          <label className="block text-xs font-medium text-[hsl(var(--muted-foreground))] mb-1">State</label>
          <StateSelect value={state} onChange={setState} placeholder="All states" />
        </div>
        <div>
          <label className="block text-xs font-medium text-[hsl(var(--muted-foreground))] mb-1">City (optional)</label>
          <Input placeholder="e.g. Houston" value={city} onChange={(e) => setCity(e.target.value)} className="w-48" />
        </div>
        <Button type="submit" disabled={loading}>
          <Search className="mr-2 h-4 w-4" />
          Search
        </Button>
      </form>

      {error && (
        <div className="mb-4 rounded-lg border border-red-200 bg-red-50 dark:border-red-900 dark:bg-red-950/20 p-4 flex gap-3 items-start">
          <AlertCircle className="h-5 w-5 text-red-500 shrink-0 mt-0.5" />
          <div>
            <p className="font-medium text-red-700 dark:text-red-400 text-sm">Error loading data</p>
            <p className="text-red-600 dark:text-red-300 text-xs mt-1 break-all">{error}</p>
            <p className="text-red-500 text-xs mt-2">Tip: Try visiting <Link href="/status" className="underline">/status</Link> to check if CMS APIs are reachable from this server.</p>
          </div>
        </div>
      )}

      {loading && <LoadingSpinner label="Fetching hospice market data from CMS…" />}

      {!loading && isEmpty && (
        <Alert>
          <AlertDescription>
            No hospice providers found for the selected filters. Try a different state or remove the city filter.
          </AlertDescription>
        </Alert>
      )}

      {!loading && result && result.rows.length > 0 && (
        <>
          <div className="mb-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
            {[
              { label: "Providers", value: formatNumber(result.rows.length) },
              { label: "Total Beneficiaries", value: formatNumber(result.total_volume) },
              { label: "Markets (Cities)", value: formatNumber(Object.keys(result.market_totals).length) },
              { label: "Filter", value: [city, state].filter(Boolean).join(", ") || "All States" },
            ].map((s) => (
              <div key={s.label} className="rounded-lg border border-[hsl(var(--border))] p-3">
                <p className="text-xs text-[hsl(var(--muted-foreground))]">{s.label}</p>
                <p className="mt-1 text-lg font-semibold">{s.value}</p>
              </div>
            ))}
          </div>

          <div className="rounded-lg border border-[hsl(var(--border))] overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-10">#</TableHead>
                  <TableHead>Provider</TableHead>
                  <TableHead>NPI</TableHead>
                  <TableHead>City</TableHead>
                  <TableHead>St</TableHead>
                  <TableHead className="text-right">Benes</TableHead>
                  <TableHead className="min-w-[150px]">Market Share</TableHead>
                  <TableHead className="text-right">Medicare Pmts</TableHead>
                  <TableHead className="text-right">Avg Age</TableHead>
                  <TableHead className="text-right">Risk</TableHead>
                  <TableHead className="text-right">Dual %</TableHead>
                  <TableHead>Conditions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {result.rows.map((row: HospiceRow, i) => (
                  <TableRow key={i}>
                    <TableCell className="text-[hsl(var(--muted-foreground))] text-xs">{row._rank}</TableCell>
                    <TableCell className="font-medium max-w-[200px]">
                      {row.Rndrng_Prvdr_NPI ? (
                        <Link
                          href={`/hospice/${row.Rndrng_Prvdr_NPI}`}
                          className="text-[hsl(var(--primary))] hover:underline flex items-center gap-1"
                          title={String(row.Rndrng_Prvdr_Org_Name ?? "")}
                        >
                          <span className="truncate">{String(row.Rndrng_Prvdr_Org_Name ?? row._provider_name ?? "—")}</span>
                          <ExternalLink className="h-3 w-3 shrink-0" />
                        </Link>
                      ) : (
                        <span className="truncate">{String(row.Rndrng_Prvdr_Org_Name ?? row._provider_name ?? "—")}</span>
                      )}
                    </TableCell>
                    <TableCell className="font-mono text-xs">
                      {row.Rndrng_Prvdr_NPI ? (
                        <Link href={`/provider/${row.Rndrng_Prvdr_NPI}`} className="text-[hsl(var(--primary))] hover:underline">
                          {String(row.Rndrng_Prvdr_NPI)}
                        </Link>
                      ) : "—"}
                    </TableCell>
                    <TableCell className="text-xs">{String(row.Rndrng_Prvdr_City ?? "—")}</TableCell>
                    <TableCell className="text-xs">{String(row.Rndrng_Prvdr_State_Abrvtn ?? "—")}</TableCell>
                    <TableCell className="text-right text-xs">{formatNumber(row._market_volume)}</TableCell>
                    <TableCell><ShareBar share={row._market_share_pct} /></TableCell>
                    <TableCell className="text-right text-xs">{currency(row.Tot_Mdcr_Pymt_Amt)}</TableCell>
                    <TableCell className="text-right text-xs">
                      {row.Bene_Avg_Age ? Number(row.Bene_Avg_Age).toFixed(1) : "—"}
                    </TableCell>
                    <TableCell className="text-right text-xs">
                      {row.Bene_Avg_Risk_Scre ? Number(row.Bene_Avg_Risk_Scre).toFixed(2) : "—"}
                    </TableCell>
                    <TableCell className="text-right text-xs">
                      {row.Bene_Dual_Cnt && row._market_volume > 0
                        ? `${((Number(row.Bene_Dual_Cnt) / row._market_volume) * 100).toFixed(0)}%`
                        : "—"}
                    </TableCell>
                    <TableCell>
                      <div className="flex flex-wrap gap-1">
                        <CondPill label="Cancer" value={row.Bene_CC_CancerX_Pct} />
                        <CondPill label="CHF" value={row.Bene_CC_CHF_Pct} />
                        <CondPill label="COPD" value={row.Bene_CC_COPD_Pct} />
                        <CondPill label="Alz" value={row.Bene_CC_Alzhmr_Pct} />
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>

          <Alert className="mt-4">
            <AlertDescription>{result.interpretation_note}</AlertDescription>
          </Alert>
        </>
      )}
    </div>
  );
}
