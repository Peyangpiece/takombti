import type { NextRequest } from "next/server";
import { createInquiry } from "@/lib/inquiries";
import { allowResponse, clientIp, json, readJson } from "@/lib/http";

export async function POST(req: NextRequest) {
  const body = await readJson(req);
  if (!body) return json({ error: "bad_request" }, 400);
  // 人には見えない欄に何か入っていたら、機械による送信とみなし、受け付けたふりをして捨てる
  if (typeof body.website === "string" && body.website !== "")
    return json({ ok: true }, 201);
  if (!allowResponse(clientIp(req), "contact"))
    return json({ error: "rate_limited" }, 429);
  const r = await createInquiry({
    kind: body.kind,
    body: body.body,
    replyTo: body.replyTo,
    surveyRef: body.surveyRef,
  });
  return r.ok ? json({ ok: true }, 201) : json({ error: r.error }, 400);
}
