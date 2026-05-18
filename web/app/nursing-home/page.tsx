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
import type { NursingHomeRow } from "@/lib/cms-direct";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

function Stars({ rating }: { rating: unknown }) {
  const n = Number(rating);
  if (!n || isNaN(n)) return <span className="text-[hsl(var(--muted-foreground))]">—</span>;
  return (
    <span title={`${n} / 5 stars`}>
      {Array.from({ length: 5 }, (_, i) => (
        <span key={i} className={i < n ? "text-amber-400" : "text-[hsl(var(--border))]"}>★</span>
      ))}
    </span>
  );
}

function ScoreBadge({ score }: { score: number }) {
  const variant = score > 500 ? "success" : score > 200 ? "warning" : "secondary";
  return <Badge variant={variant}>{formatNumber(score)}</Badge>;
}

export default function NursingHomePage() {
  const [state, setState] = useState("");
  const [city, setCity] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<{ rows: NursingHomeRow[]; total_records: number; interpretation_note: string } | null>(null);

  async function handleSearch(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    try {
      const data = await mcp("nursing_home_opportunity", {
        ...(state ? { state } : {}),
        ...(city ? { city } : {}),
        max_rows: 200,
      }) as { rows: NursingHomeRow[]; total_records: number; interpretation_note: string };
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
        <h1 className="text-2xl font-bold tracking-tight">Nursing Home Opportunity</h1>
        <p className="mt-1 text-sm text-[hsl(var(--muted-foreground))]">
          CMS-rated SNFs scored by hospice referral opportunity
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
      {loading && <LoadingSpinner label="Fetching nursing home data…" />}

      {!loading && result && (
        <>
          <div className="mb-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
            {[
              { label: "Records", value: formatNumber(result.rows.length) },
              { label: "Total Matched", value: formatNumber(result.total_records) },
              { label: "Top Score", value: formatNumber(result.rows[0]?._snf_opportunity_score ?? 0) },
              { label: "Total Beds", value: formatNumber(result.rows.reduce((s, r) => s + (Number(r["Number of Certified Beds"]) || 0), 0)) },
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
                  <TableHead>Facility</TableHead>
                  <TableHead>Address</TableHead>
                  <TableHead>City</TableHead>
                  <TableHead>State</TableHead>
                  <TableHead>ZIP</TableHead>
                  <TableHead>Phone</TableHead>
                  <TableHead>Ownership</TableHead>
                  <TableHead className="text-right">Beds</TableHead>
                  <TableHead className="text-right">Residents</TableHead>
                  <TableHead>Overall</TableHead>
                  <TableHead>Health Insp.</TableHead>
                  <TableHead>Staffing</TableHead>
                  <TableHead>RN Staff</TableHead>
                  <TableHead>QM</TableHead>
                  <TableHead>Quality Pressure</TableHead>
                  <TableHead>Score</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {result.rows.map((row, i) => (
                  <TableRow key={i}>
                    <TableCell className="font-medium max-w-[160px] truncate" title={row["Provider Name"]}>{row["Provider Name"] ?? "—"}</TableCell>
                    <TableCell className="text-xs max-w-[140px] truncate" title={row["Provider Address"] as string}>{row["Provider Address"] ?? "—"}</TableCell>
                    <TableCell>{row["City/Town"] ?? "—"}</TableCell>
                    <TableCell>{row.State ?? "—"}</TableCell>
                    <TableCell className="text-xs">{row["ZIP Code"] ?? "—"}</TableCell>
                    <TableCell className="text-xs">{row["Phone Number"] ?? "—"}</TableCell>
                    <TableCell className="text-xs max-w-[120px] truncate">{row["Ownership Type"] ?? "—"}</TableCell>
                    <TableCell className="text-right">{formatNumber(Number(row["Number of Certified Beds"]))}</TableCell>
                    <TableCell className="text-right">{formatNumber(Number(row["Number of Residents in Certified Beds"]))}</TableCell>
                    <TableCell><Stars rating={row["Overall Rating"]} /></TableCell>
                    <TableCell><Stars rating={row["Health Inspection Rating"]} /></TableCell>
                    <TableCell><Stars rating={row["Staffing Rating"]} /></TableCell>
                    <TableCell><Stars rating={row["RN Staffing Rating"]} /></TableCell>
                    <TableCell><Stars rating={row["QM Rating"]} /></TableCell>
                    <TableCell className="text-right text-xs">{row._quality_pressure_component.toFixed(2)}</TableCell>
                    <TableCell><ScoreBadge score={row._snf_opportunity_score} /></TableCell>
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
