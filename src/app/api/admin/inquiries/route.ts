import type { NextRequest } from "next/server";
import { listInquiries } from "@/lib/inquiries";
import { requireAdmin } from "@/lib/admin";
import { json } from "@/lib/http";

export async function GET(req: NextRequest) {
  const denied = await requireAdmin(req);
  if (denied) return denied;
  return json({ inquiries: await listInquiries() });
}
