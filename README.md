# たこ診

友達が答える16タイプ診断のウェブアプリ。ホストが人数を決めてリンクを送り、その人数の友達が答え終わった時点で、
「周りから見たあなた」の 16 タイプと分析を出します。

- 仕様書：[docs/SPEC.md](docs/SPEC.md)

## 動かし方（手元）

Node.js 22 以上が必要です。

```sh
npm install
npm run dev
```

`http://localhost:3000` を開きます。`DATABASE_URL` を設定しなければ、`.data/pglite` に組み込みの PostgreSQL（PGlite）を作って動きます。

## 確かめ方

```sh
npm test              # テスト（PGlite）
DATABASE_URL=postgres://… npm test   # 本物の PostgreSQL でテスト
npm run lint          # lint
npm run typecheck     # 型
npm run format:check  # 整形（直すには npm run format）
npm run build         # ビルド
```

CI（`.github/workflows/ci.yml`）では、上のすべてを PGlite と PostgreSQL 16 の両方で行います。

## 公開のしかた（Vercel ＋ PostgreSQL の例）

1. PostgreSQL を用意する（Supabase・Neon など）。表は最初の接続のときに自動で作られます（`src/lib/schema.ts`）
2. Vercel にこのリポジトリをつなぎ、環境変数を設定する（`.env.example` を参照）
   - `DATABASE_URL`：PostgreSQL の接続文字列
   - `NEXT_PUBLIC_SITE_URL`：公開するアドレス（例：`https://takoshin.example`）。リンクの見出し画像に使う
   - `CRON_SECRET`：十分に長い乱数。1 日 1 回の定時処理（期限切れ・削除）を守る
3. 定時処理は `vercel.json` の `crons` で毎日 1 回 `/api/cron/cleanup` を呼びます

本番で `DATABASE_URL` を設定しないと、データがサーバーの一時的な場所に置かれて消えるので、必ず設定してください。

## つくり

| 場所                  | 中身                                                                              |
| --------------------- | --------------------------------------------------------------------------------- |
| `src/data/`           | 24 問・16 タイプの本文・4 軸と 4 界隈・禁止語                                     |
| `src/lib/scoring.ts`  | 判定の計算と分析の材料（仕様書 §6・§7）                                           |
| `src/lib/describe.ts` | 分析の文の組み立て                                                                |
| `src/lib/surveys.ts`  | 診断の作成・回答の受付・結果の確定（N 人目と同じトランザクションで 1 回だけ計算） |
| `src/lib/db.ts`       | PostgreSQL（pg）と PGlite の切り替え                                              |
| `src/lib/image.tsx`   | シェア画像                                                                        |
| `src/app/`            | 画面と API                                                                        |
| `src/components/`     | 画面の部品（回答の画面・タコのキャラクター・結果のカードなど）                    |
| `tests/`              | テスト（仕様書 §14）                                                              |

## 注意

娯楽用のコンテンツで、心理検査ではありません。MBTI は The Myers-Briggs Company の登録商標です。
本サービスは同社および 16Personalities とは関係ありません。公開前の確認事項は仕様書 §13 にあります。
