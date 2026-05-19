import Link from "next/link";
import { notFound } from "next/navigation";
import { getHospiceProviderProfile, num, currency } from "@/lib/cms-direct";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

function PctBar({ pct, color = "bg-[hsl(var(--primary))]" }: { pct: number; color?: string }) {
  return (
    <div className="flex items-center gap-2">
      <div className="h-2 w-32 rounded-full bg-[hsl(var(--border))]">
        <div className={`h-2 rounded-full ${color}`} style={{ width: `${Math.min(pct, 100)}%` }} />
      </div>
      <span className="text-sm font-medium tabular-nums">{pct.toFixed(1)}%</span>
    </div>
  );
}

function StatBox({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <div className="rounded-lg border border-[hsl(var(--border))] p-3">
      <p className="text-xs text-[hsl(var(--muted-foreground))]">{label}</p>
      <p className="mt-1 text-lg font-semibold">{value}</p>
      {sub && <p className="text-xs text-[hsl(var(--muted-foreground))]">{sub}</p>}
    </div>
  );
}

export default async function HospiceProfilePage({
  params,
}: {
  params: Promise<{ npi: string }>;
}) {
  const { npi } = await params;
  const profile = await getHospiceProviderProfile(npi);

  if (!profile.row && !profile.provider) notFound();

  const row = profile.row;
  const provider = profile.provider;

  const name = String(
    row?.Rndrng_Prvdr_Org_Name ??
    provider?.basic?.organization_name ??
    [provider?.basic?.first_name, provider?.basic?.last_name].filter(Boolean).join(" ") ??
    npi
  );

  const totalBenes = num(row?.Tot_Benes);
  const totalPayments = num(row?.Tot_Mdcr_Pymt_Amt);
  const perBenePayment = totalBenes > 0 ? totalPayments / totalBenes : 0;
  const femaleCnt = num(row?.Bene_Feml_Cnt);
  const maleCnt = num(row?.Bene_Male_Cnt);
  const dualCnt = num(row?.Bene_Dual_Cnt);
  const femalePct = totalBenes > 0 ? (femaleCnt / totalBenes) * 100 : 0;
  const dualPct = totalBenes > 0 ? (dualCnt / totalBenes) * 100 : 0;

  const CONDITIONS = [
    { label: "Cancer", pct: num(row?.Bene_CC_CancerX_Pct) * 100 },
    { label: "Heart Failure (CHF)", pct: num(row?.Bene_CC_CHF_Pct) * 100 },
    { label: "COPD", pct: num(row?.Bene_CC_COPD_Pct) * 100 },
    { label: "Alzheimer's / Dementia", pct: num(row?.Bene_CC_Alzhmr_Pct) * 100 },
    { label: "Diabetes", pct: num(row?.Bene_CC_Diab_Pct) * 100 },
    { label: "Stroke / TIA", pct: num(row?.Bene_CC_Strok_TIA_Pct) * 100 },
    { label: "Hypertension", pct: num(row?.Bene_CC_Hypert_Pct) * 100 },
    { label: "Ischemic Heart Disease", pct: num(row?.Bene_CC_Isch_Heart_Pct) * 100 },
    { label: "Chronic Kidney Disease", pct: num(row?.Bene_CC_CKD_Pct) * 100 },
    { label: "Depression", pct: num(row?.Bene_CC_Deprssn_Pct) * 100 },
    { label: "Osteoporosis", pct: num(row?.Bene_CC_Osteoprs_Pct) * 100 },
    { label: "RA / OA", pct: num(row?.Bene_CC_RA_OA_Pct) * 100 },
  ].filter((c) => c.pct > 0).sort((a, b) => b.pct - a.pct);

  const city = String(row?.Rndrng_Prvdr_City ?? provider?.addresses?.[0]?.city ?? "");
  const state = String(row?.Rndrng_Prvdr_State_Abrvtn ?? provider?.addresses?.[0]?.state ?? "");
  const zip = String(row?.Rndrng_Prvdr_Zip_Cd ?? "");

  return (
    <div className="mx-auto max-w-5xl px-4 py-8">
      <div className="flex items-center gap-3 mb-6">
        <Link href="/hospice-market" className="text-sm text-[hsl(var(--muted-foreground))] hover:underline">
          ← Hospice Market
        </Link>
        {provider && (
          <>
            <span className="text-[hsl(var(--muted-foreground))]">·</span>
            <Link href={`/provider/${npi}`} className="text-sm text-[hsl(var(--primary))] hover:underline">
              View NPI Profile →
            </Link>
          </>
        )}
      </div>

      {/* ── Hero ── */}
      <div className="mb-6 rounded-xl border border-[hsl(var(--border))] bg-[hsl(var(--card))] p-6">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <h1 className="text-2xl font-bold">{name}</h1>
            <p className="mt-1 text-sm text-[hsl(var(--muted-foreground))]">
              NPI: <span className="font-mono font-medium">{npi}</span>
              {city && <> · {city}{state ? `, ${state}` : ""}{zip ? ` ${zip.slice(0, 5)}` : ""}</>}
            </p>
            <div className="mt-3 flex flex-wrap gap-2">
              <Badge variant="secondary">Hospice Provider</Badge>
              {row?.Rndrng_Prvdr_RUCA_Desc && (
                <Badge variant="secondary" className="text-xs">{String(row.Rndrng_Prvdr_RUCA_Desc)}</Badge>
              )}
              {profile.market_peers.length > 0 && (
                <Badge variant="secondary" className="text-xs">
                  Market Rank #{profile.market_peers.find((p) => String(p.Rndrng_Prvdr_NPI) === npi)?._rank ?? "—"} of {profile.market_peers.length} in {city}
                </Badge>
              )}
            </div>
          </div>
          <div className="text-sm text-[hsl(var(--muted-foreground))] space-y-0.5 shrink-0">
            {(row?._market_share_pct ?? 0) > 0 && (
              <p>Market Share: <span className="font-semibold text-foreground">{row!._market_share_pct.toFixed(1)}%</span></p>
            )}
            {(row?._market_total_volume ?? 0) > 0 && (
              <p>Market Total Benes: <span className="font-medium text-foreground">{row!._market_total_volume.toLocaleString()}</span></p>
            )}
          </div>
        </div>
      </div>

      {/* ── Key Metrics ── */}
      {row && (
        <div className="mb-6 grid grid-cols-2 gap-3 sm:grid-cols-4">
          <StatBox label="Total Beneficiaries" value={totalBenes > 0 ? totalBenes.toLocaleString() : "—"} />
          <StatBox label="Total Medicare Payments" value={currency(totalPayments)} />
          <StatBox label="Per-Beneficiary Payment" value={perBenePayment > 0 ? currency(perBenePayment) : "—"} />
          <StatBox
            label="Avg Patient Age"
            value={row.Bene_Avg_Age ? Number(row.Bene_Avg_Age).toFixed(1) : "—"}
            sub={row.Bene_Avg_Risk_Scre ? `Risk Score: ${Number(row.Bene_Avg_Risk_Scre).toFixed(2)}` : undefined}
          />
        </div>
      )}

      <div className="grid gap-6 lg:grid-cols-2">
        {/* ── Patient Demographics ── */}
        {row && (femalePct > 0 || dualPct > 0) && (
          <section className="rounded-xl border border-[hsl(var(--border))] p-5">
            <h2 className="mb-4 font-semibold">Patient Demographics</h2>
            <div className="space-y-4">
              {femalePct > 0 && (
                <div>
                  <div className="flex justify-between text-sm mb-1">
                    <span>Female</span>
                    <span className="text-[hsl(var(--muted-foreground))]">{femaleCnt.toLocaleString()} patients</span>
                  </div>
                  <PctBar pct={femalePct} />
                </div>
              )}
              {femalePct > 0 && (
                <div>
                  <div className="flex justify-between text-sm mb-1">
                    <span>Male</span>
                    <span className="text-[hsl(var(--muted-foreground))]">{maleCnt.toLocaleString()} patients</span>
                  </div>
                  <PctBar pct={100 - femalePct} color="bg-blue-400" />
                </div>
              )}
              {dualPct > 0 && (
                <div>
                  <div className="flex justify-between text-sm mb-1">
                    <span>Dual Eligible (Medicare + Medicaid)</span>
                    <span className="text-[hsl(var(--muted-foreground))]">{dualCnt.toLocaleString()} patients</span>
                  </div>
                  <PctBar pct={dualPct} color="bg-amber-400" />
                </div>
              )}
            </div>
          </section>
        )}

        {/* ── Clinical Condition Breakdown ── */}
        {CONDITIONS.length > 0 && (
          <section className="rounded-xl border border-[hsl(var(--border))] p-5">
            <h2 className="mb-4 font-semibold">Patient Condition Mix</h2>
            <div className="space-y-3">
              {CONDITIONS.map((c) => (
                <div key={c.label}>
                  <div className="flex justify-between text-sm mb-1">
                    <span>{c.label}</span>
                  </div>
                  <PctBar pct={c.pct} />
                </div>
              ))}
            </div>
          </section>
        )}

        {/* ── NPPES Provider Details ── */}
        {provider && (
          <section className="rounded-xl border border-[hsl(var(--border))] p-5">
            <h2 className="mb-4 font-semibold">NPPES Registration</h2>
            <div className="space-y-2 text-sm">
              <div className="flex justify-between">
                <span className="text-[hsl(var(--muted-foreground))]">Status</span>
                <Badge variant={provider.basic.status === "A" ? "success" : "secondary"}>
                  {provider.basic.status === "A" ? "Active" : (provider.basic.status ?? "Unknown")}
                </Badge>
              </div>
              <div className="flex justify-between">
                <span className="text-[hsl(var(--muted-foreground))]">Type</span>
                <span>{provider.enumeration_type === "NPI-2" ? "Organization" : "Individual"}</span>
              </div>
              {provider.basic.enumeration_date && (
                <div className="flex justify-between">
                  <span className="text-[hsl(var(--muted-foreground))]">Enumerated</span>
                  <span>{provider.basic.enumeration_date}</span>
                </div>
              )}
              {provider.basic.last_updated && (
                <div className="flex justify-between">
                  <span className="text-[hsl(var(--muted-foreground))]">Last Updated</span>
                  <span>{provider.basic.last_updated}</span>
                </div>
              )}
              {provider.taxonomies.length > 0 && (
                <div className="pt-2 border-t border-[hsl(var(--border))]">
                  <p className="text-[hsl(var(--muted-foreground))] mb-2">Specialties</p>
                  <div className="space-y-1">
                    {provider.taxonomies.slice(0, 4).map((t, i) => (
                      <div key={i} className="flex items-center gap-2 flex-wrap">
                        {t.primary && <Badge variant="success" className="text-xs">Primary</Badge>}
                        <span className="text-xs">{t.desc}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
              {provider.addresses.length > 0 && (
                <div className="pt-2 border-t border-[hsl(var(--border))]">
                  <p className="text-[hsl(var(--muted-foreground))] mb-1">Practice Address</p>
                  {provider.addresses.filter((a) => a.address_purpose === "LOCATION").slice(0, 1).map((a, i) => (
                    <div key={i} className="text-xs">
                      <p>{[a.address_1, a.address_2].filter(Boolean).join(", ")}</p>
                      <p>{a.city}, {a.state} {a.postal_code?.slice(0, 5)}</p>
                      {a.telephone_number && <p>Phone: {a.telephone_number}</p>}
                    </div>
                  ))}
                </div>
              )}
            </div>
          </section>
        )}

        {/* ── No CMS Hospice Data ── */}
        {!row && (
          <section className="rounded-xl border border-[hsl(var(--border))] p-5">
            <h2 className="mb-2 font-semibold">Medicare Hospice Data</h2>
            <p className="text-sm text-[hsl(var(--muted-foreground))]">
              No Medicare PAC hospice billing data found for this NPI. The provider may not bill hospice
              services or may have volume below CMS reporting thresholds.
            </p>
          </section>
        )}
      </div>

      {/* ── Market Peers ── */}
      {profile.market_peers.length > 1 && (
        <section className="mt-6 rounded-xl border border-[hsl(var(--border))] p-5">
          <h2 className="mb-4 font-semibold">
            {city} Market Competitors ({profile.market_peers.length} providers)
          </h2>
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-8">#</TableHead>
                  <TableHead>Provider</TableHead>
                  <TableHead>NPI</TableHead>
                  <TableHead className="text-right">Beneficiaries</TableHead>
                  <TableHead>Market Share</TableHead>
                  <TableHead className="text-right">Medicare Payments</TableHead>
                  <TableHead className="text-right">Avg Age</TableHead>
                  <TableHead className="text-right">Risk Score</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {profile.market_peers.map((peer) => {
                  const isMe = String(peer.Rndrng_Prvdr_NPI) === npi;
                  return (
                    <TableRow key={String(peer.Rndrng_Prvdr_NPI ?? peer._rank)} className={isMe ? "bg-[hsl(var(--primary)/0.07)]" : ""}>
                      <TableCell className="text-xs text-[hsl(var(--muted-foreground))]">{peer._rank}</TableCell>
                      <TableCell className="font-medium text-xs max-w-[200px] truncate">
                        {peer.Rndrng_Prvdr_NPI ? (
                          <Link href={`/hospice/${peer.Rndrng_Prvdr_NPI}`} className={`hover:underline ${isMe ? "text-[hsl(var(--primary))] font-bold" : ""}`}>
                            {peer._provider_name || "—"}
                          </Link>
                        ) : (peer._provider_name || "—")}
                        {isMe && <span className="ml-2 text-[hsl(var(--primary))] text-xs">(you)</span>}
                      </TableCell>
                      <TableCell className="font-mono text-xs">
                        {peer.Rndrng_Prvdr_NPI ? (
                          <Link href={`/provider/${peer.Rndrng_Prvdr_NPI}`} className="text-[hsl(var(--primary))] hover:underline">
                            {String(peer.Rndrng_Prvdr_NPI)}
                          </Link>
                        ) : "—"}
                      </TableCell>
                      <TableCell className="text-right text-xs">{peer._market_volume.toLocaleString()}</TableCell>
                      <TableCell>
                        <div className="flex items-center gap-1.5">
                          <div className="h-1.5 w-20 rounded-full bg-[hsl(var(--border))]">
                            <div className={`h-1.5 rounded-full ${isMe ? "bg-[hsl(var(--primary))]" : "bg-[hsl(var(--muted-foreground))]"}`}
                              style={{ width: `${Math.min(peer._market_share_pct * 2, 100)}%` }} />
                          </div>
                          <span className="text-xs">{peer._market_share_pct.toFixed(1)}%</span>
                        </div>
                      </TableCell>
                      <TableCell className="text-right text-xs">{currency(peer.Tot_Mdcr_Pymt_Amt)}</TableCell>
                      <TableCell className="text-right text-xs">{peer.Bene_Avg_Age ? Number(peer.Bene_Avg_Age).toFixed(1) : "—"}</TableCell>
                      <TableCell className="text-right text-xs">{peer.Bene_Avg_Risk_Scre ? Number(peer.Bene_Avg_Risk_Scre).toFixed(2) : "—"}</TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </div>
        </section>
      )}

      {/* ── Compliance Note ── */}
      <div className="mt-6 rounded-lg border border-[hsl(var(--border))] bg-[hsl(var(--muted)/0.3)] p-4 text-sm">
        <p className="font-semibold mb-1">Compliance &amp; Verification</p>
        <p className="text-[hsl(var(--muted-foreground))]">
          Always verify provider credentials and exclusion status before referral.{" "}
          <a href="https://oig.hhs.gov/exclusions/exclusions_report.asp" target="_blank" rel="noopener noreferrer" className="underline text-[hsl(var(--primary))]">
            Check OIG Exclusion List
          </a>
          {" · "}
          <a href={`https://npiregistry.cms.hhs.gov/search?number=${npi}`} target="_blank" rel="noopener noreferrer" className="underline text-[hsl(var(--primary))]">
            Verify on NPPES
          </a>
          {" · "}
          <Link href={`/provider/${npi}`} className="underline text-[hsl(var(--primary))]">
            View Full NPI Profile
          </Link>
        </p>
      </div>
    </div>
  );
}
