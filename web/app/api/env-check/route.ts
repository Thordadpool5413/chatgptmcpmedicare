import { NextResponse } from "next/server";

export async function GET() {
  const vars = [
    "ANTHROPIC_API_KEY",
    "DEPLOY_SECRET",
    "NODE_ENV",
    "PORT",
  ];

  const status: Record<string, { set: boolean; preview?: string }> = {};
  for (const v of vars) {
    const val = process.env[v];
    status[v] = {
      set: !!val,
      preview: val ? (v.includes("KEY") || v.includes("SECRET") ? `${val.slice(0, 6)}…` : val) : undefined,
    };
  }

  const allRequired = status["ANTHROPIC_API_KEY"].set && status["DEPLOY_SECRET"].set;

  return NextResponse.json({
    ok: allRequired,
    message: allRequired
      ? "All required environment variables are set."
      : "Missing required environment variables. Set them in Hostinger hPanel → Node.js → Environment Variables.",
    variables: status,
  });
}
