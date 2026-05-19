"use client";

import { useState } from "react";
import { Search, ExternalLink } from "lucide-react";
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
  return (
    <div className="flex items-center gap-2">
      <div className="h-2 w-24 rounded-full bg-[hsl(var(--border))]">
        <div className="h-2 rounded-full bg-[hsl(var(--primary))]" style={{ width: `${Math.min(share * 3, 100)}%` }} />
      </div>
      <span className="text-xs font-medium">{share.toFixed(1)}%</span>
    </div>
  );
}

function CondPill({ label, value }: { label: string; value: unknown }) {
  const n = parseFloat(String(value ?? "0"));
  if (!n || isNaN(n)) return null;
  const display = n > 1 ? n : n * 100;
  if (display < 1) return null;
  return (
    <span className="inline-block rounded bg-[hsl(var(--muted))] px-1.5 py-0.5 text-xs" title={label}>
      {label}: {display.toFixed(0)}%
    </span>
  );
}

export default function HospiceMarketPage() {
  const [state, setState] = useState("");
  const [city, setCity] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<HospiceResult | null>(null);

  async function handleSearch(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    try {
      const data = (await mcp("hospice_market_share_proxy", {
        ...(state ? { state } : {}),
        ...(city ? { city } : {}),
        max_rows: 200,
      })) as HospiceResult;
      setResult(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Request failed");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="mx-auto max-w-7xl px-4 py-8">
      <div className="mb-6">
        <h1 className="text-2xl font-bold tracking-tight">Hospice Market Share</h1>
        <p className="mt-1 text-sm text-[hsl(var(--muted-foreground))]">
          Medicare PAC utilization — beneficiary volume ranked by market share. Click any provider for full profile.
        </p>
      </div>

      <form onSubmit={handleSearch} className="mb-6 flex flex-wrap gap-3">
        <StateSelect value={state} onChange={setState} placeholder="All states" />
        <Input
          placeholder="City (optional)"
          value={city}
          onChange={(e) => setCity(e.target.value)}
          className="w-48"
        />
        <Button type="submit" disabled={loading}>
          <Search className="mr-2 h-4 w-4" />
          Search
        </Button>
      </form>

      {error && <ErrorBanner message={error} onDismiss={() => setError(null)} className="mb-4" />}
      {loading && <LoadingSpinner label="Fetching hospice market data…" />}

      {!loading && result && (
        <>
          <div className="mb-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
            {[
              { label: "Providers", value: formatNumber(result.rows.length) },
              { label: "Total Beneficiaries", value: formatNumber(result.total_volume) },
              { label: "Markets", value: formatNumber(Object.keys(result.market_totals).length) },
              { label: "Filter", value: [city, state].filter(Boolean).join(", ") || "All" },
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
                  <TableHead>State</TableHead>
                  <TableHead>ZIP</TableHead>
                  <TableHead className="text-right">Benes</TableHead>
                  <TableHead>Market Share</TableHead>
                  <TableHead className="text-right">Medicare Pmts</TableHead>
                  <TableHead className="text-right">Avg Age</TableHead>
                  <TableHead className="text-right">Risk Score</TableHead>
                  <TableHead className="text-right">Dual %</TableHead>
                  <TableHead>Top Conditions</TableHead>
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
                    <TableCell className="text-xs">{String(row.Rndrng_Prvdr_Zip_Cd ?? "—")}</TableCell>
                    <TableCell className="text-right text-xs">{formatNumber(row._market_volume)}</TableCell>
                    <TableCell><ShareBar share={row._market_share_pct} /></TableCell>
                    <TableCell className="text-right text-xs">{currency(row.Tot_Mdcr_Pymt_Amt)}</TableCell>
                    <TableCell className="text-right text-xs">{row.Bene_Avg_Age ? Number(row.Bene_Avg_Age).toFixed(1) : "—"}</TableCell>
                    <TableCell className="text-right text-xs">{row.Bene_Avg_Risk_Scre ? Number(row.Bene_Avg_Risk_Scre).toFixed(2) : "—"}</TableCell>
                    <TableCell className="text-right text-xs">
                      {row.Bene_Dual_Cnt && row._market_volume > 0
                        ? `${((Number(row.Bene_Dual_Cnt) / row._market_volume) * 100).toFixed(0)}%`
                        : "—"}
                    </TableCell>
                    <TableCell>
                      <div className="flex flex-wrap gap-1 max-w-[200px]">
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
