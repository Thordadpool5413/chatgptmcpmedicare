"use client";

import { useEffect, useState } from "react";
import { CheckCircle, XCircle, RefreshCw, Activity } from "lucide-react";
import { Button } from "@/components/ui/button";

interface ApiStatus {
  ok: boolean;
  rows?: number;
  cols?: string[];
  error?: string;
}

export default function StatusPage() {
  const [results, setResults] = useState<Record<string, ApiStatus> | null>(null);
  const [loading, setLoading] = useState(true);
  const [lastChecked, setLastChecked] = useState<Date | null>(null);

  async function check() {
    setLoading(true);
    try {
      const res = await fetch("/api/status");
      const data = await res.json();
      setResults(data);
      setLastChecked(new Date());
    } catch (e) {
      setResults({ "Status Endpoint": { ok: false, error: String(e) } });
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { check(); }, []);

  const ok = results ? Object.values(results).filter((r) => r.ok).length : 0;
  const total = results ? Object.keys(results).length : 0;

  return (
    <div className="mx-auto max-w-4xl px-4 py-8">
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2">
            <Activity className="h-6 w-6" /> API Health Status
          </h1>
          <p className="mt-1 text-sm text-[hsl(var(--muted-foreground))]">
            Tests all CMS data sources used by this application.
            {lastChecked && <> Last checked: {lastChecked.toLocaleTimeString()}</>}
          </p>
        </div>
        <Button onClick={check} disabled={loading} variant="outline" size="sm">
          <RefreshCw className={`mr-2 h-4 w-4 ${loading ? "animate-spin" : ""}`} />
          {loading ? "Checking…" : "Re-check"}
        </Button>
      </div>

      {!loading && results && (
        <div className="mb-6 rounded-lg border border-[hsl(var(--border))] p-4">
          <p className="font-semibold">
            {ok}/{total} APIs operational
          </p>
          <div className="mt-2 h-2 rounded-full bg-[hsl(var(--border))]">
            <div
              className={`h-2 rounded-full ${ok === total ? "bg-green-500" : ok > total / 2 ? "bg-amber-500" : "bg-red-500"}`}
              style={{ width: `${total > 0 ? (ok / total) * 100 : 0}%` }}
            />
          </div>
        </div>
      )}

      {loading && (
        <div className="grid gap-3 sm:grid-cols-2">
          {Array.from({ length: 9 }).map((_, i) => (
            <div key={i} className="h-28 rounded-xl border border-[hsl(var(--border))] animate-pulse bg-[hsl(var(--muted)/0.3)]" />
          ))}
        </div>
      )}

      {!loading && results && (
        <div className="grid gap-3 sm:grid-cols-2">
          {Object.entries(results).map(([label, status]) => (
            <div
              key={label}
              className={`rounded-xl border p-4 ${status.ok
                ? "border-green-200 bg-green-50 dark:border-green-900 dark:bg-green-950/20"
                : "border-red-200 bg-red-50 dark:border-red-900 dark:bg-red-950/20"
              }`}
            >
              <div className="flex items-start justify-between gap-2">
                <div className="flex-1 min-w-0">
                  <p className="font-medium text-sm">{label}</p>
                  {status.ok ? (
                    <>
                      <p className="text-xs text-[hsl(var(--muted-foreground))] mt-0.5">
                        {status.rows} row{status.rows !== 1 ? "s" : ""} returned
                      </p>
                      {status.cols && status.cols.length > 0 && (
                        <p className="mt-1 text-xs text-[hsl(var(--muted-foreground))] truncate" title={status.cols.join(", ")}>
                          Fields: {status.cols.slice(0, 4).join(", ")}{status.cols.length > 4 ? "…" : ""}
                        </p>
                      )}
                    </>
                  ) : (
                    <p className="text-xs text-red-600 dark:text-red-400 mt-0.5 break-all">{status.error}</p>
                  )}
                </div>
                {status.ok
                  ? <CheckCircle className="h-5 w-5 text-green-500 shrink-0" />
                  : <XCircle className="h-5 w-5 text-red-500 shrink-0" />
                }
              </div>
            </div>
          ))}
        </div>
      )}

      <div className="mt-6 rounded-lg border border-[hsl(var(--border))] p-4 text-sm text-[hsl(var(--muted-foreground))]">
        <p className="font-medium text-foreground mb-1">What this checks</p>
        <p>Each test fetches 1 row from the CMS data API or NPPES registry. A green result confirms the dataset is accessible and returning data from the deployed server. Tests run server-side (no CORS issues).</p>
      </div>
    </div>
  );
}
