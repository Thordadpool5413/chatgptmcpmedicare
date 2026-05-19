import { NextRequest, NextResponse } from "next/server";
import {
  getHospiceMarketShare,
  getHospiceProviderProfile,
  getHospitalOpportunity,
  getNursingHomeOpportunity,
  getHhaOpportunity,
  getSnfUtilization,
  lookupNpi,
  getNpiByNumber,
  getMedicarePhysicianData,
  getHospitalProfile,
  getNursingHomeProfile,
} from "@/lib/cms-direct";

export async function POST(req: NextRequest) {
  try {
    const { tool, args } = (await req.json()) as {
      tool: string;
      args: Record<string, unknown>;
    };

    if (!tool) return NextResponse.json({ error: "tool required" }, { status: 400 });

    let result: unknown;

    switch (tool) {
      case "hospice_market_share_proxy":
        result = await getHospiceMarketShare(
          args.state as string | undefined,
          (args.max_rows as number | undefined) ?? 200,
          args.city as string | undefined,
        );
        break;

      case "get_hospice_provider_profile": {
        const npi = args.npi as string;
        if (!npi) return NextResponse.json({ error: "npi required" }, { status: 400 });
        result = await getHospiceProviderProfile(npi);
        break;
      }

      case "hospital_hospice_opportunity":
        result = await getHospitalOpportunity(
          args.state as string | undefined,
          args.city as string | undefined,
          (args.max_rows as number | undefined) ?? 200,
        );
        break;

      case "nursing_home_opportunity":
        result = await getNursingHomeOpportunity(
          args.state as string | undefined,
          args.city as string | undefined,
          (args.max_rows as number | undefined) ?? 200,
        );
        break;

      case "lookup_npi":
        result = await lookupNpi(args as Parameters<typeof lookupNpi>[0]);
        break;

      case "get_provider_profile": {
        const npi = args.npi as string;
        if (!npi) return NextResponse.json({ error: "npi required" }, { status: 400 });
        const [provider, medicare] = await Promise.all([
          getNpiByNumber(npi),
          getMedicarePhysicianData(npi),
        ]);
        result = { provider, medicare_services: medicare };
        break;
      }

      case "get_hospital_profile": {
        const ccn = args.ccn as string;
        if (!ccn) return NextResponse.json({ error: "ccn required" }, { status: 400 });
        result = await getHospitalProfile(ccn);
        break;
      }

      case "get_facility_profile": {
        const ccn = args.ccn as string;
        if (!ccn) return NextResponse.json({ error: "ccn required" }, { status: 400 });
        result = await getNursingHomeProfile(ccn);
        break;
      }

      case "hha_opportunity":
        result = await getHhaOpportunity(
          args.state as string | undefined,
          args.city as string | undefined,
          (args.max_rows as number | undefined) ?? 200,
        );
        break;

      case "get_snf_utilization": {
        const ccn = args.ccn as string;
        if (!ccn) return NextResponse.json({ error: "ccn required" }, { status: 400 });
        result = await getSnfUtilization(ccn);
        break;
      }

      case "list_cached_national_datasets":
        result = { cached_datasets: [] };
        break;

      case "cache_core_national_datasets":
        result = {
          results: {},
          note: "Caching not available — data is fetched live from CMS APIs.",
        };
        break;

      default:
        return NextResponse.json({ error: `Unknown tool: ${tool}` }, { status: 400 });
    }

    return NextResponse.json({ result });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
