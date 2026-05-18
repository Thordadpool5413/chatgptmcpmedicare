const MCP_URL = process.env.MCP_SERVER_URL || "http://127.0.0.1:8000/mcp";

interface McpRequest {
  jsonrpc: "2.0";
  id: number;
  method: string;
  params?: Record<string, unknown>;
}

interface McpResponse {
  jsonrpc: "2.0";
  id: number;
  result?: { content?: Array<{ type: string; text: string }> };
  error?: { code: number; message: string };
}

let requestId = 1;

export async function callTool(name: string, args: Record<string, unknown> = {}): Promise<unknown> {
  const body: McpRequest = {
    jsonrpc: "2.0",
    id: requestId++,
    method: "tools/call",
    params: { name, arguments: args },
  };

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 30_000);

  let res: Response;
  try {
    res = await fetch(MCP_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json", Accept: "application/json, text/event-stream" },
      body: JSON.stringify(body),
      signal: controller.signal,
    });
  } catch (err) {
    clearTimeout(timeout);
    if ((err as Error).name === "AbortError") {
      throw new Error("MCP server timed out after 30 seconds. Is the Python backend running?");
    }
    throw new Error(`Cannot reach MCP server at ${MCP_URL}: ${(err as Error).message}`);
  } finally {
    clearTimeout(timeout);
  }

  if (!res.ok) throw new Error(`MCP HTTP ${res.status}`);

  const text = await res.text();

  // Handle SSE stream
  const jsonLines = text
    .split("\n")
    .filter((l) => l.startsWith("data: "))
    .map((l) => l.slice(6).trim())
    .filter((l) => l && l !== "[DONE]");

  let parsed: McpResponse | null = null;
  for (const line of jsonLines) {
    try {
      const obj = JSON.parse(line) as McpResponse;
      if (obj.id === body.id || obj.result || obj.error) {
        parsed = obj;
        break;
      }
    } catch {}
  }

  if (!parsed) {
    try {
      parsed = JSON.parse(text) as McpResponse;
    } catch {
      throw new Error("Could not parse MCP response");
    }
  }

  if (parsed.error) throw new Error(parsed.error.message);

  const content = parsed.result?.content;
  if (content?.[0]?.type === "text") {
    try {
      return JSON.parse(content[0].text);
    } catch {
      return content[0].text;
    }
  }

  return parsed.result;
}
