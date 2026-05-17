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

interface NursingHomeRow {
  "Provider Name"?: string;
  "City/Town"?: string;
  State?: string;
  "Number of Certified Beds"?: number;
  "Overall Rating"?: string;
  _snf_opportunity_score?: number;
  [key: string]: unknown;
}

interface NursingHomeResult {
  rows: NursingHomeRow[];
  interpretation_note?: string;
}

function ScoreBadge({ score }: { score: number }) {
  const variant = score > 500 ? "success" : score > 100 ? "warning" : "secondary";
  return <Badge variant={variant}>{formatNumber(score)}</Badge>;
}

const columns: Column<NursingHomeRow>[] = [
  { key: "Provider Name", label: "Facility" },
  { key: "City/Town", label: "City" },
  { key: "State", label: "State" },
  {
    key: "Number of Certified Beds",
    label: "Beds",
    render: (v) => formatNumber(Number(v)),
  },
  { key: "Overall Rating", label: "Rating" },
  {
    key: "_snf_opportunity_score",
    label: "Score",
    render: (v) => <ScoreBadge score={Number(v)} />,
  },
];

export default function NursingHomePage() {
  const [state, setState] = useState("");
  const [city, setCity] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<NursingHomeResult | null>(null);

  async function handleSearch(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    try {
      const data = (await mcp("nursing_home_opportunity", {
        ...(state ? { state } : {}),
        ...(city ? { city } : {}),
        max_rows: 200,
      })) as NursingHomeResult;
      const sorted = [...(data.rows ?? [])].sort(
        (a, b) => (b._snf_opportunity_score ?? 0) - (a._snf_opportunity_score ?? 0),
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
        <h1 className="text-2xl font-bold tracking-tight">Nursing Home Opportunity</h1>
        <p className="mt-1 text-sm text-[hsl(var(--muted-foreground))]">
          SNF providers ranked by hospice opportunity score
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

      {loading && <LoadingSpinner label="Fetching nursing home data..." />}

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
