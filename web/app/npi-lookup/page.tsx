"use client";

import React, { useState } from "react";
import { Search } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { StateSelect } from "@/components/shared/state-select";
import { LoadingSpinner } from "@/components/shared/loading-spinner";
import { ErrorBanner } from "@/components/shared/error-banner";
import { Badge } from "@/components/ui/badge";
import { mcp } from "@/lib/api";
import type { NpiResult } from "@/lib/cms-direct";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

interface NpiProvider {
  number?: string;
  basic?: {
    first_name?: string; last_name?: string; middle_name?: string;
    organization_name?: string; credential?: string; sole_proprietor?: string;
    gender?: string; enumeration_date?: string; last_updated?: string;
    status?: string;
  };
  addresses?: Array<{
    address_purpose?: string; address_1?: string; address_2?: string;
    city?: string; state?: string; postal_code?: string;
    telephone_number?: string; fax_number?: string;
  }>;
  taxonomies?: Array<{ code?: string; desc?: string; primary?: boolean; state?: string; license?: string }>;
  identifiers?: Array<{ code?: string; desc?: string; identifier?: string; state?: string }>;
}

function getName(p: NpiProvider) {
  if (p.basic?.organization_name) return p.basic.organization_name;
  return [p.basic?.first_name, p.basic?.middle_name, p.basic?.last_name].filter(Boolean).join(" ");
}

function getPrimaryAddr(p: NpiProvider) {
  return p.addresses?.find((a) => a.address_purpose === "LOCATION") ?? p.addresses?.[0];
}

function getPrimaryTax(p: NpiProvider) {
  return p.taxonomies?.find((t) => t.primary) ?? p.taxonomies?.[0];
}

export default function NpiLookupPage() {
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [orgName, setOrgName] = useState("");
  const [state, setState] = useState("");
  const [city, setCity] = useState("");
  const [taxonomy, setTaxonomy] = useState("");
  const [limit, setLimit] = useState("20");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<NpiResult | null>(null);
  const [expanded, setExpanded] = useState<string | null>(null);

  async function handleSearch(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true); setError(null); setExpanded(null);
    try {
      const args: Record<string, unknown> = { limit: Number(limit) };
      if (firstName) args.first_name = firstName;
      if (lastName) args.last_name = lastName;
      if (orgName) args.organization_name = orgName;
      if (state) args.state = state;
      if (city) args.city = city;
      if (taxonomy) args.taxonomy_description = taxonomy;
      const data = (await mcp("lookup_npi", args)) as NpiResult;
      setResult(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Request failed");
    } finally {
      setLoading(false);
    }
  }

  const providers = (result?.rows ?? []) as NpiProvider[];

  return (
    <div className="mx-auto max-w-7xl px-4 py-8">
      <div className="mb-6">
        <h1 className="text-2xl font-bold tracking-tight">NPI Provider Lookup</h1>
        <p className="mt-1 text-sm text-[hsl(var(--muted-foreground))]">
          NPPES National Plan & Provider Enumeration System registry
        </p>
      </div>

      <form onSubmit={handleSearch} className="mb-6 space-y-3">
        <div className="flex flex-wrap gap-3">
          <Input placeholder="First name" value={firstName} onChange={(e) => setFirstName(e.target.value)} className="w-36" />
          <Input placeholder="Last name" value={lastName} onChange={(e) => setLastName(e.target.value)} className="w-36" />
          <Input placeholder="Organization name" value={orgName} onChange={(e) => setOrgName(e.target.value)} className="w-56" />
        </div>
        <div className="flex flex-wrap gap-3">
          <StateSelect value={state} onChange={setState} />
          <Input placeholder="City" value={city} onChange={(e) => setCity(e.target.value)} className="w-40" />
          <Input placeholder="Specialty (e.g. Hospice)" value={taxonomy} onChange={(e) => setTaxonomy(e.target.value)} className="w-52" />
          <select
            value={limit} onChange={(e) => setLimit(e.target.value)}
            className="h-10 rounded-md border border-[hsl(var(--input))] bg-transparent px-3 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[hsl(var(--ring))]"
          >
            {["10","20","50"].map((v) => <option key={v} value={v}>{v} results</option>)}
          </select>
          <Button type="submit" disabled={loading}>
            <Search className="mr-2 h-4 w-4" />
            Search
          </Button>
        </div>
      </form>

      {error && <ErrorBanner message={error} onDismiss={() => setError(null)} className="mb-4" />}
      {loading && <LoadingSpinner label="Searching NPI registry…" />}

      {!loading && result && (
        <>
          <p className="mb-3 text-sm text-[hsl(var(--muted-foreground))]">
            {(result.result_count ?? 0).toLocaleString()} total results — showing {providers.length}. Click a row for details.
          </p>
          <div className="rounded-lg border border-[hsl(var(--border))] overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>NPI</TableHead>
                  <TableHead>Name / Organization</TableHead>
                  <TableHead>Credential</TableHead>
                  <TableHead>Gender</TableHead>
                  <TableHead>Primary Specialty</TableHead>
                  <TableHead>License</TableHead>
                  <TableHead>Address</TableHead>
                  <TableHead>City</TableHead>
                  <TableHead>State</TableHead>
                  <TableHead>ZIP</TableHead>
                  <TableHead>Phone</TableHead>
                  <TableHead>Fax</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Enumerated</TableHead>
                  <TableHead>Updated</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {providers.map((p, i) => {
                  const addr = getPrimaryAddr(p);
                  const tax = getPrimaryTax(p);
                  const isExpanded = expanded === p.number;
                  return (
                    <React.Fragment key={p.number ?? i}>
                      <TableRow
                        className="cursor-pointer"
                        onClick={() => setExpanded(isExpanded ? null : (p.number ?? null))}
                      >
                        <TableCell className="font-mono text-xs">{p.number ?? "—"}</TableCell>
                        <TableCell className="font-medium max-w-[180px] truncate">{getName(p)}</TableCell>
                        <TableCell className="text-xs">{p.basic?.credential ?? "—"}</TableCell>
                        <TableCell className="text-xs">{p.basic?.gender ?? "—"}</TableCell>
                        <TableCell className="max-w-[160px] truncate text-xs" title={tax?.desc}>{tax?.desc ?? "—"}</TableCell>
                        <TableCell className="text-xs">{tax?.license ?? "—"}</TableCell>
                        <TableCell className="text-xs max-w-[140px] truncate">{[addr?.address_1, addr?.address_2].filter(Boolean).join(" ") || "—"}</TableCell>
                        <TableCell>{addr?.city ?? "—"}</TableCell>
                        <TableCell>{addr?.state ?? "—"}</TableCell>
                        <TableCell className="text-xs">{addr?.postal_code?.slice(0, 5) ?? "—"}</TableCell>
                        <TableCell className="text-xs">{addr?.telephone_number ?? "—"}</TableCell>
                        <TableCell className="text-xs">{addr?.fax_number ?? "—"}</TableCell>
                        <TableCell>
                          <Badge variant={p.basic?.status === "A" ? "success" : "secondary"}>
                            {p.basic?.status === "A" ? "Active" : (p.basic?.status ?? "—")}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-xs">{p.basic?.enumeration_date ?? "—"}</TableCell>
                        <TableCell className="text-xs">{p.basic?.last_updated ?? "—"}</TableCell>
                      </TableRow>
                      {isExpanded && (
                        <TableRow>
                          <TableCell colSpan={15} className="bg-[hsl(var(--muted)/0.3)] p-4">
                            <div className="grid gap-4 sm:grid-cols-2">
                              <div>
                                <p className="text-xs font-semibold mb-2 text-[hsl(var(--muted-foreground))]">ALL TAXONOMIES</p>
                                {p.taxonomies?.map((t, ti) => (
                                  <div key={ti} className="text-xs mb-1">
                                    {t.primary && <Badge variant="success" className="mr-1">Primary</Badge>}
                                    <span className="font-medium">{t.code}</span> — {t.desc}
                                    {t.state && ` (${t.state})`}
                                    {t.license && ` Lic: ${t.license}`}
                                  </div>
                                ))}
                              </div>
                              <div>
                                <p className="text-xs font-semibold mb-2 text-[hsl(var(--muted-foreground))]">ALL ADDRESSES</p>
                                {p.addresses?.map((a, ai) => (
                                  <div key={ai} className="text-xs mb-1">
                                    <Badge variant="secondary" className="mr-1">{a.address_purpose}</Badge>
                                    {[a.address_1, a.address_2, a.city, a.state, a.postal_code].filter(Boolean).join(", ")}
                                    {a.telephone_number && ` · ${a.telephone_number}`}
                                  </div>
                                ))}
                              </div>
                              {p.identifiers && p.identifiers.length > 0 && (
                                <div>
                                  <p className="text-xs font-semibold mb-2 text-[hsl(var(--muted-foreground))]">OTHER IDENTIFIERS</p>
                                  {p.identifiers.map((id, ii) => (
                                    <div key={ii} className="text-xs mb-1">
                                      <span className="font-medium">{id.desc ?? id.code}</span>: {id.identifier} {id.state && `(${id.state})`}
                                    </div>
                                  ))}
                                </div>
                              )}
                            </div>
                          </TableCell>
                        </TableRow>
                      )}
                    </React.Fragment>
                  );
                })}
              </TableBody>
            </Table>
          </div>
        </>
      )}
    </div>
  );
}
