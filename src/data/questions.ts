// 質問（仕様書 §3）。32 問のうち、一人が答えるのはふつう基本の 16 問。
// - 基本の 16 問（stage: "core"）は全員が答える。各軸 4 問、両方の極に 2 問ずつ
// - 深掘りの 16 問（stage: "follow"）は、基本の答えが半々に近い軸で、答える人が「もっと答える」を選んだときと、
//   「わからない」が多くて基本の問だけでは判定できない軸に出す（§3.5）。
//   各軸 4 問、両方の極に 2 問ずつ。基本の問より具体的な場面で聞く
// - 文は、最初に選んだ「関係」に合う場面の言い方に差し替える（scenes）。合うものがなければ text を使う
// text の {name} はホストの呼び名に置き換える。pole は「そう思う」と答えたときに点が入る極。

export type Axis = "A1" | "A2" | "A3" | "A4";
export type Pole = "E" | "I" | "S" | "N" | "T" | "F" | "J" | "P";
export type Stage = "core" | "follow";
// 場面：友達（同じ学校・クラスも含む）・職場・家族・恋人。どれでもなければ "general"
export type Scene = "general" | "friend" | "work" | "family" | "partner";
// 「そう思う」と言われたときの受け取られ方（§3.2）。positive：長所として受け取られやすい／
// negative：本人が気にしやすい・直したいと思われやすい／neutral：どちらでもない。
// ジョハリの窓（盲点の窓）で、「長所かも」と言ってよいかを決めるのに使う
export type Tone = "positive" | "neutral" | "negative";

export const QUESTION_VERSION = 2;

// 回答にかかる時間の目安（基本の 16 問で約 3 分。1 問 11 秒で数えた値）。
// 深掘りの問は答える人が選んだときだけ出すので（§3.5）、目安には入れない。
// 回答にかかった時間の計測（§11.11 の answer_time）を見て見直す。計測の裏付けなく短くしない
export const ANSWER_TIME_LABEL = "約 3 分";

export interface Question {
  no: number;
  axis: Axis;
  pole: Pole;
  stage: Stage;
  text: string;
  scenes?: Partial<Record<Exclude<Scene, "general">, string>>;
  selfText: string;
  summary: string;
  tone: Tone;
}

export const QUESTIONS: Question[] = [
  // ---------- A1 エネルギー（外向 E ／ 内向 I） ----------
  {
    no: 1,
    axis: "A1",
    pole: "E",
    stage: "core",
    text: "{name}は、初対面の人にも自分から話しかけにいく",
    scenes: {
      work: "{name}は、新しく入った人や初めて会う取引先にも、自分から話しかけにいく",
      family:
        "{name}は、親戚の集まりなどで、初めて会う人にも自分から話しかけにいく",
    },
    selfText: "わたしは、初対面の人にも自分から話しかけにいく",
    summary: "初対面の人にも自分から話しかける",
    tone: "positive",
  },
  {
    no: 2,
    axis: "A1",
    pole: "I",
    stage: "core",
    text: "{name}は、大人数で集まったあとは、ひとりで静かに過ごすことが多い",
    scenes: {
      friend: "{name}は、大人数で遊んだあとは、ひとりで静かに過ごすことが多い",
      work: "{name}は、飲み会や大人数の打ち合わせのあとは、ひとりで静かに過ごすことが多い",
      family:
        "{name}は、親戚の集まりなどのあとは、ひとりで静かに過ごすことが多い",
      partner: "{name}は、大人数で遊んだあとは、ひとりで静かに過ごすことが多い",
    },
    selfText:
      "わたしは、大人数で集まったあとは、ひとりで静かに過ごすことが多い",
    summary: "大人数のあとはひとりで静かに過ごす",
    tone: "neutral",
  },
  {
    no: 3,
    axis: "A1",
    pole: "E",
    stage: "core",
    text: "{name}は、予定のない日に、誰かを誘って出かけることが多い",
    scenes: {
      work: "{name}は、休憩時間は、誰かと話して過ごすことが多い",
      family:
        "{name}は、家にいるとき、家族のいる部屋に来て話しかけることが多い",
      partner:
        "{name}は、予定のない日に、どこかへ出かけようと誘ってくることが多い",
    },
    selfText: "わたしは、予定のない日に、誰かを誘って出かけることが多い",
    summary: "予定のない日は誰かを誘って出かける",
    tone: "neutral",
  },
  {
    no: 4,
    axis: "A1",
    pole: "I",
    stage: "core",
    text: "{name}は、何人かで集まると、話すより聞き役にまわることが多い",
    scenes: {
      work: "{name}は、会議では、自分から話すより聞いていることが多い",
      family: "{name}は、家族の会話では、自分から話すより聞いていることが多い",
    },
    selfText: "わたしは、何人かで集まると、話すより聞き役にまわることが多い",
    summary: "何人かで集まると聞き役にまわる",
    tone: "neutral",
  },
  {
    no: 5,
    axis: "A1",
    pole: "E",
    stage: "follow",
    text: "{name}は、うれしいことがあると、すぐ誰かに話す",
    scenes: {
      work: "{name}は、仕事でうまくいったことがあると、すぐ周りに話す",
    },
    selfText: "わたしは、うれしいことがあると、すぐ誰かに話す",
    summary: "うれしいことはすぐ誰かに話す",
    tone: "neutral",
  },
  {
    no: 6,
    axis: "A1",
    pole: "I",
    stage: "follow",
    text: "{name}は、電話より、LINE などの文字でやりとりすることが多い",
    scenes: {
      work: "{name}は、口で話すより、チャットやメールでやりとりすることが多い",
    },
    selfText: "わたしは、電話より、LINE などの文字でやりとりすることが多い",
    summary: "電話より文字でやりとりする",
    tone: "neutral",
  },
  {
    no: 7,
    axis: "A1",
    pole: "E",
    stage: "follow",
    text: "{name}は、話しながら考えをまとめていく",
    scenes: {
      work: "{name}は、打ち合わせで、話しながら考えをまとめていく",
    },
    selfText: "わたしは、話しながら考えをまとめていく",
    summary: "話しながら考えをまとめる",
    tone: "neutral",
  },
  {
    no: 8,
    axis: "A1",
    pole: "I",
    stage: "follow",
    text: "{name}は、新しく知り合った人と打ち解けるまでに時間がかかる",
    scenes: {
      work: "{name}は、新しく来た人や初めて組む人と打ち解けるまでに時間がかかる",
      family:
        "{name}は、親戚や家族の知り合いなど、新しく知り合った人と打ち解けるまでに時間がかかる",
    },
    selfText: "わたしは、新しく知り合った人と打ち解けるまでに時間がかかる",
    summary: "打ち解けるまで時間がかかる",
    tone: "neutral",
  },

  // ---------- A2 ものの見方（現実 S ／ 直観 N） ----------
  {
    no: 9,
    axis: "A2",
    pole: "S",
    stage: "core",
    text: "{name}は、話すときに具体的な出来事や数字を出して説明する",
    scenes: {
      work: "{name}は、報告や説明のとき、具体的な数字や事実をもとに話す",
    },
    selfText: "わたしは、話すときに具体的な出来事や数字を出して説明する",
    summary: "具体的な出来事や数字で説明する",
    tone: "positive",
  },
  {
    no: 10,
    axis: "A2",
    pole: "N",
    stage: "core",
    text: "{name}は、「もし〜だったら」という想像の話やたとえ話をよくする",
    scenes: {
      work: "{name}は、仕事の話でも「もし〜だったら」と、先のことや別の可能性を想像して話す",
    },
    selfText: "わたしは、「もし〜だったら」という想像の話やたとえ話をよくする",
    summary: "「もし〜だったら」の話をよくする",
    tone: "neutral",
  },
  {
    no: 11,
    axis: "A2",
    pole: "S",
    stage: "core",
    text: "{name}は、新しいやり方より、慣れたやり方を選びがちだ",
    scenes: {
      work: "{name}は、仕事では、新しいやり方より、慣れた手順を選びがちだ",
      family:
        "{name}は、料理や家事では、新しいやり方より、いつものやり方を選びがちだ",
      partner: "{name}は、デートでは、新しい店より行き慣れた店を選びがちだ",
    },
    selfText: "わたしは、新しいやり方より、慣れたやり方を選びがちだ",
    summary: "慣れたやり方を選ぶ",
    tone: "neutral",
  },
  {
    no: 12,
    axis: "A2",
    pole: "N",
    stage: "core",
    text: "{name}は、将来の夢や、まだ世の中にないものについてよく語る",
    scenes: {
      work: "{name}は、まだ誰もやっていない企画や、仕事の将来像についてよく語る",
      partner: "{name}は、二人の将来や、いつかやってみたいことをよく語る",
    },
    selfText: "わたしは、将来の夢や、まだ世の中にないものについてよく語る",
    summary: "将来の夢やまだないものを語る",
    tone: "neutral",
  },
  {
    no: 13,
    axis: "A2",
    pole: "S",
    stage: "follow",
    text: "{name}は、髪型や持ち物など、人の細かい変化によく気づく",
    scenes: {
      work: "{name}は、資料の細かい間違いや、職場のちょっとした変化によく気づく",
      family: "{name}は、家の中の物の置き場所が変わると、すぐ気づく",
    },
    selfText: "わたしは、髪型や持ち物など、人の細かい変化によく気づく",
    summary: "人の細かい変化によく気づく",
    tone: "positive",
  },
  {
    no: 14,
    axis: "A2",
    pole: "N",
    stage: "follow",
    text: "{name}の話は、よく思わぬ方向へ広がっていく",
    scenes: {
      work: "{name}の話は、打ち合わせ中でも、よく思わぬ方向へ広がっていく",
    },
    selfText: "わたしの話は、よく思わぬ方向へ広がっていく",
    summary: "話が思わぬ方向へ広がっていく",
    tone: "neutral",
  },
  {
    no: 15,
    axis: "A2",
    pole: "S",
    stage: "follow",
    text: "{name}は、説明書やレシピがあれば、そのとおりに進める",
    scenes: {
      work: "{name}は、マニュアルや決まった手順があれば、そのとおりに進める",
    },
    selfText: "わたしは、説明書やレシピがあれば、そのとおりに進める",
    summary: "説明書やレシピのとおりに進める",
    tone: "neutral",
  },
  {
    no: 16,
    axis: "A2",
    pole: "N",
    stage: "follow",
    text: "{name}は、「そもそもなぜ？」と、物事の理由や仕組みまで知ろうとする",
    scenes: {
      work: "{name}は、仕事の進め方について「そもそもなぜこうするの？」と理由まで知ろうとする",
    },
    selfText:
      "わたしは、「そもそもなぜ？」と、物事の理由や仕組みまで知ろうとする",
    summary: "「そもそもなぜ？」と理由まで知ろうとする",
    tone: "positive",
  },

  // ---------- A3 判断のしかた（思考 T ／ 感情 F） ----------
  {
    no: 17,
    axis: "A3",
    pole: "T",
    stage: "core",
    text: "{name}に相談すると、まず解決策や改善点を言ってくれる",
    scenes: {
      work: "{name}に仕事の相談をすると、まず解決策や改善点を示してくれる",
      family: "{name}に悩みを話すと、まず、どうすればいいかを言ってくれる",
      partner: "{name}に悩みを話すと、まず、どうすればいいかを言ってくれる",
    },
    selfText: "わたしは、相談されると、まず解決策や改善点を言う",
    summary: "相談するとまず解決策をくれる",
    tone: "positive",
  },
  {
    no: 18,
    axis: "A3",
    pole: "F",
    stage: "core",
    text: "{name}に相談すると、まず気持ちに共感してくれる",
    scenes: {
      work: "{name}に仕事の悩みを話すと、まず「大変だったね」と気持ちを受け止めてくれる",
    },
    selfText: "わたしは、相談されると、まず相手の気持ちに共感する",
    summary: "相談するとまず共感してくれる",
    tone: "positive",
  },
  {
    no: 19,
    axis: "A3",
    pole: "T",
    stage: "core",
    text: "{name}は、相手が親しい人でも、おかしいと思えばはっきり指摘する",
    scenes: {
      friend: "{name}は、相手が友達でも、おかしいと思えばはっきり指摘する",
      work: "{name}は、相手が先輩や上司でも、おかしいと思えばはっきり意見を言う",
      family: "{name}は、家族に対しても、おかしいと思えばはっきり言う",
      partner: "{name}は、恋人に対しても、おかしいと思えばはっきり言う",
    },
    selfText: "わたしは、相手が親しい人でも、おかしいと思えばはっきり指摘する",
    summary: "親しい人にもはっきり指摘する",
    tone: "neutral",
  },
  {
    no: 20,
    axis: "A3",
    pole: "F",
    stage: "core",
    text: "{name}は、何かを決めるとき、みんなの気持ちを一番に考える",
    scenes: {
      work: "{name}は、チームで何かを決めるとき、メンバーの気持ちや関係を一番に考える",
      family:
        "{name}は、家族で何かを決めるとき、みんなが納得しているかを一番に気にする",
      partner: "{name}は、二人で何かを決めるとき、相手の気持ちを一番に考える",
    },
    selfText: "わたしは、何かを決めるとき、みんなの気持ちを一番に考える",
    summary: "みんなの気持ちを一番に考える",
    tone: "positive",
  },
  {
    no: 21,
    axis: "A3",
    pole: "T",
    stage: "follow",
    text: "{name}は、映画やドラマを見ると、話の筋や設定のおかしな点をよく指摘する",
    scenes: {
      work: "{name}は、企画や資料の筋が通っていないところを、よく見つけて指摘する",
    },
    selfText:
      "わたしは、映画やドラマを見ると、話の筋や設定のおかしな点をよく指摘する",
    summary: "話の筋のおかしな点をよく指摘する",
    tone: "neutral",
  },
  {
    no: 22,
    axis: "A3",
    pole: "F",
    stage: "follow",
    text: "{name}は、誰かが傷つきそうなときは、本音を言うより気づかいを優先する",
    scenes: {
      work: "{name}は、相手が落ちこみそうなときは、指摘より気づかいを優先する",
    },
    selfText:
      "わたしは、誰かが傷つきそうなときは、本音を言うより気づかいを優先する",
    summary: "本音より気づかいを優先する",
    tone: "neutral",
  },
  {
    no: 23,
    axis: "A3",
    pole: "T",
    stage: "follow",
    text: "{name}は、何かを選ぶとき、好き嫌いより理屈や効率で決める",
    scenes: {
      partner: "{name}は、二人の予定や買い物を、気分より理屈や効率で決める",
    },
    selfText: "わたしは、何かを選ぶとき、好き嫌いより理屈や効率で決める",
    summary: "理屈や効率で決める",
    tone: "neutral",
  },
  {
    no: 24,
    axis: "A3",
    pole: "F",
    stage: "follow",
    text: "{name}は、人に喜んでもらうために、進んで手間をかける",
    scenes: {
      work: "{name}は、仕事で、相手に喜んでもらうために、進んで手間をかける",
    },
    selfText: "わたしは、人に喜んでもらうために、進んで手間をかける",
    summary: "人に喜んでもらうために手間をかける",
    tone: "neutral",
  },

  // ---------- A4 接し方（計画 J ／ 柔軟 P） ----------
  {
    no: 25,
    axis: "A4",
    pole: "J",
    stage: "core",
    text: "{name}は、遊びや旅行の予定を前もってきっちり立てる",
    scenes: {
      work: "{name}は、仕事の段取りを前もって決め、計画どおりに進める",
      family: "{name}は、家族の旅行や行事の予定を、早めにきっちり決める",
      partner: "{name}は、デートや旅行の予定を前もってきっちり立てる",
    },
    selfText: "わたしは、遊びや旅行の予定を前もってきっちり立てる",
    summary: "予定を前もってきっちり立てる",
    tone: "positive",
  },
  {
    no: 26,
    axis: "A4",
    pole: "P",
    stage: "core",
    text: "{name}は、待ち合わせや締め切りがギリギリになりがちだ",
    scenes: {
      work: "{name}は、締め切りの直前に一気に仕上げることが多い",
      family: "{name}は、出かける時間になってから、あわてて準備を始めがちだ",
    },
    selfText: "わたしは、待ち合わせや締め切りがギリギリになりがちだ",
    summary: "待ち合わせや締め切りがギリギリ",
    tone: "negative",
  },
  {
    no: 27,
    axis: "A4",
    pole: "J",
    stage: "core",
    text: "{name}の部屋やかばんの中は、いつも片づいている",
    scenes: {
      work: "{name}の机やファイルは、いつも整理されている",
    },
    selfText: "わたしの部屋やかばんの中は、いつも片づいている",
    summary: "部屋やかばんの中がいつも片づいている",
    tone: "positive",
  },
  {
    no: 28,
    axis: "A4",
    pole: "P",
    stage: "core",
    text: "{name}は、その場のノリで予定を変えることが多い",
    scenes: {
      work: "{name}は、仕事でも、その場の流れに合わせて段取りを変えることが多い",
    },
    selfText: "わたしは、その場のノリで予定を変えることが多い",
    summary: "その場のノリで予定を変える",
    tone: "neutral",
  },
  {
    no: 29,
    axis: "A4",
    pole: "J",
    stage: "follow",
    text: "{name}は、やることをリストや予定表で管理している",
    scenes: {
      work: "{name}は、仕事のタスクをリストや予定表できちんと管理している",
    },
    selfText: "わたしは、やることをリストや予定表で管理している",
    summary: "やることをリストで管理している",
    tone: "positive",
  },
  {
    no: 30,
    axis: "A4",
    pole: "P",
    stage: "follow",
    text: "{name}は、気になったことに次々と手を出す",
    selfText: "わたしは、気になったことに次々と手を出す",
    summary: "気になったことに次々と手を出す",
    tone: "neutral",
  },
  {
    no: 31,
    axis: "A4",
    pole: "J",
    stage: "follow",
    text: "{name}は、買い物では、何を買うか決めてから店に行く",
    scenes: {
      work: "{name}は、打ち合わせの前に、話すことや決めることをまとめておく",
    },
    selfText: "わたしは、買い物では、何を買うか決めてから店に行く",
    summary: "買うものを決めてから店に行く",
    tone: "neutral",
  },
  {
    no: 32,
    axis: "A4",
    pole: "P",
    stage: "follow",
    text: "{name}は、細かく決める前に「とりあえずやってみよう」と動き出す",
    scenes: {
      work: "{name}は、仕事でも、計画を固める前に「とりあえずやってみよう」と動き出す",
    },
    selfText: "わたしは、細かく決める前に「とりあえずやってみよう」と動き出す",
    summary: "「とりあえずやってみよう」と動き出す",
    tone: "neutral",
  },
];

// 基本の問を出す順。4 つの軸を順に回し、極も交互にする
export const CORE_ORDER = [
  1, 9, 17, 25, 2, 10, 18, 26, 3, 11, 19, 27, 4, 12, 20, 28,
];
// 深掘りの問を出す順（深掘りする軸の問だけを、この順で出す）
export const FOLLOW_ORDER = [
  5, 13, 21, 29, 6, 14, 22, 30, 7, 15, 23, 31, 8, 16, 24, 32,
];

// 関係（RELATIONS の id）から場面を決める
export function sceneOf(relation: string | null | undefined): Scene {
  switch (relation) {
    case "friend":
    case "school":
      return "friend";
    case "work":
      return "work";
    case "family":
      return "family";
    case "partner":
      return "partner";
    default:
      return "general";
  }
}

// 回答者向けの文（場面に合う言い方があればそれ）
export function questionText(q: Question, scene: Scene): string {
  if (scene === "general") return q.text;
  return q.scenes?.[scene] ?? q.text;
}

// 1 版（24 問）の要約。1 版で出した結果の分析の文に使う
export const SUMMARIES_V1 = [
  "初対面でも自分から話しかける",
  "具体的な出来事や数字で説明する",
  "相談するとまず解決策をくれる",
  "予定を前もってきっちり立てる",
  "大人数のあとはひとりの時間がほしい",
  "「もし〜だったら」の妄想をよくする",
  "相談するとまず共感してくれる",
  "待ち合わせや締め切りがギリギリ",
  "休日は誰かを誘って出かける",
  "実績のあるやり方を選ぶ",
  "友達にもはっきり指摘する",
  "部屋や持ち物がいつも整っている",
  "グループでは聞き役にまわる",
  "話が思わぬ方向へ飛んでいく",
  "本音より気づかいを優先する",
  "ノリで予定を変えても平気",
  "口に出しながら考えをまとめる",
  "人の細かい変化によく気づく",
  "理屈や効率で決める",
  "スケジュールをきちんと管理している",
  "仲良くなるまで時間がかかる",
  "将来の夢やまだないものを語る",
  "みんなの気持ちを一番に考える",
  "いろいろなことに手を出す",
];
