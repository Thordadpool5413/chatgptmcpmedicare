"use client";

import { useState } from "react";
import { Search } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { StateSelect } from "@/components/shared/state-select";
import { DataTable, type Column } from "@/components/shared/data-table";
import { LoadingSpinner } from "@/components/shared/loading-spinner";
import { ErrorBanner } from "@/components/shared/error-banner";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { mcp } from "@/lib/api";
import { formatNumber } from "@/lib/utils";

interface HospitalRow {
  Rndrng_Prvdr_Org_Name?: string;
  Rndrng_Prvdr_City?: string;
  Rndrng_Prvdr_State_Abrvtn?: string;
  DRG_Desc?: string;
  Tot_Dschrgs?: number;
  _opportunity_score?: number;
  [key: string]: unknown;
}

interface HospitalResult {
  rows: HospitalRow[];
  interpretation_note?: string;
}

function ScoreBadge({ score }: { score: number }) {
  const variant = score > 500 ? "success" : score > 100 ? "warning" : "secondary";
  return <Badge variant={variant}>{formatNumber(score)}</Badge>;
}

const columns: Column<HospitalRow>[] = [
  { key: "Rndrng_Prvdr_Org_Name", label: "Hospital" },
  { key: "Rndrng_Prvdr_City", label: "City" },
  { key: "Rndrng_Prvdr_State_Abrvtn", label: "State" },
  {
    key: "DRG_Desc",
    label: "DRG",
    render: (v) => <span title={String(v ?? "")}>{String(v ?? "").slice(0, 45)}{String(v ?? "").length > 45 ? "…" : ""}</span>,
  },
  {
    key: "Tot_Dschrgs",
    label: "Discharges",
    render: (v) => formatNumber(Number(v)),
  },
  {
    key: "_opportunity_score",
    label: "Score",
    render: (v) => <ScoreBadge score={Number(v)} />,
  },
];

export default function HospitalOpportunityPage() {
  const [state, setState] = useState("");
  const [city, setCity] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<HospitalResult | null>(null);

  async function handleSearch(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    try {
      const data = (await mcp("hospital_hospice_opportunity", {
        ...(state ? { state } : {}),
        ...(city ? { city } : {}),
        max_rows: 200,
      })) as HospitalResult;
      const sorted = [...(data.rows ?? [])].sort(
        (a, b) => (b._opportunity_score ?? 0) - (a._opportunity_score ?? 0),
      );
      setResult({ ...data, rows: sorted });
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
          Hospitals ranked by hospice referral opportunity score
        </p>
      </div>

      <form onSubmit={handleSearch} className="mb-6 flex flex-wrap gap-3">
        <StateSelect value={state} onChange={setState} />
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

      {loading && <LoadingSpinner label="Fetching hospital data..." />}

      {!loading && result && (
        <>
          <DataTable columns={columns} rows={result.rows} />
          {result.interpretation_note && (
            <Alert className="mt-4">
              <AlertDescription>{result.interpretation_note}</AlertDescription>
            </Alert>
          )}
        </>
      )}
    </div>
  );
}
