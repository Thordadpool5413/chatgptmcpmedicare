import Link from "next/link";
import { notFound } from "next/navigation";
import { getNursingHomeProfile, num } from "@/lib/cms-direct";
import { Badge } from "@/components/ui/badge";

function StarRow({ label, rating, weight }: { label: string; rating: number; weight?: string }) {
  const n = rating || 0;
  return (
    <div className="flex items-center justify-between py-2 text-sm border-b border-[hsl(var(--border)/0.4)]">
      <div>
        <span className="font-medium">{label}</span>
        {weight && <span className="ml-2 text-xs text-[hsl(var(--muted-foreground))]">{weight}</span>}
      </div>
      <div className="flex items-center gap-2">
        <span title={`${n}/5 stars`}>
          {Array.from({ length: 5 }, (_, i) => (
            <span key={i} className={i < n ? "text-amber-400" : "text-[hsl(var(--border))]"}>★</span>
          ))}
        </span>
        <span className="text-xs text-[hsl(var(--muted-foreground))] w-8 text-right">{n || "—"}/5</span>
      </div>
    </div>
  );
}

function MetricRow({ label, value, sub }: { label: string; value: string | number; sub?: string }) {
  return (
    <div className="flex items-start justify-between py-2 text-sm border-b border-[hsl(var(--border)/0.4)]">
      <div>
        <span className="text-[hsl(var(--muted-foreground))]">{label}</span>
        {sub && <p className="text-xs text-[hsl(var(--muted-foreground))]">{sub}</p>}
      </div>
      <span className="font-medium text-right">{value}</span>
    </div>
  );
}

export default async function FacilityProfilePage({
  params,
}: {
  params: Promise<{ ccn: string }>;
}) {
  const { ccn } = await params;
  const facility = await getNursingHomeProfile(ccn);

  if (!facility) notFound();

  const beds = num(facility["Number of Certified Beds"]);
  const residents = num(facility["Number of Residents in Certified Beds"]);
  const occupancy = beds > 0 ? ((residents / beds) * 100).toFixed(1) : "—";

  const overall = num(facility["Overall Rating"]);
  const healthInsp = num(facility["Health Inspection Rating"]);
  const staffing = num(facility["Staffing Rating"]);
  const rnStaffing = num(facility["RN Staffing Rating"]);
  const qm = num(facility["QM Rating"]);
  const longStayQm = num(facility["Long-Stay QM Rating"] ?? 0);
  const shortStayQm = num(facility["Short-Stay QM Rating"] ?? 0);

  const qualityPressure = facility._quality_pressure_component;
  const score = facility._snf_opportunity_score;

  const scoreVariant = score > 500 ? "success" : score > 200 ? "warning" : "secondary";

  return (
    <div className="mx-auto max-w-5xl px-4 py-8">
      <Link
        href="/nursing-home"
        className="text-sm text-[hsl(var(--muted-foreground))] hover:underline mb-6 inline-block"
      >
        ← Back to Nursing Home Opportunity
      </Link>

      {/* ── Hero ── */}
      <div className="mb-6 rounded-xl border border-[hsl(var(--border))] bg-[hsl(var(--card))] p-6">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <h1 className="text-2xl font-bold">{facility["Provider Name"] ?? "Facility"}</h1>
            <p className="mt-1 text-sm text-[hsl(var(--muted-foreground))]">
              {facility["Provider Address"]}
              {" · "}{facility["City/Town"]}, {facility.State} {String(facility["ZIP Code"] ?? "").slice(0, 5)}
            </p>
            <p className="text-sm text-[hsl(var(--muted-foreground))]">
              CCN: <span className="font-mono">{ccn}</span>
              {facility["Phone Number"] && <> · Phone: {facility["Phone Number"]}</>}
            </p>
            <div className="mt-3 flex flex-wrap gap-2">
              <Badge variant={scoreVariant}>
                Opportunity Score: {score.toLocaleString()}
              </Badge>
              <Badge variant="secondary">{facility["Ownership Type"] ?? "Unknown Ownership"}</Badge>
              {facility["Abuse Icon"] === "Yes" && (
                <Badge variant="destructive">Abuse Icon</Badge>
              )}
            </div>
          </div>
          <div className="shrink-0 text-right">
            <a
              href={`https://www.medicare.gov/care-compare/details/nursing-home/${ccn}`}
              target="_blank"
              rel="noopener noreferrer"
              className="text-sm underline text-[hsl(var(--primary))]"
            >
              View on Medicare.gov ↗
            </a>
          </div>
        </div>
      </div>

      {/* ── Key Metrics ── */}
      <div className="mb-6 grid grid-cols-2 gap-3 sm:grid-cols-4">
        {[
          { label: "Certified Beds", value: beds.toLocaleString() },
          { label: "Current Residents", value: residents.toLocaleString() },
          { label: "Occupancy Rate", value: `${occupancy}%` },
          { label: "Quality Pressure", value: qualityPressure.toFixed(2) },
        ].map((s) => (
          <div key={s.label} className="rounded-lg border border-[hsl(var(--border))] p-3">
            <p className="text-xs text-[hsl(var(--muted-foreground))]">{s.label}</p>
            <p className="mt-1 text-xl font-semibold">{s.value}</p>
          </div>
        ))}
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        {/* ── Star Ratings ── */}
        <section className="rounded-xl border border-[hsl(var(--border))] p-5">
          <h2 className="mb-4 font-semibold">CMS 5-Star Quality Ratings</h2>
          <StarRow label="Overall Rating" rating={overall} />
          <StarRow label="Health Inspections" rating={healthInsp} weight="(surveys, complaints, incidents)" />
          <StarRow label="Staffing" rating={staffing} />
          <StarRow label="RN Staffing" rating={rnStaffing} weight="(registered nurses only)" />
          <StarRow label="Quality Measures (QM)" rating={qm} />
          {longStayQm > 0 && <StarRow label="Long-Stay QM" rating={longStayQm} />}
          {shortStayQm > 0 && <StarRow label="Short-Stay QM" rating={shortStayQm} />}
          <div className="mt-3 text-xs text-[hsl(var(--muted-foreground))]">
            Source: CMS Nursing Home Compare. 1★ = Much Below Average · 5★ = Much Above Average
          </div>
        </section>

        {/* ── Facility Details ── */}
        <section className="rounded-xl border border-[hsl(var(--border))] p-5">
          <h2 className="mb-4 font-semibold">Facility Details</h2>
          <MetricRow label="Ownership Type" value={facility["Ownership Type"] ?? "—"} />
          <MetricRow label="County/Parish" value={String(facility["County/Parish"] ?? "—")} />
          <MetricRow label="Certified Beds" value={beds.toLocaleString()} />
          <MetricRow label="Residents in Certified Beds" value={residents.toLocaleString()} />
          <MetricRow
            label="Occupancy Rate"
            value={`${occupancy}%`}
            sub="Residents ÷ Certified Beds"
          />
          <MetricRow label="State" value={facility.State ?? "—"} />
          <MetricRow
            label="Hospice Opportunity Score"
            value={score.toLocaleString()}
            sub={`Beds (${beds}) + Quality Pressure (${qualityPressure.toFixed(2)}) × 18`}
          />
          <MetricRow
            label="Quality Pressure Component"
            value={qualityPressure.toFixed(2)}
            sub="Lower ratings = higher pressure = higher opportunity"
          />
        </section>

        {/* ── Score Explanation ── */}
        <section className="rounded-xl border border-[hsl(var(--border))] p-5 lg:col-span-2">
          <h2 className="mb-3 font-semibold">Hospice Opportunity Analysis</h2>
          <div className="grid gap-4 sm:grid-cols-3 text-sm">
            <div className="rounded-lg bg-[hsl(var(--muted)/0.3)] p-4">
              <p className="font-medium mb-1">Bed Capacity</p>
              <p className="text-2xl font-bold">{beds}</p>
              <p className="text-xs text-[hsl(var(--muted-foreground))] mt-1">
                More beds = more potential hospice patients. Base score component.
              </p>
            </div>
            <div className="rounded-lg bg-[hsl(var(--muted)/0.3)] p-4">
              <p className="font-medium mb-1">Quality Pressure</p>
              <p className="text-2xl font-bold">{qualityPressure.toFixed(2)}</p>
              <p className="text-xs text-[hsl(var(--muted-foreground))] mt-1">
                Calculated from star ratings — lower ratings signal less internal end-of-life care capacity.
              </p>
            </div>
            <div className="rounded-lg bg-[hsl(var(--muted)/0.3)] p-4">
              <p className="font-medium mb-1">Opportunity Score</p>
              <p className="text-2xl font-bold">{score.toLocaleString()}</p>
              <p className="text-xs text-[hsl(var(--muted-foreground))] mt-1">
                = {beds} + {qualityPressure.toFixed(2)} × 18. Higher = more referral opportunity.
              </p>
            </div>
          </div>
          <div className="mt-4 grid gap-2 sm:grid-cols-3 text-xs">
            <div>
              <p className="text-[hsl(var(--muted-foreground))]">Overall Rating factor</p>
              <p>max(0, 5−{overall}) = <strong>{Math.max(0, 5 - overall)}</strong></p>
            </div>
            <div>
              <p className="text-[hsl(var(--muted-foreground))]">Staffing factor (×0.5)</p>
              <p>max(0, 5−{staffing}) × 0.5 = <strong>{(Math.max(0, 5 - staffing) * 0.5).toFixed(2)}</strong></p>
            </div>
            <div>
              <p className="text-[hsl(var(--muted-foreground))]">QM factor (×0.35)</p>
              <p>max(0, 5−{qm}) × 0.35 = <strong>{(Math.max(0, 5 - qm) * 0.35).toFixed(2)}</strong></p>
            </div>
          </div>
        </section>
      </div>
    </div>
  );
}
