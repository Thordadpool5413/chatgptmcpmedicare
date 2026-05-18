export async function mcp(tool: string, args: Record<string, unknown> = {}): Promise<unknown> {
  const res = await fetch("/api/mcp", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ tool, args }),
  });

  const contentType = res.headers.get("content-type") ?? "";
  if (!contentType.includes("application/json")) {
    const text = await res.text();
    throw new Error(`Server error (${res.status}): ${text.slice(0, 200)}`);
  }

  const data = await res.json();
  if (!res.ok || data.error) throw new Error(data.error ?? "Request failed");
  return data.result;
}
