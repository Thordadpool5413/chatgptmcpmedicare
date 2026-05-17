"use client";

import { useState } from "react";
import { Search } from "lucide-react";
import { Button } from "@/components/ui/button";
import { StateSelect } from "@/components/shared/state-select";
import { DataTable, type Column } from "@/components/shared/data-table";
import { LoadingSpinner } from "@/components/shared/loading-spinner";
import { ErrorBanner } from "@/components/shared/error-banner";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { mcp } from "@/lib/api";
import { formatPercent, formatNumber } from "@/lib/utils";

interface HospiceRow {
  _market_share?: number;
  _volume?: number;
  [key: string]: unknown;
}

interface HospiceResult {
  rows: HospiceRow[];
  market_totals?: Record<string, number>;
  volume_column_used?: string;
  provider_column_used?: string;
  market_column_used?: string;
  interpretation_note?: string;
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
      const sorted = [...(data.rows ?? [])].sort(
        (a, b) => (b._market_share ?? 0) - (a._market_share ?? 0),
      );
      setResult({ ...data, rows: sorted });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Request failed");
    } finally {
      setLoading(false);
    }
  }

  const provKey = result?.provider_column_used ?? "Provider";
  const volKey = result?.volume_column_used ?? "Tot_Benes";
  const mktKey = result?.market_column_used ?? "Market";

  const columns: Column<HospiceRow>[] = [
    { key: provKey, label: "Provider" },
    { key: mktKey, label: "Market" },
    {
      key: volKey,
      label: "Volume",
      render: (v) => formatNumber(Number(v)),
    },
    {
      key: "_market_share",
      label: "Market Share",
      render: (v) => formatPercent(Number(v)),
    },
  ];

  return (
    <div className="mx-auto max-w-7xl px-4 py-8">
      <div className="mb-6">
        <h1 className="text-2xl font-bold tracking-tight">Hospice Market Share</h1>
        <p className="mt-1 text-sm text-[hsl(var(--muted-foreground))]">
          Medicare PAC utilization data — providers ranked by market share
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

      {loading && <LoadingSpinner label="Fetching hospice market data..." />}

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
