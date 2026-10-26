// 4 軸・4 界隈・16 タイプの枠組み（仕様書 §2）。
import type { Axis, Pole } from "./questions";
import typesJson from "./types.json";

export interface AxisDef {
  axis: Axis;
  name: string;
  left: Pole;
  right: Pole;
}

export const AXES: AxisDef[] = [
  { axis: "A1", name: "エネルギー", left: "E", right: "I" },
  { axis: "A2", name: "ものの見方", left: "S", right: "N" },
  { axis: "A3", name: "判断", left: "T", right: "F" },
  { axis: "A4", name: "接し方", left: "J", right: "P" },
];

export const POLE_LABEL: Record<Pole, { name: string; nick: string }> = {
  E: { name: "外向", nick: "ワイワイ充電" },
  I: { name: "内向", nick: "ひとり充電" },
  S: { name: "現実", nick: "目の前のリアル" },
  N: { name: "直観", nick: "頭の中の可能性" },
  T: { name: "思考", nick: "ロジック優先" },
  F: { name: "感情", nick: "気持ち優先" },
  J: { name: "計画", nick: "きっちり段取り" },
  P: { name: "柔軟", nick: "その場のノリ" },
};

export type GroupId = "G1" | "G2" | "G3" | "G4";

export interface GroupDef {
  id: GroupId;
  name: string;
  line: string;
  // キャラクターなど飾りの色
  color: string;
  // 白い文字を載せる背景・明るい背景の上の文字に使う濃い色（コントラスト比 4.5:1 以上）
  ink: string;
  // 暗い背景の上の文字に使う明るい色（コントラスト比 4.5:1 以上）
  glow: string;
}

export const GROUPS: Record<GroupId, GroupDef> = {
  G1: {
    id: "G1",
    name: "考察界隈",
    line: "頭の中がいつもフル回転。仕組みと可能性が大好物",
    color: "#4C6FFF",
    ink: "#3B5BDB",
    glow: "#7D95FF",
  },
  G2: {
    id: "G2",
    name: "エモ界隈",
    line: "心の動きに敏感。人と意味を大事にする",
    color: "#FF5FA2",
    ink: "#C2255C",
    glow: "#FF5FA2",
  },
  G3: {
    id: "G3",
    name: "ちゃんと界隈",
    line: "約束と段取りの守り神。いてくれると安心",
    color: "#1FB57A",
    ink: "#0B7A53",
    glow: "#1FB57A",
  },
  G4: {
    id: "G4",
    name: "ノリ界隈",
    line: "今この瞬間を全力で楽しむ。行動が速い",
    color: "#FF8A1F",
    ink: "#A84F00",
    glow: "#FF8A1F",
  },
};

export const TYPE_CODES = [
  "INTJ",
  "INTP",
  "ENTJ",
  "ENTP",
  "INFJ",
  "INFP",
  "ENFJ",
  "ENFP",
  "ISTJ",
  "ISFJ",
  "ESTJ",
  "ESFJ",
  "ISTP",
  "ISFP",
  "ESTP",
  "ESFP",
] as const;

export type TypeCode = (typeof TYPE_CODES)[number];

export interface TypeDef {
  code: TypeCode;
  name: string;
  catch: string;
  tags: string[];
  friendView: string;
  strengths: { title: string; text: string }[];
  cautions: string[];
  aruaru: string[];
}

const RAW = typesJson as Record<TypeCode, Omit<TypeDef, "code">>;

export function getType(code: TypeCode): TypeDef {
  return { code, ...RAW[code] };
}

export function groupOf(code: string): GroupId {
  if (code[1] === "N") return code[2] === "T" ? "G1" : "G2";
  return code[3] === "J" ? "G3" : "G4";
}

const FLIP: Record<string, string> = {
  E: "I",
  I: "E",
  S: "N",
  N: "S",
  T: "F",
  F: "T",
  J: "P",
  P: "J",
};

function flipAt(code: string, idx: number[]): TypeCode {
  return code
    .split("")
    .map((c, i) => (idx.includes(i) ? FLIP[c] : c))
    .join("") as TypeCode;
}

// 相性（仕様書 §12 の末尾の決まり）。ラク＝1・4 文字目が逆、刺激＝2 文字目だけ同じ。
export function matchesOf(code: TypeCode): { easy: TypeCode; spark: TypeCode } {
  return { easy: flipAt(code, [0, 3]), spark: flipAt(code, [0, 2, 3]) };
}

export const RELATIONS = [
  { id: "friend", label: "友達" },
  { id: "school", label: "同じ学校・クラス" },
  { id: "work", label: "職場・バイト" },
  { id: "family", label: "家族" },
  { id: "partner", label: "恋人・パートナー" },
  { id: "other", label: "その他" },
] as const;

export type RelationId = (typeof RELATIONS)[number]["id"];

export function relationLabel(id: string): string {
  return RELATIONS.find((r) => r.id === id)?.label ?? "その他";
}
