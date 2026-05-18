import Link from "next/link";
import { BarChart3, Building2, BedDouble, Search, Database, MessageSquare } from "lucide-react";
import { Card, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";

const sections = [
  {
    href: "/hospice-market",
    title: "Hospice Market Share",
    description: "Ranked hospice providers by market share in any state, using Medicare PAC utilization data.",
    icon: BarChart3,
  },
  {
    href: "/hospital-opportunity",
    title: "Hospital Opportunity",
    description: "Score hospitals by hospice referral opportunity based on inpatient discharge volume.",
    icon: Building2,
  },
  {
    href: "/nursing-home",
    title: "Nursing Home Opportunity",
    description: "Identify SNF opportunities by state and city with scored provider rankings.",
    icon: BedDouble,
  },
  {
    href: "/npi-lookup",
    title: "NPI Provider Lookup",
    description: "Search the NPPES NPI registry by name, organization, specialty, state, or city.",
    icon: Search,
  },
];

export default function DashboardPage() {
  return (
    <div className="mx-auto max-w-7xl px-4 py-10">
      <div className="mb-8">
        <h1 className="text-3xl font-bold tracking-tight">CMS Public Market Intelligence</h1>
        <p className="mt-2 text-[hsl(var(--muted-foreground))]">
          Hospice market analysis powered by free CMS public data — no subscriptions, no vendor lock-in.
        </p>
      </div>

      <div className="mb-6">
        <Card className="border-[hsl(var(--primary)/0.3)] bg-[hsl(var(--primary)/0.05)]">
          <CardHeader>
            <div className="flex items-center gap-3">
              <div className="rounded-lg bg-[hsl(var(--primary)/0.15)] p-2">
                <MessageSquare className="h-5 w-5 text-[hsl(var(--primary))]" />
              </div>
              <CardTitle>AI Chat — Ask Anything</CardTitle>
            </div>
            <CardDescription>
              Ask Claude about hospice markets, hospital opportunities, nursing homes, or any provider — it pulls live CMS data to answer.
            </CardDescription>
          </CardHeader>
          <CardFooter>
            <Link
              href="/chat"
              className="inline-flex h-9 items-center rounded-md bg-[hsl(var(--primary))] px-4 text-sm font-medium text-[hsl(var(--primary-foreground))] hover:opacity-90 transition-opacity"
            >
              Open Chat
            </Link>
          </CardFooter>
        </Card>
      </div>

      <div className="grid gap-6 sm:grid-cols-2">
        {sections.map((section) => {
          const Icon = section.icon;
          return (
            <Card key={section.href} className="flex flex-col">
              <CardHeader>
                <div className="flex items-center gap-3">
                  <div className="rounded-lg bg-blue-50 p-2">
                    <Icon className="h-5 w-5 text-blue-600" />
                  </div>
                  <CardTitle>{section.title}</CardTitle>
                </div>
                <CardDescription className="mt-1">{section.description}</CardDescription>
              </CardHeader>
              <CardFooter className="mt-auto">
                <Link
                  href={section.href}
                  className="inline-flex h-9 items-center rounded-md bg-[hsl(var(--primary))] px-4 text-sm font-medium text-[hsl(var(--primary-foreground))] hover:opacity-90 transition-opacity"
                >
                  Open
                </Link>
              </CardFooter>
            </Card>
          );
        })}
      </div>

      <div className="mt-6">
        <Card>
          <CardHeader>
            <div className="flex items-center gap-3">
              <div className="rounded-lg bg-[hsl(var(--muted))] p-2">
                <Database className="h-5 w-5 text-[hsl(var(--muted-foreground))]" />
              </div>
              <CardTitle>Cache Management</CardTitle>
            </div>
            <CardDescription>
              Pre-cache national CMS datasets locally for faster queries. Caching is optional — live API calls work without it.
            </CardDescription>
          </CardHeader>
          <CardFooter>
            <Link
              href="/cache-management"
              className="inline-flex h-9 items-center rounded-md border border-[hsl(var(--border))] px-4 text-sm font-medium hover:bg-[hsl(var(--accent))] transition-colors"
            >
              Manage Cache
            </Link>
          </CardFooter>
        </Card>
      </div>

      <div className="mt-6 rounded-lg bg-[hsl(var(--muted))] p-4 text-sm text-[hsl(var(--muted-foreground))]">
        <p className="font-medium text-[hsl(var(--foreground))]">Data Sources</p>
        <p className="mt-1">
          All data is sourced from free CMS public APIs: data.cms.gov, Provider Data Catalog, and the NPPES NPI Registry.
          No PHI, no subscriptions required.
        </p>
      </div>
    </div>
  );
}
