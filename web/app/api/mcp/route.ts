import { NextRequest, NextResponse } from "next/server";
import { callTool } from "@/lib/mcp";

export async function POST(req: NextRequest) {
  try {
    const { tool, args } = await req.json();
    if (!tool) return NextResponse.json({ error: "tool required" }, { status: 400 });
    const result = await callTool(tool, args ?? {});
    return NextResponse.json({ result });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
