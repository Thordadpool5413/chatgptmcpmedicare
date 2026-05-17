"use client";

import { useState } from "react";
import { Search } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { StateSelect } from "@/components/shared/state-select";
import { DataTable, type Column } from "@/components/shared/data-table";
import { LoadingSpinner } from "@/components/shared/loading-spinner";
import { ErrorBanner } from "@/components/shared/error-banner";
import { mcp } from "@/lib/api";

interface NpiProvider {
  number?: string;
  basic?: {
    first_name?: string;
    last_name?: string;
    organization_name?: string;
    credential?: string;
  };
  addresses?: Array<{
    address_1?: string;
    city?: string;
    state?: string;
    postal_code?: string;
    address_purpose?: string;
  }>;
  taxonomies?: Array<{ desc?: string; primary?: boolean }>;
}

interface NpiResult {
  rows?: NpiProvider[];
  result_count?: number;
}

interface FlatNpi {
  number: string;
  name: string;
  credential: string;
  specialty: string;
  city: string;
  state: string;
  postal: string;
  [key: string]: unknown;
}

function flattenNpi(p: NpiProvider): FlatNpi {
  const primary = p.addresses?.find((a) => a.address_purpose === "LOCATION") ?? p.addresses?.[0];
  const taxonomy = p.taxonomies?.find((t) => t.primary) ?? p.taxonomies?.[0];
  const name = p.basic?.organization_name
    ? p.basic.organization_name
    : [p.basic?.first_name, p.basic?.last_name].filter(Boolean).join(" ");
  return {
    number: p.number ?? "—",
    name: name || "—",
    credential: p.basic?.credential ?? "—",
    specialty: taxonomy?.desc ?? "—",
    city: primary?.city ?? "—",
    state: primary?.state ?? "—",
    postal: primary?.postal_code?.slice(0, 5) ?? "—",
  };
}

const columns: Column<FlatNpi>[] = [
  { key: "number", label: "NPI" },
  { key: "name", label: "Name / Organization" },
  { key: "credential", label: "Credential" },
  { key: "specialty", label: "Specialty" },
  { key: "city", label: "City" },
  { key: "state", label: "State" },
  { key: "postal", label: "ZIP" },
];

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
  const [rows, setRows] = useState<FlatNpi[] | null>(null);
  const [total, setTotal] = useState<number | null>(null);

  async function handleSearch(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    try {
      const args: Record<string, unknown> = { limit: Number(limit) };
      if (firstName) args.first_name = firstName;
      if (lastName) args.last_name = lastName;
      if (orgName) args.organization_name = orgName;
      if (state) args.state = state;
      if (city) args.city = city;
      if (taxonomy) args.taxonomy_description = taxonomy;

      const data = (await mcp("lookup_npi", args)) as NpiResult;
      setRows((data.rows ?? []).map(flattenNpi));
      setTotal(data.result_count ?? null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Request failed");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="mx-auto max-w-7xl px-4 py-8">
      <div className="mb-6">
        <h1 className="text-2xl font-bold tracking-tight">NPI Provider Lookup</h1>
        <p className="mt-1 text-sm text-[hsl(var(--muted-foreground))]">
          Search the NPPES NPI Registry — fill in at least one field
        </p>
      </div>

      <form onSubmit={handleSearch} className="mb-6 space-y-3">
        <div className="flex flex-wrap gap-3">
          <Input
            placeholder="First name"
            value={firstName}
            onChange={(e) => setFirstName(e.target.value)}
            className="w-40"
          />
          <Input
            placeholder="Last name"
            value={lastName}
            onChange={(e) => setLastName(e.target.value)}
            className="w-40"
          />
          <Input
            placeholder="Organization name"
            value={orgName}
            onChange={(e) => setOrgName(e.target.value)}
            className="w-56"
          />
        </div>
        <div className="flex flex-wrap gap-3">
          <StateSelect value={state} onChange={setState} />
          <Input
            placeholder="City"
            value={city}
            onChange={(e) => setCity(e.target.value)}
            className="w-40"
          />
          <Input
            placeholder="Specialty (e.g. Hospice)"
            value={taxonomy}
            onChange={(e) => setTaxonomy(e.target.value)}
            className="w-56"
          />
          <select
            value={limit}
            onChange={(e) => setLimit(e.target.value)}
            className="h-10 rounded-md border border-[hsl(var(--input))] bg-transparent px-3 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[hsl(var(--ring))]"
          >
            <option value="10">10 results</option>
            <option value="20">20 results</option>
            <option value="50">50 results</option>
          </select>
          <Button type="submit" disabled={loading}>
            <Search className="mr-2 h-4 w-4" />
            Search
          </Button>
        </div>
      </form>

      {error && <ErrorBanner message={error} onDismiss={() => setError(null)} className="mb-4" />}

      {loading && <LoadingSpinner label="Searching NPI registry..." />}

      {!loading && rows && (
        <>
          {total != null && (
            <p className="mb-3 text-sm text-[hsl(var(--muted-foreground))]">
              {total.toLocaleString()} total results — showing {rows.length}
            </p>
          )}
          <DataTable columns={columns} rows={rows} />
        </>
      )}
    </div>
  );
}
