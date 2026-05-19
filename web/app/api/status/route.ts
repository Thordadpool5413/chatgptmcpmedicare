import { NextResponse } from "next/server";
import { checkApiHealth } from "@/lib/cms-direct";

export async function GET() {
  const results = await checkApiHealth();
  return NextResponse.json(results);
}
