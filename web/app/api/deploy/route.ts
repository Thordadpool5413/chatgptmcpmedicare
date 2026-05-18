import { NextRequest, NextResponse } from "next/server";
import { exec } from "child_process";
import path from "path";

export async function POST(req: NextRequest) {
  const secret = req.headers.get("x-deploy-secret");
  if (!secret || secret !== process.env.DEPLOY_SECRET) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const repoDir = path.join(process.cwd(), "..");

  const script = `
    cd ${repoDir} && \
    git fetch origin main && \
    git reset --hard origin/main && \
    cd ${repoDir}/web && \
    npm install && \
    pm2 restart all 2>/dev/null || true
  `;

  exec(script, { timeout: 600_000 }, (err, stdout, stderr) => {
    console.log("[deploy] stdout:", stdout);
    if (stderr) console.log("[deploy] stderr:", stderr);
    if (err) console.error("[deploy] error:", err.message);
  });

  return NextResponse.json({ ok: true, message: "Deploy started" });
}
