import { NextRequest } from "next/server";
import Anthropic from "@anthropic-ai/sdk";
import {
  getHospiceMarketShare,
  getHospitalOpportunity,
  getNursingHomeOpportunity,
  lookupNpi,
} from "@/lib/cms-direct";

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

const tools: Anthropic.Tool[] = [
  {
    name: "hospice_market_share",
    description:
      "Get hospice provider market share rankings from Medicare PAC utilization data. Filter by US state abbreviation (e.g. TX, CA).",
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
      "Score hospitals by hospice referral opportunity using Medicare inpatient discharge data.",
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
    description: "Score nursing homes / SNFs by hospice opportunity using CMS provider data.",
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
    description: "Look up healthcare providers in the NPPES NPI registry.",
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
          description: "Specialty e.g. Hospice, Cardiology",
        },
        limit: { type: "number", description: "Max results (default 20)" },
      },
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
            system:
              "You are a Medicare market intelligence assistant. You help hospice organizations analyze market share, identify hospital and nursing home referral opportunities, and look up provider information using live CMS public data. Be concise and actionable. When presenting data, summarize the key findings rather than listing every row.",
            messages: currentMessages,
            tools,
          });

          // Stream text blocks
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
