import Link from "next/link";
import { notFound } from "next/navigation";
import { getHospitalProfile, num, currency } from "@/lib/cms-direct";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

function ScoreBar({ score, max }: { score: number; max: number }) {
  const pct = Math.min((score / Math.max(max, 1)) * 100, 100);
  return (
    <div className="flex items-center gap-2">
      <div className="h-1.5 flex-1 rounded-full bg-[hsl(var(--border))]">
        <div
          className="h-1.5 rounded-full bg-[hsl(var(--primary))]"
          style={{ width: `${pct}%` }}
        />
      </div>
      <span className="text-xs font-medium w-14 text-right">{score.toLocaleString()}</span>
    </div>
  );
}

export default async function HospitalProfilePage({
  params,
}: {
  params: Promise<{ ccn: string }>;
}) {
  const { ccn } = await params;
  const profile = await getHospitalProfile(ccn);

  if (!profile) notFound();

  const topScore = profile.drgs[0]?._opportunity_score ?? 1;
  const hospiceDrgs = profile.drgs.filter((d) => d._matched_hospice_terms.length > 0);
  const nonHospiceDrgs = profile.drgs.filter((d) => d._matched_hospice_terms.length === 0);

  return (
    <div className="mx-auto max-w-6xl px-4 py-8">
      <Link
        href="/hospital-opportunity"
        className="text-sm text-[hsl(var(--muted-foreground))] hover:underline mb-6 inline-block"
      >
        ← Back to Hospital Opportunity
      </Link>

      {/* ── Hero ── */}
      <div className="mb-6 rounded-xl border border-[hsl(var(--border))] bg-[hsl(var(--card))] p-6">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <h1 className="text-2xl font-bold">{profile.name}</h1>
            <p className="mt-1 text-sm text-[hsl(var(--muted-foreground))]">
              {profile.city}, {profile.state} {profile.zip}
              {" · "} CCN: <span className="font-mono">{profile.ccn}</span>
            </p>
            <div className="mt-3 flex flex-wrap gap-2">
              <Badge variant="secondary">Inpatient Hospital</Badge>
              <Badge variant={profile.opportunity_score > 500 ? "success" : profile.opportunity_score > 100 ? "warning" : "secondary"}>
                Opportunity Score: {profile.opportunity_score.toLocaleString()}
              </Badge>
            </div>
          </div>
          <div className="shrink-0 text-right">
            <a
              href={`https://www.medicare.gov/care-compare/details/hospital/${profile.ccn}`}
              target="_blank"
              rel="noopener noreferrer"
              className="text-sm underline text-[hsl(var(--primary))]"
            >
              View on Medicare.gov ↗
            </a>
          </div>
        </div>
      </div>

      {/* ── Summary stats ── */}
      <div className="mb-6 grid grid-cols-2 gap-3 sm:grid-cols-5">
        {[
          { label: "Total Discharges", value: profile.totals.total_discharges.toLocaleString() },
          { label: "DRG Types", value: profile.totals.drg_count.toLocaleString() },
          { label: "Hospice-Relevant DRGs", value: profile.totals.hospice_drg_count.toLocaleString() },
          { label: "Avg Medicare Payment", value: currency(profile.totals.avg_medicare_payment) },
          { label: "Est. Total Medicare", value: currency(profile.totals.est_total_medicare_payments) },
        ].map((s) => (
          <div key={s.label} className="rounded-lg border border-[hsl(var(--border))] p-3">
            <p className="text-xs text-[hsl(var(--muted-foreground))]">{s.label}</p>
            <p className="mt-1 text-lg font-semibold">{s.value}</p>
          </div>
        ))}
      </div>

      {/* ── Hospice-Relevant DRGs ── */}
      {hospiceDrgs.length > 0 && (
        <section className="mb-6">
          <h2 className="mb-3 text-lg font-semibold flex items-center gap-2">
            Hospice-Relevant DRGs
            <Badge variant="success">{hospiceDrgs.length}</Badge>
          </h2>
          <div className="rounded-xl border border-[hsl(var(--border))] overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>DRG Code</TableHead>
                  <TableHead>Description</TableHead>
                  <TableHead>Matched Terms</TableHead>
                  <TableHead className="text-right">Discharges</TableHead>
                  <TableHead className="text-right">Avg Submitted</TableHead>
                  <TableHead className="text-right">Avg Total Pmt</TableHead>
                  <TableHead className="text-right">Avg Medicare Pmt</TableHead>
                  <TableHead className="min-w-[140px]">Opportunity Score</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {hospiceDrgs.map((row, i) => (
                  <TableRow key={i}>
                    <TableCell className="font-mono text-xs">{row.DRG_Cd ?? "—"}</TableCell>
                    <TableCell className="max-w-[200px] truncate text-xs" title={row.DRG_Desc}>{row.DRG_Desc ?? "—"}</TableCell>
                    <TableCell>
                      <div className="flex flex-wrap gap-1">
                        {row._matched_hospice_terms.slice(0, 3).map((t) => (
                          <Badge key={t} variant="success" className="text-xs">{t}</Badge>
                        ))}
                      </div>
                    </TableCell>
                    <TableCell className="text-right">{num(row.Tot_Dschrgs).toLocaleString()}</TableCell>
                    <TableCell className="text-right text-xs">{currency(row.Avg_Submtd_Cvrd_Chrg)}</TableCell>
                    <TableCell className="text-right text-xs">{currency(row.Avg_Tot_Pymt_Amt)}</TableCell>
                    <TableCell className="text-right text-xs">{currency(row.Avg_Mdcr_Pymt_Amt)}</TableCell>
                    <TableCell><ScoreBar score={row._opportunity_score} max={topScore} /></TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </section>
      )}

      {/* ── All Other DRGs ── */}
      <section>
        <h2 className="mb-3 text-lg font-semibold flex items-center gap-2">
          All DRGs by Volume
          <Badge variant="secondary">{profile.drgs.length}</Badge>
        </h2>
        <div className="rounded-xl border border-[hsl(var(--border))] overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>DRG Code</TableHead>
                <TableHead>Description</TableHead>
                <TableHead className="text-right">Discharges</TableHead>
                <TableHead className="text-right">Avg Submitted</TableHead>
                <TableHead className="text-right">Avg Total Pmt</TableHead>
                <TableHead className="text-right">Avg Medicare Pmt</TableHead>
                <TableHead>Hospice Match</TableHead>
                <TableHead className="min-w-[140px]">Score</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {profile.drgs.map((row, i) => (
                <TableRow key={i}>
                  <TableCell className="font-mono text-xs">{row.DRG_Cd ?? "—"}</TableCell>
                  <TableCell className="max-w-[220px] truncate text-xs" title={row.DRG_Desc}>{row.DRG_Desc ?? "—"}</TableCell>
                  <TableCell className="text-right">{num(row.Tot_Dschrgs).toLocaleString()}</TableCell>
                  <TableCell className="text-right text-xs">{currency(row.Avg_Submtd_Cvrd_Chrg)}</TableCell>
                  <TableCell className="text-right text-xs">{currency(row.Avg_Tot_Pymt_Amt)}</TableCell>
                  <TableCell className="text-right text-xs">{currency(row.Avg_Mdcr_Pymt_Amt)}</TableCell>
                  <TableCell>
                    {row._matched_hospice_terms.length > 0 ? (
                      <Badge variant="success" className="text-xs">
                        {row._matched_hospice_terms.slice(0, 2).join(", ")}
                      </Badge>
                    ) : (
                      <span className="text-xs text-[hsl(var(--muted-foreground))]">—</span>
                    )}
                  </TableCell>
                  <TableCell><ScoreBar score={row._opportunity_score} max={topScore} /></TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      </section>
    </div>
  );
}
