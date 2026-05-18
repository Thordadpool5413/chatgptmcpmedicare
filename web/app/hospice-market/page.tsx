"use client";

import { useState } from "react";
import { Search } from "lucide-react";
import { Button } from "@/components/ui/button";
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

function ShareBar({ pct }: { pct: number }) {
  return (
    <div className="flex items-center gap-2">
      <div className="h-2 w-24 rounded-full bg-[hsl(var(--border))]">
        <div
          className="h-2 rounded-full bg-[hsl(var(--primary))]"
          style={{ width: `${Math.min(pct * 3, 100)}%` }}
        />
      </div>
      <span className="text-xs font-medium">{pct.toFixed(1)}%</span>
    </div>
  );
}

export default function HospiceMarketPage() {
  const [state, setState] = useState("");
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
        max_rows: 200,
      })) as HospiceResult;
      setResult(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Request failed");
    } finally {
      setLoading(false);
    }
  }

  const prov = result?.provider_column_used ?? "Rndrng_Prvdr_Org_Name";
  const vol = result?.volume_column_used ?? "Tot_Benes";

  return (
    <div className="mx-auto max-w-7xl px-4 py-8">
      <div className="mb-6">
        <h1 className="text-2xl font-bold tracking-tight">Hospice Market Share</h1>
        <p className="mt-1 text-sm text-[hsl(var(--muted-foreground))]">
          Medicare PAC utilization — beneficiary volume ranked by market share
        </p>
      </div>

      <form onSubmit={handleSearch} className="mb-6 flex flex-wrap gap-3">
        <StateSelect value={state} onChange={setState} placeholder="All states" />
        <Button type="submit" disabled={loading}>
          <Search className="mr-2 h-4 w-4" />
          Search
        </Button>
      </form>

      {error && <ErrorBanner message={error} onDismiss={() => setError(null)} className="mb-4" />}
      {loading && <LoadingSpinner label="Fetching hospice market data…" />}

      {!loading && result && (
        <>
          {/* Summary stats */}
          <div className="mb-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
            {[
              { label: "Providers", value: formatNumber(result.rows.length) },
              { label: "Total Beneficiaries", value: formatNumber(result.total_volume) },
              { label: "Markets", value: formatNumber(Object.keys(result.market_totals).length) },
              { label: "State Filter", value: state || "All States" },
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
                  <TableHead>City</TableHead>
                  <TableHead>State</TableHead>
                  <TableHead>ZIP</TableHead>
                  <TableHead>Market</TableHead>
                  <TableHead className="text-right">Beneficiaries</TableHead>
                  <TableHead className="text-right">Market Total</TableHead>
                  <TableHead>Market Share</TableHead>
                  <TableHead className="text-right">Medicare Payments</TableHead>
                  <TableHead className="text-right">Avg Age</TableHead>
                  <TableHead className="text-right">Risk Score</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {result.rows.map((row: HospiceRow, i) => (
                  <TableRow key={i}>
                    <TableCell className="text-[hsl(var(--muted-foreground))] text-xs">{row._rank}</TableCell>
                    <TableCell className="font-medium max-w-[200px] truncate" title={String(row[prov] ?? "")}>
                      {String(row[prov] ?? "—")}
                    </TableCell>
                    <TableCell>{String(row.Rndrng_Prvdr_City ?? row["City"] ?? "—")}</TableCell>
                    <TableCell>{String(row.Rndrng_Prvdr_State_Abrvtn ?? row["State"] ?? "—")}</TableCell>
                    <TableCell className="text-xs">{String(row.Rndrng_Prvdr_Zip_Cd ?? "—")}</TableCell>
                    <TableCell className="max-w-[120px] truncate text-xs" title={row._market}>{row._market}</TableCell>
                    <TableCell className="text-right">{formatNumber(row._market_volume)}</TableCell>
                    <TableCell className="text-right">{formatNumber(row._market_total_volume)}</TableCell>
                    <TableCell><ShareBar pct={row._market_share_pct} /></TableCell>
                    <TableCell className="text-right">{currency(row.Tot_Mdcr_Pymt_Amt ?? row["Tot_Mdcr_Pymt_Amt"])}</TableCell>
                    <TableCell className="text-right">{row.Bene_Avg_Age ? Number(row.Bene_Avg_Age).toFixed(1) : "—"}</TableCell>
                    <TableCell className="text-right">{row.Bene_Avg_Risk_Scre ? Number(row.Bene_Avg_Risk_Scre).toFixed(2) : "—"}</TableCell>
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
