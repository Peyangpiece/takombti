// 24 問（仕様書 §3.2・§3.3）。text の {name} はホストの呼び名に置き換える。
// pole は「そう思う」と答えたときに点が入る極。

export type Axis = "A1" | "A2" | "A3" | "A4";
export type Pole = "E" | "I" | "S" | "N" | "T" | "F" | "J" | "P";

export interface Question {
  no: number;
  axis: Axis;
  pole: Pole;
  text: string;
  selfText: string;
  summary: string;
}

export const QUESTIONS: Question[] = [
  {
    no: 1,
    axis: "A1",
    pole: "E",
    text: "{name}は、初対面の人がいても自分から話しかけにいく",
    selfText: "わたしは、初対面の人がいても自分から話しかけにいく",
    summary: "初対面でも自分から話しかける",
  },
  {
    no: 2,
    axis: "A2",
    pole: "S",
    text: "{name}は、話すときに具体的な出来事や数字を出して説明する",
    selfText: "わたしは、話すときに具体的な出来事や数字を出して説明する",
    summary: "具体的な出来事や数字で説明する",
  },
  {
    no: 3,
    axis: "A3",
    pole: "T",
    text: "{name}に相談すると、まず解決策や改善点を言ってくれる",
    selfText: "わたしは、相談されると、まず解決策や改善点を言う",
    summary: "相談するとまず解決策をくれる",
  },
  {
    no: 4,
    axis: "A4",
    pole: "J",
    text: "{name}は、遊びや旅行の予定を前もってきっちり立てる",
    selfText: "わたしは、遊びや旅行の予定を前もってきっちり立てる",
    summary: "予定を前もってきっちり立てる",
  },
  {
    no: 5,
    axis: "A1",
    pole: "I",
    text: "{name}は、大人数で遊んだあと、ひとりの時間をほしがっていそうだ",
    selfText: "わたしは、大人数で遊んだあと、ひとりの時間がほしくなる",
    summary: "大人数のあとはひとりの時間がほしい",
  },
  {
    no: 6,
    axis: "A2",
    pole: "N",
    text: "{name}は、「もし〜だったら」という妄想やたとえ話をよくする",
    selfText: "わたしは、「もし〜だったら」という妄想やたとえ話をよくする",
    summary: "「もし〜だったら」の妄想をよくする",
  },
  {
    no: 7,
    axis: "A3",
    pole: "F",
    text: "{name}に相談すると、まず気持ちに共感してくれる",
    selfText: "わたしは、相談されると、まず気持ちに共感する",
    summary: "相談するとまず共感してくれる",
  },
  {
    no: 8,
    axis: "A4",
    pole: "P",
    text: "{name}は、待ち合わせや締め切りがギリギリになりがちだ",
    selfText: "わたしは、待ち合わせや締め切りがギリギリになりがちだ",
    summary: "待ち合わせや締め切りがギリギリ",
  },
  {
    no: 9,
    axis: "A1",
    pole: "E",
    text: "{name}は、予定のない休日に、誰かを誘って出かけることが多い",
    selfText: "わたしは、予定のない休日に、誰かを誘って出かけることが多い",
    summary: "休日は誰かを誘って出かける",
  },
  {
    no: 10,
    axis: "A2",
    pole: "S",
    text: "{name}は、新しいやり方より、うまくいった実績のあるやり方を選びがちだ",
    selfText:
      "わたしは、新しいやり方より、うまくいった実績のあるやり方を選びがちだ",
    summary: "実績のあるやり方を選ぶ",
  },
  {
    no: 11,
    axis: "A3",
    pole: "T",
    text: "{name}は、相手が友達でも、おかしいと思えばはっきり指摘する",
    selfText: "わたしは、相手が友達でも、おかしいと思えばはっきり指摘する",
    summary: "友達にもはっきり指摘する",
  },
  {
    no: 12,
    axis: "A4",
    pole: "J",
    text: "{name}の部屋や持ち物は、いつも整っている",
    selfText: "わたしの部屋や持ち物は、いつも整っている",
    summary: "部屋や持ち物がいつも整っている",
  },
  {
    no: 13,
    axis: "A1",
    pole: "I",
    text: "{name}は、グループの中では話すより聞き役にまわることが多い",
    selfText: "わたしは、グループの中では話すより聞き役にまわることが多い",
    summary: "グループでは聞き役にまわる",
  },
  {
    no: 14,
    axis: "A2",
    pole: "N",
    text: "{name}の話は、よく思わぬ方向へ飛んで広がっていく",
    selfText: "わたしの話は、よく思わぬ方向へ飛んで広がっていく",
    summary: "話が思わぬ方向へ飛んでいく",
  },
  {
    no: 15,
    axis: "A3",
    pole: "F",
    text: "{name}は、誰かが傷つきそうなとき、本音より気づかいを優先する",
    selfText: "わたしは、誰かが傷つきそうなとき、本音より気づかいを優先する",
    summary: "本音より気づかいを優先する",
  },
  {
    no: 16,
    axis: "A4",
    pole: "P",
    text: "{name}は、その場のノリで予定を変えても平気だ",
    selfText: "わたしは、その場のノリで予定を変えても平気だ",
    summary: "ノリで予定を変えても平気",
  },
  {
    no: 17,
    axis: "A1",
    pole: "E",
    text: "{name}は、考えを口に出しながらまとめていくタイプだ",
    selfText: "わたしは、考えを口に出しながらまとめていくタイプだ",
    summary: "口に出しながら考えをまとめる",
  },
  {
    no: 18,
    axis: "A2",
    pole: "S",
    text: "{name}は、髪型や持ち物など、人の細かい変化によく気づく",
    selfText: "わたしは、髪型や持ち物など、人の細かい変化によく気づく",
    summary: "人の細かい変化によく気づく",
  },
  {
    no: 19,
    axis: "A3",
    pole: "T",
    text: "{name}は、何かを決めるとき、好き嫌いより理屈や効率で決める",
    selfText: "わたしは、何かを決めるとき、好き嫌いより理屈や効率で決める",
    summary: "理屈や効率で決める",
  },
  {
    no: 20,
    axis: "A4",
    pole: "J",
    text: "{name}は、やることやスケジュールをきちんと管理している",
    selfText: "わたしは、やることやスケジュールをきちんと管理している",
    summary: "スケジュールをきちんと管理している",
  },
  {
    no: 21,
    axis: "A1",
    pole: "I",
    text: "{name}は、仲良くなるまでに時間がかかるタイプだ",
    selfText: "わたしは、仲良くなるまでに時間がかかるタイプだ",
    summary: "仲良くなるまで時間がかかる",
  },
  {
    no: 22,
    axis: "A2",
    pole: "N",
    text: "{name}は、将来の夢や、まだ世の中にないものについて語るのが好きだ",
    selfText:
      "わたしは、将来の夢や、まだ世の中にないものについて語るのが好きだ",
    summary: "将来の夢やまだないものを語る",
  },
  {
    no: 23,
    axis: "A3",
    pole: "F",
    text: "{name}は、何かを決めるとき、みんなの気持ちを一番に考える",
    selfText: "わたしは、何かを決めるとき、みんなの気持ちを一番に考える",
    summary: "みんなの気持ちを一番に考える",
  },
  {
    no: 24,
    axis: "A4",
    pole: "P",
    text: "{name}は、興味が移りやすく、いろいろなことに手を出す",
    selfText: "わたしは、興味が移りやすく、いろいろなことに手を出す",
    summary: "いろいろなことに手を出す",
  },
];

export const QUESTION_COUNT = QUESTIONS.length;
