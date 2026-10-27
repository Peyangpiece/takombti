// 判定の計算（仕様書 §6）と、回答から作る分析の材料（§7.5〜7.7）。
// 計算はすべて整数で行い、「ちょうど半々」の判定が小数の誤差でずれないようにする。

import {
  CORE_ORDER,
  FOLLOW_ORDER,
  QUESTIONS,
  type Axis,
  type Pole,
} from "../data/questions";
import { AXES, type TypeCode } from "../data/framework";

export const ALGORITHM_VERSION = 2;
export const UNKNOWN = 0;
// 出していない深掘りの問（§3.5）
export const NOT_ASKED = -1;
export const MIN_ANSWERED_PER_AXIS = 3;
// 1 人の軸の点の目盛り。1 軸の問は最大 8 問なので、1〜8 のどれで割っても整数になる 840 を掛ける
const SCALE = 840;
// 1 人の軸の点の最大（1 問の点の最大 3 × SCALE）
export const MAX_RATER_SCORE = 3 * SCALE;

export type Strength = "ほぼ半々" | "やや" | "しっかり" | "振り切れ";
export type Agreement = "満場一致" | "ほぼ一致" | "多数派" | "意見が割れた";

export interface AxisResult {
  axis: Axis;
  pole: Pole;
  percent: number;
  strength: Strength;
  agreement: Agreement;
  tie: boolean;
  sum: number;
}

export type Insight =
  | { rule: "D1"; params: { pole: Pole; p: number; N: number } }
  | { rule: "D2"; params: { poles: Pole[]; N: number } }
  | { rule: "D3"; params: { pairs: [Pole, Pole][] } }
  | { rule: "D4"; params: { axes: Axis[] } }
  | { rule: "D5"; params: { no: number; answered: number; count: number } }
  | { rule: "D6"; params: { no: number; answered: number; count: number } }
  | { rule: "D7"; params: { no: number; count: number } }
  | { rule: "D8"; params: { items: { axis: Axis; pole: Pole }[] } };

export interface SelfAxis {
  axis: Axis;
  pole: Pole;
  percent: number;
  // 自分の点がちょうど 0（どちらとも言えない）か
  tie: boolean;
  // pole：極がちがう／stronger・weaker：同じ極で周りのほうが 20 ポイント以上強い・弱い
  // selfTie：自分はど真ん中だが、周りからは 70% 以上ハッキリ見えている／match：ほぼ一致
  gap: "pole" | "stronger" | "weaker" | "selfTie" | "match";
}

export interface SelfResult {
  type: TypeCode;
  axes: SelfAxis[];
  summary: "master" | "gap" | null;
}

// シェア画像に入れられる「自分で思うタイプ」（§4.12）。ど真ん中の軸があると 4 文字が決まりきらないので入れない
export function shareableSelfType(self: SelfResult | null): TypeCode | null {
  if (!self || self.axes.some((a) => a.tie)) return null;
  return self.type;
}

export interface RelationResult {
  relation: string;
  count: number;
  type: TypeCode;
}

export interface Result {
  algorithmVersion: number;
  n: number;
  type: TypeCode;
  axes: AxisResult[];
  insights: Insight[];
  self: SelfResult | null;
  relations: RelationResult[];
}

export interface ResponseInput {
  answers: number[];
  relation?: string | null;
}

const AXIS_QUESTIONS: Record<Axis, typeof QUESTIONS> = {
  A1: QUESTIONS.filter((q) => q.axis === "A1"),
  A2: QUESTIONS.filter((q) => q.axis === "A2"),
  A3: QUESTIONS.filter((q) => q.axis === "A3"),
  A4: QUESTIONS.filter((q) => q.axis === "A4"),
};

function leftPole(axis: Axis): Pole {
  return AXES.find((a) => a.axis === axis)!.left;
}

function rightPole(axis: Axis): Pole {
  return AXES.find((a) => a.axis === axis)!.right;
}

// §6.1：1 問の点。左の極（E・S・T・J）に寄るほど正。
function itemScore(no: number, answer: number): number {
  const q = QUESTIONS[no - 1];
  const v = answer - 4;
  return q.pole === leftPole(q.axis) ? v : -v;
}

// 1 から 7 で答えた問か（「わからない」と、出していない問を除く）
function isAnswered(a: number | undefined): a is number {
  return a !== undefined && a >= 1 && a <= 7;
}

// §6.2：1 人の軸の点（−2520〜+2520 の整数）。答えた問の平均 × 840。
// 答えた問が 3 問未満なら null。
export function raterAxisScore(answers: number[], axis: Axis): number | null {
  let sum = 0;
  let count = 0;
  for (const q of AXIS_QUESTIONS[axis]) {
    const a = answers[q.no - 1];
    if (!isAnswered(a)) continue;
    sum += itemScore(q.no, a);
    count += 1;
  }
  if (count < MIN_ANSWERED_PER_AXIS) return null;
  return (sum * SCALE) / count;
}

// §3.5：基本の問だけで見て、その軸を深掘りするか。
// 答えた基本の問が 3 問未満か、1 問あたりの点の平均が ±1 より小さい（半々に近い）とき
export function needsFollowUp(answers: (number | null)[], axis: Axis): boolean {
  let sum = 0;
  let count = 0;
  for (const q of AXIS_QUESTIONS[axis]) {
    if (q.stage !== "core") continue;
    const a = answers[q.no - 1];
    if (a === null || !isAnswered(a)) continue;
    sum += itemScore(q.no, a);
    count += 1;
  }
  return count < MIN_ANSWERED_PER_AXIS || Math.abs(sum) < count;
}

// §3.5：この人に出す問の番号の並び。基本の 16 問に答え終わるまでは基本の問だけ。
// 答え終わったら、深掘りする軸の問を後ろに足す（最大 32 問）。
// answers は問の番号順（null はまだ答えていない）
export function plannedQuestions(answers: (number | null)[]): number[] {
  const coreDone = CORE_ORDER.every((no) => answers[no - 1] != null);
  if (!coreDone) return [...CORE_ORDER];
  const deep = new Set(
    AXES.filter(({ axis }) => needsFollowUp(answers, axis)).map((a) => a.axis),
  );
  return [
    ...CORE_ORDER,
    ...FOLLOW_ORDER.filter((no) => deep.has(QUESTIONS[no - 1].axis)),
  ];
}

// 回答の形を確かめる。間違っていれば理由を返す。
// 基本の問はすべて答える。深掘りの問は、§3.5 の決まりで出す軸の問だけを答え、ほかは NOT_ASKED
export function validateAnswers(
  answers: unknown,
  { allowUnknown }: { allowUnknown: boolean },
): string | null {
  if (!Array.isArray(answers) || answers.length !== QUESTIONS.length) {
    return `answers must have ${QUESTIONS.length} items`;
  }
  for (const a of answers) {
    if (!Number.isInteger(a)) return "answers must be integers";
  }
  const list = answers as number[];
  for (const q of QUESTIONS) {
    const a = list[q.no - 1];
    const asked = q.stage === "core" || needsFollowUp(list, q.axis);
    if (!asked) {
      if (a !== NOT_ASKED) return `question ${q.no} must not be asked`;
      continue;
    }
    if (a === UNKNOWN && allowUnknown) continue;
    if (a < 1 || a > 7) return `question ${q.no} must be 1-7`;
  }
  for (const { axis } of AXES) {
    if (raterAxisScore(answers as number[], axis) === null) {
      return `axis ${axis} needs at least ${MIN_ANSWERED_PER_AXIS} answers`;
    }
  }
  return null;
}

// 判定できない軸（答えた問が 3 問未満）の一覧。画面で戻る先を案内するのに使う。
export function incompleteAxes(answers: number[]): Axis[] {
  return AXES.filter(({ axis }) => raterAxisScore(answers, axis) === null).map(
    (a) => a.axis,
  );
}

// 四捨五入（0 から遠いほうへ）。a / b を整数で丸める。b > 0。
function roundDiv(a: number, b: number): number {
  const q = Math.floor((2 * Math.abs(a) + b) / (2 * b));
  return a < 0 ? -q : q;
}

// §6.3：左の極の割合。X は合計、n は人数。50 + 平均 / 2520 × 50 = 50 + 5X / 252n。
export function leftPercent(sum: number, n: number): number {
  return 50 + roundDiv(5 * sum, 252 * n);
}

export function strengthOf(p: number): Strength {
  if (p >= 80) return "振り切れ";
  if (p >= 65) return "しっかり";
  if (p >= 55) return "やや";
  return "ほぼ半々";
}

function sign(x: number): number {
  return x > 0 ? 1 : x < 0 ? -1 : 0;
}

interface AxisContext {
  scores: number[];
  strongSum: number;
  selfScore: number | null;
}

// §6.3〜6.6：1 つの軸の判定。
function judgeAxis(axis: Axis, ctx: AxisContext): AxisResult {
  const n = ctx.scores.length;
  const sum = ctx.scores.reduce((a, b) => a + b, 0);
  let dir = sign(sum);
  const tie = dir === 0;
  if (tie) {
    // §6.4 の手順 1〜4
    const pos = ctx.scores.filter((x) => x > 0).length;
    const neg = ctx.scores.filter((x) => x < 0).length;
    dir = sign(pos - neg);
    if (dir === 0 && ctx.selfScore !== null) dir = sign(ctx.selfScore);
    if (dir === 0) dir = sign(ctx.strongSum);
    if (dir === 0) dir = -1;
  }
  const pole = dir > 0 ? leftPole(axis) : rightPole(axis);
  const lp = leftPercent(sum, n);
  const percent = dir > 0 ? lp : 100 - lp;
  const same = ctx.scores.filter((x) => sign(x) === dir).length;
  let agreement: Agreement;
  if (same === n) agreement = "満場一致";
  else if (same * 4 >= n * 3) agreement = "ほぼ一致";
  else if (same * 2 > n) agreement = "多数派";
  else agreement = "意見が割れた";
  return {
    axis,
    pole,
    percent,
    strength: strengthOf(percent),
    agreement,
    tie,
    sum,
  };
}

function strongSum(responses: ResponseInput[], axis: Axis): number {
  let total = 0;
  for (const r of responses) {
    for (const q of AXIS_QUESTIONS[axis]) {
      const a = r.answers[q.no - 1];
      if (!isAnswered(a)) continue;
      const s = itemScore(q.no, a);
      if (Math.abs(s) === 3) total += s;
    }
  }
  return total;
}

function judgeAll(
  responses: ResponseInput[],
  self: number[] | null,
): AxisResult[] {
  return AXES.map(({ axis }) =>
    judgeAxis(axis, {
      scores: responses.map((r) => raterAxisScore(r.answers, axis)!),
      strongSum: strongSum(responses, axis),
      selfScore: self ? raterAxisScore(self, axis) : null,
    }),
  );
}

function typeOf(axes: { pole: Pole }[]): TypeCode {
  return axes.map((a) => a.pole).join("") as TypeCode;
}

// 答えた友達 1 人の答えだけから見たタイプ（§4.8 のお礼の画面）。
// 端末の中だけで出し、送らない。ちょうど 0 の軸は、自己回答（§7.6）と同じく右の極にする
export function raterType(answers: number[]): TypeCode | null {
  const poles: { pole: Pole }[] = [];
  for (const { axis, left, right } of AXES) {
    const x = raterAxisScore(answers, axis);
    if (x === null) return null;
    poles.push({ pole: x > 0 ? left : right });
  }
  return typeOf(poles);
}

// a1/b1 > a2/b2 を整数で比べる（b は正）
function fracGreater(a1: number, b1: number, a2: number, b2: number): boolean {
  return a1 * b2 > a2 * b1;
}

const MIN_ASKED_FOR_ITEM = 3;

function itemInsights(responses: ResponseInput[]): Insight[] {
  let best5: { no: number; answered: number; count: number } | null = null;
  let best6: { no: number; answered: number; count: number } | null = null;
  let best7: { no: number; count: number } | null = null;
  for (const q of QUESTIONS) {
    // その問を出した人だけで数える。だれが答えたか分からないよう、出した人が 3 人以上の問だけ使う
    const vals = responses
      .map((r) => r.answers[q.no - 1])
      .filter((a) => a !== NOT_ASKED && a !== undefined);
    const asked = vals.length;
    if (asked < MIN_ASKED_FOR_ITEM) continue;
    const answered = vals.filter(isAnswered).length;
    const agree = vals.filter((a) => a >= 5).length;
    const disagree = vals.filter((a) => isAnswered(a) && a <= 3).length;
    const unknown = asked - answered;
    if (answered > 0 && agree * 3 >= answered * 2) {
      if (!best5 || fracGreater(agree, answered, best5.count, best5.answered)) {
        best5 = { no: q.no, answered, count: agree };
      }
    }
    if (answered > 0 && disagree * 3 >= answered * 2) {
      if (
        !best6 ||
        fracGreater(disagree, answered, best6.count, best6.answered)
      ) {
        best6 = { no: q.no, answered, count: disagree };
      }
    }
    if (unknown * 2 >= asked && unknown > 0) {
      if (!best7 || unknown > best7.count) best7 = { no: q.no, count: unknown };
    }
  }
  const out: Insight[] = [];
  if (best5) out.push({ rule: "D5", params: best5 });
  if (best6) out.push({ rule: "D6", params: best6 });
  if (best7) out.push({ rule: "D7", params: best7 });
  return out;
}

// §7.5：条件を満たすものを D1→D8 の順に、最大 6 つ。
function buildInsights(
  axes: AxisResult[],
  responses: ResponseInput[],
): Insight[] {
  const n = responses.length;
  const list: Insight[] = [];
  let strongest = axes[0];
  for (const a of axes) if (a.percent > strongest.percent) strongest = a;
  // どの軸もちょうど半々なら「いちばんハッキリ」はないので出さない（D3 で触れる）
  if (!strongest.tie) {
    list.push({
      rule: "D1",
      params: { pole: strongest.pole, p: strongest.percent, N: n },
    });
  }
  // 同じ規則に当たる軸が複数あれば、1 つの文にまとめる（同じ言い回しの繰り返しで枠を埋めないため）
  const unanimous = axes.filter((a) => a.agreement === "満場一致");
  if (unanimous.length > 0) {
    list.push({
      rule: "D2",
      params: { poles: unanimous.map((a) => a.pole), N: n },
    });
  }
  const ties = axes.filter((a) => a.tie);
  if (ties.length > 0) {
    list.push({
      rule: "D3",
      params: { pairs: ties.map((a) => [leftPole(a.axis), rightPole(a.axis)]) },
    });
  }
  const split: Axis[] = [];
  const decidedByStrength: { axis: Axis; pole: Pole }[] = [];
  for (const a of axes) {
    if (a.agreement !== "意見が割れた") continue;
    // 選ばれた極の人数が反対側の人数以下なのに合計で決まった軸は D8、それ以外は D4
    const scores = responses.map((r) => raterAxisScore(r.answers, a.axis)!);
    const dir = a.pole === leftPole(a.axis) ? 1 : -1;
    const same = scores.filter((x) => sign(x) === dir).length;
    const opposite = scores.filter((x) => sign(x) === -dir).length;
    // ど真ん中の軸は D3 で触れるので、D4 には入れない
    if (a.tie) continue;
    if (same <= opposite)
      decidedByStrength.push({ axis: a.axis, pole: a.pole });
    else split.push(a.axis);
  }
  if (split.length > 0) list.push({ rule: "D4", params: { axes: split } });
  const d8: Insight[] =
    decidedByStrength.length > 0
      ? [{ rule: "D8", params: { items: decidedByStrength } }]
      : [];
  list.push(...itemInsights(responses), ...d8);
  return list.slice(0, 6);
}

// §6.7・§7.6：自己回答。全員の点には入れない。
function buildSelf(self: number[], axes: AxisResult[]): SelfResult {
  const selfAxes: SelfAxis[] = axes.map((others) => {
    const x = raterAxisScore(self, others.axis)!;
    const dir = x > 0 ? 1 : -1; // ちょうど 0 は §6.4 の手順 4 と同じく右の極
    const pole = dir > 0 ? leftPole(others.axis) : rightPole(others.axis);
    const lp = leftPercent(x, 1);
    const percent = dir > 0 ? lp : 100 - lp;
    const tie = x === 0;
    let gap: SelfAxis["gap"];
    if (tie) gap = others.percent - 50 >= 20 ? "selfTie" : "match";
    else if (pole !== others.pole) gap = "pole";
    else if (Math.abs(others.percent - percent) >= 20) {
      gap = others.percent > percent ? "stronger" : "weaker";
    } else gap = "match";
    return { axis: others.axis, pole, percent, tie, gap };
  });
  const poleGaps = selfAxes.filter((a) => a.gap === "pole").length;
  let summary: SelfResult["summary"] = null;
  if (selfAxes.every((a) => a.gap === "match")) summary = "master";
  else if (poleGaps >= 2) summary = "gap";
  return { type: typeOf(selfAxes), axes: selfAxes, summary };
}

// §7.7：同じ関係が 3 人以上の関係が 2 つ以上あるときだけ。
function buildRelations(
  responses: ResponseInput[],
  self: number[] | null,
): RelationResult[] {
  const groups = new Map<string, ResponseInput[]>();
  for (const r of responses) {
    if (!r.relation) continue;
    const list = groups.get(r.relation) ?? [];
    list.push(r);
    groups.set(r.relation, list);
  }
  const big = [...groups.entries()].filter(([, list]) => list.length >= 3);
  if (big.length < 2) return [];
  return big.map(([relation, list]) => ({
    relation,
    count: list.length,
    type: typeOf(judgeAll(list, self)),
  }));
}

export function computeResult(
  responses: ResponseInput[],
  self: number[] | null,
): Result {
  if (responses.length === 0) throw new Error("no responses");
  const axes = judgeAll(responses, self);
  return {
    algorithmVersion: ALGORITHM_VERSION,
    n: responses.length,
    type: typeOf(axes),
    axes,
    insights: buildInsights(axes, responses),
    self: self ? buildSelf(self, axes) : null,
    relations: buildRelations(responses, self),
  };
}
