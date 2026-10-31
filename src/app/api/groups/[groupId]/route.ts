import type { NextRequest } from "next/server";
import { getGroup } from "@/lib/groups";
import {
  adminKeyOf,
  hostCookie,
  hostKeyOf,
  isId,
  json,
  setSurveyCookie,
} from "@/lib/http";

// グループのページ（仕様書 §4.15）。だれにでも：状態・人数・参加した数・作った人の呼び名。
// メンバー（X-Host-Key が、このグループのメンバーの鍵）にだけ：メンバーの呼び名と、始めたあとは答えるための
// 招待リンクの ID、自分の診断の状態。ほかの人の診断の進み具合・だれがだれに答えたか・ほかの人の鍵は返さない
export async function GET(
  req: NextRequest,
  ctx: { params: Promise<{ groupId: string }> },
) {
  const { groupId } = await ctx.params;
  if (!isId(groupId)) return json({ error: "not_found" }, 404);
  const view = await getGroup(groupId, hostKeyOf(req), adminKeyOf(req));
  if (!view) return json({ error: "not_found" }, 404);
  const res = json(view);
  // 自分の診断に自分で答えられないよう、この端末にホストの印を付ける（ふつうの診断を作ったときと同じ cookie）。
  // 始めたのがほかの人の参加や操作でも、グループのページを開けば付く
  if (view.mine?.surveyId)
    setSurveyCookie(
      res,
      hostCookie(view.mine.surveyId),
      "1",
      view.mine.surveyId,
    );
  return res;
}
