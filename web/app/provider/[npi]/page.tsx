import Link from "next/link";
import { notFound } from "next/navigation";
import { getNpiByNumber, getMedicarePhysicianData, num, currency } from "@/lib/cms-direct";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

export default async function ProviderProfilePage({
  params,
}: {
  params: Promise<{ npi: string }>;
}) {
  const { npi } = await params;

  const [provider, medicareData] = await Promise.all([
    getNpiByNumber(npi),
    getMedicarePhysicianData(npi),
  ]);

  if (!provider) notFound();

  const basic = provider.basic;
  const isOrg = provider.enumeration_type === "NPI-2";
  const name = isOrg
    ? (basic.organization_name ?? basic.name ?? npi)
    : [basic.name_prefix, basic.first_name, basic.middle_name, basic.last_name, basic.name_suffix]
        .filter(Boolean)
        .join(" ");

  const locationAddr = provider.addresses.find((a) => a.address_purpose === "LOCATION");
  const mailingAddr = provider.addresses.find((a) => a.address_purpose === "MAILING");
  const primaryTax = provider.taxonomies.find((t) => t.primary) ?? provider.taxonomies[0];

  const totalBenes = medicareData.reduce((s, r) => s + num(r.Tot_Benes), 0);
  const totalSrvcs = medicareData.reduce((s, r) => s + num(r.Tot_Srvcs), 0);
  const totalPayments = medicareData.reduce((s, r) => s + num(r.Tot_Mdcr_Pymt_Amt), 0);
  const totalSubmitted = medicareData.reduce(
    (s, r) => s + num(r.Avg_Sbmtd_Chrg) * num(r.Tot_Srvcs), 0
  );

  const ratingMap: Record<string, string> = {
    "1": "State License", "2": "Medicaid", "3": "Medicare UPIN",
    "4": "CHAMPUS", "5": "NPI", "6": "Tax ID", "7": "DEA",
    "8": "Employer ID", "9": "SL", "10": "Other",
  };

  return (
    <div className="mx-auto max-w-5xl px-4 py-8">
      <Link
        href="/npi-lookup"
        className="text-sm text-[hsl(var(--muted-foreground))] hover:underline mb-6 inline-block"
      >
        ← Back to NPI Lookup
      </Link>

      {/* ── Hero ── */}
      <div className="mb-6 rounded-xl border border-[hsl(var(--border))] bg-[hsl(var(--card))] p-6">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <h1 className="text-2xl font-bold">{name}</h1>
            <p className="mt-1 text-sm text-[hsl(var(--muted-foreground))]">
              NPI: <span className="font-mono font-medium">{npi}</span>
              {basic.credential && <> · <span className="font-medium">{basic.credential}</span></>}
              {basic.gender && <> · {basic.gender === "M" ? "Male" : basic.gender === "F" ? "Female" : basic.gender}</>}
            </p>
            <div className="mt-3 flex flex-wrap gap-2">
              <Badge variant={basic.status === "A" ? "success" : "secondary"}>
                {basic.status === "A" ? "Active" : (basic.status ?? "Unknown")}
              </Badge>
              <Badge variant="secondary">{isOrg ? "Organization (NPI-2)" : "Individual (NPI-1)"}</Badge>
              {primaryTax && (
                <Badge variant="secondary" className="max-w-[260px] truncate" title={primaryTax.desc}>
                  {primaryTax.desc}
                </Badge>
              )}
            </div>
          </div>
          <div className="text-sm text-[hsl(var(--muted-foreground))] space-y-0.5 shrink-0">
            <p>Enumerated: <span className="font-medium text-foreground">{basic.enumeration_date ?? "—"}</span></p>
            <p>Last Updated: <span className="font-medium text-foreground">{basic.last_updated ?? "—"}</span></p>
            {isOrg && basic.organizational_subpart && (
              <p>Subpart: <span className="font-medium text-foreground">{basic.organizational_subpart}</span></p>
            )}
            {isOrg && basic.authorized_official_last_name && (
              <p>Auth. Official: <span className="font-medium text-foreground">
                {[basic.authorized_official_first_name, basic.authorized_official_last_name].filter(Boolean).join(" ")}
                {basic.authorized_official_credential && `, ${basic.authorized_official_credential}`}
              </span></p>
            )}
            {isOrg && basic.authorized_official_title_or_position && (
              <p>Title: <span className="font-medium text-foreground">{basic.authorized_official_title_or_position}</span></p>
            )}
          </div>
        </div>
      </div>

      {/* ── Medicare Summary ── */}
      {medicareData.length > 0 && (
        <div className="mb-6 grid grid-cols-2 gap-3 sm:grid-cols-4">
          {[
            { label: "Beneficiaries", value: totalBenes.toLocaleString() },
            { label: "Services Rendered", value: totalSrvcs.toLocaleString() },
            { label: "Medicare Payments", value: currency(totalPayments) },
            { label: "Submitted Charges", value: currency(totalSubmitted) },
          ].map((s) => (
            <div key={s.label} className="rounded-lg border border-[hsl(var(--border))] p-3">
              <p className="text-xs text-[hsl(var(--muted-foreground))]">{s.label}</p>
              <p className="mt-1 text-lg font-semibold">{s.value}</p>
            </div>
          ))}
        </div>
      )}

      <div className="grid gap-6 lg:grid-cols-2">
        {/* ── Specialties ── */}
        <section className="rounded-xl border border-[hsl(var(--border))] p-5">
          <h2 className="mb-4 font-semibold">Specialties &amp; Taxonomies ({provider.taxonomies.length})</h2>
          <div className="space-y-4">
            {provider.taxonomies.map((t, i) => (
              <div key={i} className="text-sm">
                <div className="flex flex-wrap items-center gap-2">
                  {t.primary && <Badge variant="success" className="text-xs">Primary</Badge>}
                  <span className="font-medium">{t.desc}</span>
                </div>
                <p className="mt-0.5 text-xs text-[hsl(var(--muted-foreground))]">
                  Code: <span className="font-mono">{t.code}</span>
                  {t.taxonomy_group && ` · Group: ${t.taxonomy_group}`}
                  {t.state && ` · State: ${t.state}`}
                  {t.license && ` · License: ${t.license}`}
                </p>
              </div>
            ))}
          </div>
        </section>

        {/* ── Addresses ── */}
        <section className="rounded-xl border border-[hsl(var(--border))] p-5">
          <h2 className="mb-4 font-semibold">Practice Locations ({provider.addresses.length})</h2>
          <div className="space-y-5">
            {provider.addresses.map((a, i) => (
              <div key={i} className="text-sm">
                <div className="mb-1 flex items-center gap-2">
                  <Badge variant={a.address_purpose === "LOCATION" ? "success" : "secondary"} className="text-xs">
                    {a.address_purpose}
                  </Badge>
                  <span className="text-xs text-[hsl(var(--muted-foreground))]">{a.address_type}</span>
                </div>
                <p className="font-medium">
                  {[a.address_1, a.address_2].filter(Boolean).join(", ")}
                </p>
                <p className="text-[hsl(var(--muted-foreground))]">
                  {a.city}, {a.state} {a.postal_code?.slice(0, 5)}
                  {a.country_code !== "US" && ` · ${a.country_name}`}
                </p>
                {a.telephone_number && (
                  <p className="text-[hsl(var(--muted-foreground))]">
                    Phone: {a.telephone_number}
                    {a.fax_number && ` · Fax: ${a.fax_number}`}
                  </p>
                )}
              </div>
            ))}
          </div>
        </section>

        {/* ── Identifiers ── */}
        {provider.identifiers.length > 0 && (
          <section className="rounded-xl border border-[hsl(var(--border))] p-5">
            <h2 className="mb-4 font-semibold">Other Identifiers ({provider.identifiers.length})</h2>
            <div className="divide-y divide-[hsl(var(--border)/0.5)]">
              {provider.identifiers.map((id, i) => (
                <div key={i} className="flex items-center justify-between py-2 text-sm">
                  <div>
                    <span className="font-medium">{id.desc ?? ratingMap[id.code] ?? id.code}</span>
                    {id.state && <span className="ml-1 text-xs text-[hsl(var(--muted-foreground))]">({id.state})</span>}
                    {id.issuer && <span className="ml-1 text-xs text-[hsl(var(--muted-foreground))]">· {id.issuer}</span>}
                  </div>
                  <span className="font-mono text-sm">{id.identifier}</span>
                </div>
              ))}
            </div>
          </section>
        )}

        {/* ── Other Names ── */}
        {provider.other_names && provider.other_names.length > 0 && (
          <section className="rounded-xl border border-[hsl(var(--border))] p-5">
            <h2 className="mb-4 font-semibold">Other Names</h2>
            <div className="space-y-2 text-sm">
              {provider.other_names.map((n, i) => (
                <div key={i}>
                  <span className="font-medium">{String(n.organization_name ?? [n.first_name, n.last_name].filter(Boolean).join(" "))}</span>
                  {n.type ? <span className="ml-2 text-xs text-[hsl(var(--muted-foreground))]">({String(n.type)})</span> : null}
                </div>
              ))}
            </div>
          </section>
        )}
      </div>

      {/* ── Medicare Part B Services ── */}
      {medicareData.length > 0 && (
        <section className="mt-6 rounded-xl border border-[hsl(var(--border))] p-5">
          <h2 className="mb-4 font-semibold">Medicare Part B Services ({medicareData.length} service types)</h2>
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>HCPCS Code</TableHead>
                  <TableHead>Description</TableHead>
                  <TableHead>Place</TableHead>
                  <TableHead className="text-right">Beneficiaries</TableHead>
                  <TableHead className="text-right">Services</TableHead>
                  <TableHead className="text-right">Avg Submitted</TableHead>
                  <TableHead className="text-right">Avg Allowed</TableHead>
                  <TableHead className="text-right">Avg Medicare Pmt</TableHead>
                  <TableHead className="text-right">Total Medicare Pmt</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {medicareData.map((row, i) => (
                  <TableRow key={i}>
                    <TableCell className="font-mono text-xs">{row.HCPCS_Cd ?? "—"}</TableCell>
                    <TableCell className="max-w-[220px] truncate text-xs" title={row.HCPCS_Desc}>{row.HCPCS_Desc ?? "—"}</TableCell>
                    <TableCell className="text-xs">
                      <Badge variant={row.Place_Of_Srvc === "O" ? "secondary" : "default"} className="text-xs">
                        {row.Place_Of_Srvc === "O" ? "Office" : row.Place_Of_Srvc === "F" ? "Facility" : (row.Place_Of_Srvc ?? "—")}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right text-xs">{num(row.Tot_Benes).toLocaleString()}</TableCell>
                    <TableCell className="text-right text-xs">{num(row.Tot_Srvcs).toLocaleString()}</TableCell>
                    <TableCell className="text-right text-xs">{currency(row.Avg_Sbmtd_Chrg)}</TableCell>
                    <TableCell className="text-right text-xs">{currency(row.Avg_Mdcr_Alowd_Amt)}</TableCell>
                    <TableCell className="text-right text-xs">{currency(row.Avg_Mdcr_Pymt_Amt)}</TableCell>
                    <TableCell className="text-right text-xs font-medium">{currency(row.Tot_Mdcr_Pymt_Amt)}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </section>
      )}

      {/* ── Compliance Note ── */}
      <div className="mt-6 rounded-lg border border-[hsl(var(--border))] bg-[hsl(var(--muted)/0.3)] p-4 text-sm">
        <p className="font-semibold mb-1">Compliance Verification</p>
        <p className="text-[hsl(var(--muted-foreground))]">
          Always verify provider credentials and exclusion status before referral.{" "}
          <a
            href={`https://oig.hhs.gov/exclusions/exclusions_report.asp`}
            target="_blank"
            rel="noopener noreferrer"
            className="underline text-[hsl(var(--primary))]"
          >
            Check OIG Exclusion List
          </a>
          {" · "}
          <a
            href={`https://npiregistry.cms.hhs.gov/search?number=${npi}`}
            target="_blank"
            rel="noopener noreferrer"
            className="underline text-[hsl(var(--primary))]"
          >
            Verify on NPPES
          </a>
          {locationAddr && (
            <>
              {" · "}
              <a
                href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(
                  [locationAddr.address_1, locationAddr.city, locationAddr.state].filter(Boolean).join(", ")
                )}`}
                target="_blank"
                rel="noopener noreferrer"
                className="underline text-[hsl(var(--primary))]"
              >
                View on Map
              </a>
            </>
          )}
        </p>
      </div>
    </div>
  );
}
