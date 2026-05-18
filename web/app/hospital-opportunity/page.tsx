"use client";

import { useState } from "react";
import { Search } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { StateSelect } from "@/components/shared/state-select";
import { LoadingSpinner } from "@/components/shared/loading-spinner";
import { ErrorBanner } from "@/components/shared/error-banner";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { mcp } from "@/lib/api";
import { formatNumber } from "@/lib/utils";
import type { HospitalRow } from "@/lib/cms-direct";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

function currency(v: unknown) {
  const n = parseFloat(String(v ?? "0").replace(/,/g, ""));
  if (!n || isNaN(n)) return "—";
  return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 }).format(n);
}

function ScoreBadge({ score }: { score: number }) {
  const variant = score > 500 ? "success" : score > 100 ? "warning" : "secondary";
  return <Badge variant={variant}>{formatNumber(score)}</Badge>;
}

export default function HospitalOpportunityPage() {
  const [state, setState] = useState("");
  const [city, setCity] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<{ rows: HospitalRow[]; total_records: number; interpretation_note: string } | null>(null);

  async function handleSearch(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    try {
      const data = await mcp("hospital_hospice_opportunity", {
        ...(state ? { state } : {}),
        ...(city ? { city } : {}),
        max_rows: 200,
      }) as { rows: HospitalRow[]; total_records: number; interpretation_note: string };
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
        <h1 className="text-2xl font-bold tracking-tight">Hospital Opportunity</h1>
        <p className="mt-1 text-sm text-[hsl(var(--muted-foreground))]">
          Medicare inpatient discharges scored by hospice referral opportunity
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
      {loading && <LoadingSpinner label="Fetching hospital data…" />}

      {!loading && result && (
        <>
          <div className="mb-4 grid grid-cols-2 gap-3 sm:grid-cols-3">
            {[
              { label: "Records Returned", value: formatNumber(result.rows.length) },
              { label: "Total Matched", value: formatNumber(result.total_records) },
              { label: "Top Score", value: formatNumber(result.rows[0]?._opportunity_score ?? 0) },
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
                  <TableHead>Hospital</TableHead>
                  <TableHead>City</TableHead>
                  <TableHead>State</TableHead>
                  <TableHead>ZIP</TableHead>
                  <TableHead>CCN</TableHead>
                  <TableHead>DRG Code</TableHead>
                  <TableHead>DRG Description</TableHead>
                  <TableHead className="text-right">Discharges</TableHead>
                  <TableHead className="text-right">Avg Submitted</TableHead>
                  <TableHead className="text-right">Avg Total Pmt</TableHead>
                  <TableHead className="text-right">Avg Medicare Pmt</TableHead>
                  <TableHead>Hospice DRG Match</TableHead>
                  <TableHead>Score</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {result.rows.map((row, i) => (
                  <TableRow key={i}>
                    <TableCell className="font-medium max-w-[180px] truncate" title={row.Rndrng_Prvdr_Org_Name}>{row.Rndrng_Prvdr_Org_Name ?? "—"}</TableCell>
                    <TableCell>{row.Rndrng_Prvdr_City ?? "—"}</TableCell>
                    <TableCell>{row.Rndrng_Prvdr_State_Abrvtn ?? "—"}</TableCell>
                    <TableCell className="text-xs">{row.Rndrng_Prvdr_Zip_Cd ?? "—"}</TableCell>
                    <TableCell className="text-xs">{row.Rndrng_Prvdr_CCN ?? "—"}</TableCell>
                    <TableCell className="text-xs">{row.DRG_Cd ?? "—"}</TableCell>
                    <TableCell className="max-w-[200px] truncate text-xs" title={row.DRG_Desc}>{row.DRG_Desc ?? "—"}</TableCell>
                    <TableCell className="text-right">{formatNumber(Number(row.Tot_Dschrgs))}</TableCell>
                    <TableCell className="text-right">{currency(row.Avg_Submtd_Cvrd_Chrg)}</TableCell>
                    <TableCell className="text-right">{currency(row.Avg_Tot_Pymt_Amt)}</TableCell>
                    <TableCell className="text-right">{currency(row.Avg_Mdcr_Pymt_Amt)}</TableCell>
                    <TableCell>
                      {row._matched_hospice_terms.length > 0 ? (
                        <Badge variant="success">{row._matched_hospice_terms.slice(0, 2).join(", ")}</Badge>
                      ) : (
                        <Badge variant="secondary">None</Badge>
                      )}
                    </TableCell>
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
