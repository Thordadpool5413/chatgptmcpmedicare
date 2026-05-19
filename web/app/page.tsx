import Link from "next/link";
import {
  BarChart3, Building2, BedDouble, Search, Database, MessageSquare,
  User, Hospital, Home, ArrowRight, Heart,
} from "lucide-react";
import { Card, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";

const TOOLS = [
  {
    href: "/hospice-market",
    title: "Hospice Market Share",
    description:
      "Ranked hospice providers by beneficiary volume, market share %, Medicare payments, avg patient age, risk scores, dual-eligible %, and patient condition mix. Filter by state and city. Click any provider for full profile.",
    icon: BarChart3,
    features: ["Market share %", "Patient conditions", "Dual eligible %", "Risk scores"],
    profilePath: "/hospice/[npi]",
  },
  {
    href: "/hospital-opportunity",
    title: "Hospital Opportunity",
    description:
      "Score every hospital in a state by hospice referral opportunity. Full DRG breakdown with discharge volumes, average payments, and hospice-relevant clinical matches.",
    icon: Building2,
    features: ["DRG analysis", "Discharge volume", "Payment data", "Hospice match score"],
    profilePath: "/hospital/[ccn]",
  },
  {
    href: "/nursing-home",
    title: "Nursing Home Opportunity",
    description:
      "Identify SNF referral targets with CMS 5-star quality ratings, bed counts, occupancy, and opportunity scoring. Click any facility for its full profile.",
    icon: BedDouble,
    features: ["5-star ratings", "Bed capacity", "Quality pressure", "Opportunity score"],
    profilePath: "/facility/[ccn]",
  },
  {
    href: "/npi-lookup",
    title: "NPI Provider Lookup",
    description:
      "Search the NPPES NPI registry. Click any NPI to view full profile: all specialties, all addresses, all identifiers, and Medicare Part B billing history.",
    icon: Search,
    features: ["All specialties", "All addresses", "All identifiers", "Medicare billing"],
    profilePath: "/provider/[npi]",
  },
];

const PROFILE_CARDS = [
  {
    href: "/hospice/",
    label: "Hospice Provider Profile",
    sub: "Full Medicare PAC data, patient conditions, demographics & market competitors",
    icon: Heart,
    hint: "Navigate from Hospice Market results",
  },
  {
    href: "/provider/",
    label: "NPI Provider Profile",
    sub: "Full NPI + Medicare Part B billing history",
    icon: User,
    hint: "Navigate from NPI Lookup results",
  },
  {
    href: "/hospital/",
    label: "Hospital Profile",
    sub: "All DRGs, payments & hospice analysis",
    icon: Hospital,
    hint: "Navigate from Hospital Opportunity results",
  },
  {
    href: "/facility/",
    label: "Facility Profile",
    sub: "Complete SNF quality & opportunity breakdown",
    icon: Home,
    hint: "Navigate from Nursing Home results",
  },
];

export default function DashboardPage() {
  return (
    <div className="mx-auto max-w-7xl px-4 py-10">
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-3xl font-bold tracking-tight">CMS Medicare Market Intelligence</h1>
        <p className="mt-2 text-[hsl(var(--muted-foreground))]">
          Complete hospice market analysis powered by live CMS public data. Search, score, and deep-dive
          into any provider, hospital, or nursing home.
        </p>
      </div>

      {/* AI Chat — featured */}
      <div className="mb-8">
        <Card className="border-[hsl(var(--primary)/0.3)] bg-[hsl(var(--primary)/0.05)]">
          <CardHeader>
            <div className="flex items-center gap-3">
              <div className="rounded-lg bg-[hsl(var(--primary)/0.15)] p-2">
                <MessageSquare className="h-5 w-5 text-[hsl(var(--primary))]" />
              </div>
              <CardTitle>AI Chat — Ask Anything</CardTitle>
            </div>
            <CardDescription>
              Ask Claude about hospice markets, hospital and nursing home opportunities, or any specific
              provider. It fetches live CMS data and gives detailed, actionable answers — including full
              provider profiles, DRG breakdowns, and quality ratings.
            </CardDescription>
          </CardHeader>
          <CardFooter>
            <Link
              href="/chat"
              className="inline-flex h-9 items-center gap-2 rounded-md bg-[hsl(var(--primary))] px-4 text-sm font-medium text-[hsl(var(--primary-foreground))] hover:opacity-90 transition-opacity"
            >
              Open Chat <ArrowRight className="h-4 w-4" />
            </Link>
          </CardFooter>
        </Card>
      </div>

      {/* Main tools */}
      <h2 className="mb-4 text-lg font-semibold">Search &amp; Analysis Tools</h2>
      <div className="mb-8 grid gap-5 sm:grid-cols-2">
        {TOOLS.map((tool) => {
          const Icon = tool.icon;
          return (
            <Card key={tool.href} className="flex flex-col">
              <CardHeader>
                <div className="flex items-center gap-3">
                  <div className="rounded-lg bg-[hsl(var(--muted))] p-2">
                    <Icon className="h-5 w-5 text-[hsl(var(--foreground))]" />
                  </div>
                  <CardTitle>{tool.title}</CardTitle>
                </div>
                <CardDescription className="mt-2">{tool.description}</CardDescription>
                <ul className="mt-3 grid grid-cols-2 gap-x-4 gap-y-1">
                  {tool.features.map((f) => (
                    <li key={f} className="flex items-center gap-1.5 text-xs text-[hsl(var(--muted-foreground))]">
                      <span className="h-1.5 w-1.5 rounded-full bg-[hsl(var(--primary))] shrink-0" />
                      {f}
                    </li>
                  ))}
                </ul>
              </CardHeader>
              <CardFooter className="mt-auto">
                <Link
                  href={tool.href}
                  className="inline-flex h-9 items-center gap-2 rounded-md bg-[hsl(var(--primary))] px-4 text-sm font-medium text-[hsl(var(--primary-foreground))] hover:opacity-90 transition-opacity"
                >
                  Open <ArrowRight className="h-4 w-4" />
                </Link>
              </CardFooter>
            </Card>
          );
        })}
      </div>

      {/* Profile pages */}
      <h2 className="mb-4 text-lg font-semibold">Detailed Profile Pages</h2>
      <p className="mb-4 text-sm text-[hsl(var(--muted-foreground))]">
        Click any NPI, CCN, or facility name in the search results to open its full profile.
      </p>
      <div className="mb-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {PROFILE_CARDS.map((p) => {
          const Icon = p.icon;
          return (
            <div key={p.label} className="rounded-xl border border-[hsl(var(--border))] p-4">
              <div className="flex items-center gap-3 mb-2">
                <div className="rounded-lg bg-[hsl(var(--muted))] p-2">
                  <Icon className="h-4 w-4 text-[hsl(var(--foreground))]" />
                </div>
                <span className="font-medium">{p.label}</span>
              </div>
              <p className="text-sm text-[hsl(var(--muted-foreground))]">{p.sub}</p>
              <p className="mt-2 text-xs text-[hsl(var(--muted-foreground)/0.7)] italic">{p.hint}</p>
            </div>
          );
        })}
      </div>

      {/* Data sources + cache */}
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="rounded-lg border border-[hsl(var(--border))] p-4 text-sm">
          <p className="font-medium mb-2">Data Sources</p>
          <ul className="space-y-1 text-[hsl(var(--muted-foreground))]">
            <li>· Medicare PAC Utilization — Hospice (CMS)</li>
            <li>· Medicare Inpatient Hospitals by Provider &amp; Service (CMS)</li>
            <li>· Nursing Home Compare / Provider Data Catalog (CMS)</li>
            <li>· NPPES NPI Registry (CMS)</li>
            <li>· Medicare Part B Physician &amp; Other Practitioners (CMS)</li>
          </ul>
        </div>
        <Card>
          <CardHeader>
            <div className="flex items-center gap-3">
              <div className="rounded-lg bg-[hsl(var(--muted))] p-2">
                <Database className="h-5 w-5 text-[hsl(var(--muted-foreground))]" />
              </div>
              <CardTitle>Cache Management</CardTitle>
            </div>
            <CardDescription>
              All data is fetched live. Cache management is available for pre-loading datasets.
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
    </div>
  );
}
