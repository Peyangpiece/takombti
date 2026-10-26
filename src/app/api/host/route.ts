import type { NextRequest } from "next/server";
import { deleteSurvey, getHost } from "@/lib/surveys";
import { hostKeyOf, json } from "@/lib/http";

export async function GET(req: NextRequest) {
  const key = hostKeyOf(req);
  const view = key ? await getHost(key) : null;
  if (!view) return json({ error: "not_found" }, 404);
  return json(view);
}

export async function DELETE(req: NextRequest) {
  const key = hostKeyOf(req);
  const status = key ? await deleteSurvey(key) : "not_found";
  return json({ status }, status === "ok" ? 200 : 404);
}
