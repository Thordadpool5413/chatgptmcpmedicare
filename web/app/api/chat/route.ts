import { NextRequest } from "next/server";
import Anthropic from "@anthropic-ai/sdk";
import {
  getHospiceMarketShare,
  getHospitalOpportunity,
  getNursingHomeOpportunity,
  lookupNpi,
  getNpiByNumber,
  getMedicarePhysicianData,
  getHospitalProfile,
  getNursingHomeProfile,
} from "@/lib/cms-direct";

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

const tools: Anthropic.Tool[] = [
  {
    name: "hospice_market_share",
    description:
      "Get hospice provider market share rankings from Medicare PAC utilization data. Returns provider names, cities, beneficiary volumes, market share %, Medicare payments, avg patient age, and risk scores. Filter by US state abbreviation.",
    input_schema: {
      type: "object" as const,
      properties: {
        state: { type: "string", description: "2-letter US state abbreviation (optional)" },
        max_rows: { type: "number", description: "Maximum rows to return (default 50)" },
      },
    },
  },
  {
    name: "hospital_opportunity",
    description:
      "Score hospitals by hospice referral opportunity using Medicare inpatient discharge data. Returns hospital name, CCN, city, state, DRG codes/descriptions, discharge volumes, average payments, hospice DRG matches, and opportunity scores.",
    input_schema: {
      type: "object" as const,
      properties: {
        state: { type: "string", description: "2-letter US state abbreviation (optional)" },
        city: { type: "string", description: "City name (optional)" },
        max_rows: { type: "number", description: "Maximum rows to return (default 50)" },
      },
    },
  },
  {
    name: "nursing_home_opportunity",
    description:
      "Score nursing homes / SNFs by hospice opportunity using CMS provider data. Returns facility name, CCN, address, ownership type, bed count, CMS 5-star ratings (overall, health inspection, staffing, RN staffing, QM), quality pressure, and opportunity scores.",
    input_schema: {
      type: "object" as const,
      properties: {
        state: { type: "string", description: "2-letter US state abbreviation (optional)" },
        city: { type: "string", description: "City name (optional)" },
        max_rows: { type: "number", description: "Maximum rows to return (default 50)" },
      },
    },
  },
  {
    name: "npi_lookup",
    description:
      "Look up healthcare providers in the NPPES NPI registry. Returns NPI number, name, credential, gender, specialty, license, all practice addresses, phone, fax, status, and enrollment dates.",
    input_schema: {
      type: "object" as const,
      properties: {
        first_name: { type: "string" },
        last_name: { type: "string" },
        organization_name: { type: "string" },
        state: { type: "string", description: "2-letter state abbreviation" },
        city: { type: "string" },
        taxonomy_description: {
          type: "string",
          description: "Specialty e.g. Hospice, Cardiology, Family Practice",
        },
        limit: { type: "number", description: "Max results (default 20)" },
      },
    },
  },
  {
    name: "get_provider_profile",
    description:
      "Get a comprehensive profile for a specific provider by NPI number. Returns full NPPES record (all specialties, all addresses, all identifiers) plus Medicare Part B billing data (HCPCS codes, beneficiary counts, service counts, payments).",
    input_schema: {
      type: "object" as const,
      properties: {
        npi: { type: "string", description: "10-digit NPI number" },
      },
      required: ["npi"],
    },
  },
  {
    name: "get_hospital_profile",
    description:
      "Get a comprehensive profile for a specific hospital by CCN (CMS Certification Number). Returns all DRG data, discharge volumes, payment statistics, hospice-relevant DRG matches, and total opportunity score.",
    input_schema: {
      type: "object" as const,
      properties: {
        ccn: { type: "string", description: "CMS Certification Number (CCN)" },
      },
      required: ["ccn"],
    },
  },
  {
    name: "get_facility_profile",
    description:
      "Get a comprehensive profile for a specific nursing home by CCN. Returns all CMS quality ratings (overall, health inspection, staffing, RN staffing, QM), bed counts, occupancy, ownership, and hospice opportunity analysis.",
    input_schema: {
      type: "object" as const,
      properties: {
        ccn: { type: "string", description: "CMS Certification Number (CCN)" },
      },
      required: ["ccn"],
    },
  },
];

async function runTool(name: string, input: Record<string, unknown>): Promise<string> {
  try {
    let result: unknown;
    switch (name) {
      case "hospice_market_share":
        result = await getHospiceMarketShare(
          input.state as string | undefined,
          (input.max_rows as number | undefined) ?? 50,
        );
        break;
      case "hospital_opportunity":
        result = await getHospitalOpportunity(
          input.state as string | undefined,
          input.city as string | undefined,
          (input.max_rows as number | undefined) ?? 50,
        );
        break;
      case "nursing_home_opportunity":
        result = await getNursingHomeOpportunity(
          input.state as string | undefined,
          input.city as string | undefined,
          (input.max_rows as number | undefined) ?? 50,
        );
        break;
      case "npi_lookup":
        result = await lookupNpi(input as Parameters<typeof lookupNpi>[0]);
        break;
      case "get_provider_profile": {
        const npi = input.npi as string;
        const [provider, medicare] = await Promise.all([
          getNpiByNumber(npi),
          getMedicarePhysicianData(npi),
        ]);
        result = { provider, medicare_services: medicare };
        break;
      }
      case "get_hospital_profile":
        result = await getHospitalProfile(input.ccn as string);
        break;
      case "get_facility_profile":
        result = await getNursingHomeProfile(input.ccn as string);
        break;
      default:
        return `Unknown tool: ${name}`;
    }
    return JSON.stringify(result);
  } catch (err) {
    return `Error: ${err instanceof Error ? err.message : String(err)}`;
  }
}

export async function POST(req: NextRequest) {
  const { messages } = (await req.json()) as {
    messages: Anthropic.MessageParam[];
  };

  const encoder = new TextEncoder();
  const stream = new ReadableStream({
    async start(controller) {
      const send = (data: string) =>
        controller.enqueue(encoder.encode(`data: ${JSON.stringify({ text: data })}\n\n`));

      try {
        let currentMessages = [...messages];

        while (true) {
          const response = await client.messages.create({
            model: "claude-sonnet-4-6",
            max_tokens: 4096,
            system: `You are a Medicare market intelligence assistant for hospice organizations. You have access to live CMS public data and can:
- Analyze hospice market share by provider, city, and state
- Score hospitals and nursing homes for hospice referral opportunity
- Look up any healthcare provider by NPI number
- Pull full provider profiles with Medicare billing history
- Get complete hospital DRG breakdowns and nursing home quality ratings

When presenting data, be specific and actionable:
- Lead with the most important finding (top provider, highest score, etc.)
- Include key metrics: names, scores, volumes, payments
- For provider lookups, summarize specialties, location, and Medicare activity
- Suggest follow-up actions (e.g., "View the full profile at /provider/[NPI]")
- Use bullet points and tables in markdown for clarity`,
            messages: currentMessages,
            tools,
          });

          for (const block of response.content) {
            if (block.type === "text") {
              send(block.text);
            }
          }

          if (response.stop_reason === "end_turn") break;

          if (response.stop_reason === "tool_use") {
            const toolUses = response.content.filter((b) => b.type === "tool_use");
            currentMessages.push({ role: "assistant", content: response.content });

            const toolResults: Anthropic.ToolResultBlockParam[] = [];
            for (const toolUse of toolUses) {
              if (toolUse.type !== "tool_use") continue;
              send(`\n\n_Fetching ${toolUse.name.replace(/_/g, " ")}…_\n\n`);
              const result = await runTool(
                toolUse.name,
                toolUse.input as Record<string, unknown>,
              );
              toolResults.push({ type: "tool_result", tool_use_id: toolUse.id, content: result });
            }

            currentMessages.push({ role: "user", content: toolResults });
            continue;
          }

          break;
        }
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        send(`\n\nError: ${msg}`);
      } finally {
        controller.enqueue(encoder.encode("data: [DONE]\n\n"));
        controller.close();
      }
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
      Connection: "keep-alive",
    },
  });
}
