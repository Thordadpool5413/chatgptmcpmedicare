"use client";

import { useState, useEffect, useCallback } from "react";
import { RefreshCw, Database } from "lucide-react";
import { Button } from "@/components/ui/button";
import { DataTable, type Column } from "@/components/shared/data-table";
import { LoadingSpinner } from "@/components/shared/loading-spinner";
import { ErrorBanner } from "@/components/shared/error-banner";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { mcp } from "@/lib/api";

interface CachedDataset {
  dataset_key: string;
  source_name?: string;
  row_count?: number;
  cached_at?: string;
  scope?: string;
  [key: string]: unknown;
}

interface CacheResult {
  results: Record<string, { status?: string; row_count?: number; error?: string }>;
  note?: string;
}

const datasetColumns: Column<CachedDataset>[] = [
  { key: "dataset_key", label: "Dataset Key" },
  { key: "source_name", label: "Source" },
  {
    key: "row_count",
    label: "Rows",
    render: (v) => v != null ? Number(v).toLocaleString() : "—",
  },
  { key: "scope", label: "Scope" },
  {
    key: "cached_at",
    label: "Cached At",
    render: (v) => v ? new Date(String(v)).toLocaleString() : "—",
  },
];

interface CacheResultRow {
  dataset: string;
  status: string;
  details: string;
  [key: string]: unknown;
}

const resultColumns: Column<CacheResultRow>[] = [
  { key: "dataset", label: "Dataset" },
  {
    key: "status",
    label: "Status",
    render: (v) => (
      <Badge variant={v === "ok" ? "success" : v === "skipped" ? "secondary" : "destructive"}>
        {String(v)}
      </Badge>
    ),
  },
  { key: "details", label: "Details" },
];

export default function CacheManagementPage() {
  const [cached, setCached] = useState<CachedDataset[] | null>(null);
  const [loadingList, setLoadingList] = useState(true);
  const [listError, setListError] = useState<string | null>(null);
  const [caching, setCaching] = useState(false);
  const [cacheError, setCacheError] = useState<string | null>(null);
  const [cacheResults, setCacheResults] = useState<CacheResultRow[] | null>(null);

  const loadList = useCallback(async () => {
    setLoadingList(true);
    setListError(null);
    try {
      const data = (await mcp("list_cached_national_datasets", {})) as {
        cached_datasets?: CachedDataset[];
      };
      setCached(data.cached_datasets ?? []);
    } catch (err) {
      setListError(err instanceof Error ? err.message : "Failed to load cache list");
    } finally {
      setLoadingList(false);
    }
  }, []);

  useEffect(() => {
    loadList();
  }, [loadList]);

  async function handleCacheCore() {
    setCaching(true);
    setCacheError(null);
    setCacheResults(null);
    try {
      const data = (await mcp("cache_core_national_datasets", { overwrite: false })) as CacheResult;
      const rows: CacheResultRow[] = Object.entries(data.results ?? {}).map(([key, val]) => ({
        dataset: key,
        status: val.status ?? "unknown",
        details: val.error ?? (val.row_count != null ? `${val.row_count.toLocaleString()} rows` : "—"),
      }));
      setCacheResults(rows);
      await loadList();
    } catch (err) {
      setCacheError(err instanceof Error ? err.message : "Cache operation failed");
    } finally {
      setCaching(false);
    }
  }

  return (
    <div className="mx-auto max-w-7xl px-4 py-8">
      <div className="mb-6">
        <h1 className="text-2xl font-bold tracking-tight">Cache Management</h1>
        <p className="mt-1 text-sm text-[hsl(var(--muted-foreground))]">
          Manage locally cached CMS national datasets for faster queries
        </p>
      </div>

      <section className="mb-8">
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-lg font-semibold">Cached Datasets</h2>
          <Button variant="outline" size="sm" onClick={loadList} disabled={loadingList}>
            <RefreshCw className={`mr-2 h-4 w-4 ${loadingList ? "animate-spin" : ""}`} />
            Refresh
          </Button>
        </div>

        {listError && <ErrorBanner message={listError} onDismiss={() => setListError(null)} className="mb-4" />}

        {loadingList ? (
          <LoadingSpinner label="Loading cache status..." />
        ) : cached && cached.length === 0 ? (
          <div className="rounded-lg border border-[hsl(var(--border))] py-10 text-center text-sm text-[hsl(var(--muted-foreground))]">
            <Database className="mx-auto mb-3 h-8 w-8 opacity-40" />
            <p>No datasets cached yet.</p>
            <p className="mt-1">Use the button below to cache core national datasets.</p>
          </div>
        ) : (
          <DataTable
            columns={datasetColumns}
            rows={cached ?? []}
          />
        )}
      </section>

      <section>
        <h2 className="mb-3 text-lg font-semibold">Cache Core Datasets</h2>

        <Alert variant="warning" className="mb-4">
          <AlertDescription>
            Caching downloads full datasets from CMS and may take several minutes per dataset.
            Existing cached datasets will not be overwritten.
          </AlertDescription>
        </Alert>

        <Button onClick={handleCacheCore} disabled={caching}>
          {caching ? (
            <>
              <RefreshCw className="mr-2 h-4 w-4 animate-spin" />
              Caching...
            </>
          ) : (
            <>
              <Database className="mr-2 h-4 w-4" />
              Cache Core National Datasets
            </>
          )}
        </Button>

        {cacheError && <ErrorBanner message={cacheError} onDismiss={() => setCacheError(null)} className="mt-4" />}

        {cacheResults && (
          <div className="mt-6">
            <h3 className="mb-3 text-sm font-medium">Results</h3>
            <DataTable columns={resultColumns} rows={cacheResults} />
          </div>
        )}
      </section>
    </div>
  );
}
