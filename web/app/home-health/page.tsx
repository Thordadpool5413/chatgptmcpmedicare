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
import { Badge } from "@/components/ui/badge";
import { mcp } from "@/lib/api";
import { formatNumber } from "@/lib/utils";
import type { HhaRow } from "@/lib/cms-direct";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

function currency(v: unknown) {
  const n = parseFloat(String(v ?? "0").replace(/,/g, ""));
  if (!n || isNaN(n)) return "—";
  return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 }).format(n);
}

function toPct(v: unknown) {
  const n = parseFloat(String(v ?? "0"));
  if (!n || isNaN(n)) return "—";
  const d = n > 1 ? n : n * 100;
  return `${d.toFixed(0)}%`;
}

function ScoreBadge({ score }: { score: number }) {
  const variant = score > 2000 ? "success" : score > 500 ? "warning" : "secondary";
  return <Badge variant={variant}>{formatNumber(Math.round(score))}</Badge>;
}

export default function HomeHealthPage() {
  const [state, setState] = useState("");
  const [city, setCity] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<{ rows: HhaRow[]; total_records: number; interpretation_note: string } | null>(null);

  async function handleSearch(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    try {
      const data = await mcp("hha_opportunity", {
        ...(state ? { state } : {}),
        ...(city ? { city } : {}),
        max_rows: 200,
      }) as { rows: HhaRow[]; total_records: number; interpretation_note: string };
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
        <h1 className="text-2xl font-bold tracking-tight">Home Health Agency Opportunity</h1>
        <p className="mt-1 text-sm text-[hsl(var(--muted-foreground))]">
          Medicare HHA utilization — beneficiary volume and payments scored by hospice referral opportunity. Click any NPI for full provider profile.
        </p>
      </div>

      <form onSubmit={handleSearch} className="mb-6 flex flex-wrap gap-3">
        <StateSelect value={state} onChange={setState} />
        <Input placeholder="City (optional)" value={city} onChange={(e) => setCity(e.target.value)} className="w-48" />
        <Button type="submit" disabled={loading}>
          <Search className="mr-2 h-4 w-4" />
          Search
        </Button>
      </form>

      {error && <ErrorBanner message={error} onDismiss={() => setError(null)} className="mb-4" />}
      {loading && <LoadingSpinner label="Fetching HHA data…" />}

      {!loading && result && (
        <>
          <div className="mb-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
            {[
              { label: "Agencies", value: formatNumber(result.rows.length) },
              { label: "Total Matched", value: formatNumber(result.total_records) },
              { label: "Top Score", value: formatNumber(Math.round(result.rows[0]?._opportunity_score ?? 0)) },
              { label: "Total Beneficiaries", value: formatNumber(result.rows.reduce((s, r) => s + (Number(r.Tot_Benes) || 0), 0)) },
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
                  <TableHead>Agency</TableHead>
                  <TableHead>CCN</TableHead>
                  <TableHead>City</TableHead>
                  <TableHead>State</TableHead>
                  <TableHead>Rural/Urban</TableHead>
                  <TableHead className="text-right">Beneficiaries</TableHead>
                  <TableHead className="text-right">Episodes</TableHead>
                  <TableHead className="text-right">Medicare Pmts</TableHead>
                  <TableHead className="text-right">Avg Age</TableHead>
                  <TableHead className="text-right">Risk Score</TableHead>
                  <TableHead className="text-right">Dual %</TableHead>
                  <TableHead className="text-right">CHF %</TableHead>
                  <TableHead className="text-right">Cancer %</TableHead>
                  <TableHead>Score</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {result.rows.map((row, i) => (
                  <TableRow key={i}>
                    <TableCell className="font-medium max-w-[200px] truncate" title={row.Rndrng_Prvdr_Org_Name}>
                      {row.Rndrng_Prvdr_CCN ? (
                        <Link href={`/provider/${row.Rndrng_Prvdr_CCN}`} className="text-[hsl(var(--primary))] hover:underline flex items-center gap-1">
                          <span className="truncate">{row.Rndrng_Prvdr_Org_Name ?? "—"}</span>
                          <ExternalLink className="h-3 w-3 shrink-0" />
                        </Link>
                      ) : (row.Rndrng_Prvdr_Org_Name ?? "—")}
                    </TableCell>
                    <TableCell className="font-mono text-xs">{row.Rndrng_Prvdr_CCN ?? "—"}</TableCell>
                    <TableCell className="text-xs">{row.Rndrng_Prvdr_City ?? "—"}</TableCell>
                    <TableCell className="text-xs">{row.Rndrng_Prvdr_State_Abrvtn ?? "—"}</TableCell>
                    <TableCell className="text-xs max-w-[100px] truncate">{row.Rndrng_Prvdr_RUCA_Desc ?? "—"}</TableCell>
                    <TableCell className="text-right text-xs">{formatNumber(Number(row.Tot_Benes))}</TableCell>
                    <TableCell className="text-right text-xs">{formatNumber(Number(row.Tot_Epsdss))}</TableCell>
                    <TableCell className="text-right text-xs">{currency(row.Tot_Mdcr_Pymt_Amt)}</TableCell>
                    <TableCell className="text-right text-xs">{row.Bene_Avg_Age ? Number(row.Bene_Avg_Age).toFixed(1) : "—"}</TableCell>
                    <TableCell className="text-right text-xs">{row.Bene_Avg_Risk_Scre ? Number(row.Bene_Avg_Risk_Scre).toFixed(2) : "—"}</TableCell>
                    <TableCell className="text-right text-xs">
                      {row.Bene_Dual_Cnt && row.Tot_Benes
                        ? `${((Number(row.Bene_Dual_Cnt) / Number(row.Tot_Benes)) * 100).toFixed(0)}%`
                        : toPct(row.Bene_CC_CancerX_Pct) === "—" ? "—" : toPct(row.Bene_Dual_Cnt)}
                    </TableCell>
                    <TableCell className="text-right text-xs">{toPct(row.Bene_CC_CHF_Pct)}</TableCell>
                    <TableCell className="text-right text-xs">{toPct(row.Bene_CC_CancerX_Pct)}</TableCell>
                    <TableCell><ScoreBadge score={row._opportunity_score} /></TableCell>
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
