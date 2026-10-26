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
npm run cf:build      # Cloudflare Workers 向けのビルド
```

CI（`.github/workflows/ci.yml`）では、上のすべてを行います（テストは PGlite と PostgreSQL 16 の両方で）。

## 公開のしかた（Cloudflare Workers）

Next.js を [OpenNext](https://opennext.js.org/cloudflare) で Cloudflare Workers 向けに変換して動かします。データは外部の PostgreSQL に置きます。

1. **PostgreSQL を用意する**（Neon・Supabase など）。表は最初の接続のときに自動で作られます（`src/lib/schema.ts`）。接続文字列は TLS を使う形（`sslmode=require`）にします
2. **Cloudflare の API トークンを作る**：Cloudflare のダッシュボード → My Profile → API Tokens → 「Edit Cloudflare Workers」のひな形で作る。あわせてアカウント ID を控える
3. **GitHub に登録する**（リポジトリの Settings → Secrets and variables → Actions）
   - シークレット：`CLOUDFLARE_API_TOKEN`・`CLOUDFLARE_ACCOUNT_ID`・`DATABASE_URL`・`CRON_SECRET`（十分に長い乱数）・`ADMIN_TOKEN`（運営者のページの合言葉。32 文字以上の乱数）
   - 変数：`NEXT_PUBLIC_SITE_URL`（公開するアドレス。`https://takoshin.daigakunote.com`）
   - 変数（任意）：`NEXT_PUBLIC_SUPPORT_URL`（結果の画面の「応援する」の行き先。外部の応援サービスの https のページ。なければ応援のお願いを出さない）
   - 独自ドメイン `takoshin.daigakunote.com` は `wrangler.jsonc` の `routes` で結び付ける。API トークンに、daigakunote.com の「Zone → Workers Routes → Edit」と「Zone → DNS → Edit」の権限が要る。`https://takoshin.<アカウントのサブドメイン>.workers.dev` もそのまま使える
4. **main に入れる**か、Actions の「Deploy」を手で動かすと、`.github/workflows/deploy.yml` がビルドして公開し、`DATABASE_URL`・`CRON_SECRET`・`ADMIN_TOKEN` を Workers のシークレットに登録します

- 1 日 1 回の定時処理（期限切れ・削除）は、`wrangler.jsonc` の Cron Trigger が `worker.ts` を通して `/api/cron/cleanup` を呼びます
- データベースへの接続には Cloudflare の Hyperdrive（接続の仲立ち）を使います。Deploy のたびに `scripts/hyperdrive.mjs` が設定 `takoshin-db` を作り（あれば接続先を `DATABASE_URL` に合わせ直し）、`wrangler.jsonc` に結び付けます。結果の使い回し（キャッシュ）は切っています（回答数などが古く見えないように）。Neon の「-pooler」付きの接続文字列は、直接つなぐ形に変えて使います
  - API トークンに「Hyperdrive の編集（Hyperdrive Edit）」の権限が要ります。なければ警告を出し、Hyperdrive なしで（`DATABASE_URL` で直接）公開します
  - 手元から公開するときは、`npx wrangler hyperdrive create takoshin-db --connection-string=… --caching-disabled` で作り、`wrangler.jsonc` の `hyperdrive` の行を書き換えます。公開のコマンドには、手元用の仮の接続文字列 `CLOUDFLARE_HYPERDRIVE_LOCAL_CONNECTION_STRING_HYPERDRIVE` が要ります（OpenNext が仮の環境を立ち上げるため。接続はしません）
- Worker はデータベースの近くで動かします（`wrangler.jsonc` の `placement`。Smart Placement）。どこで動かすかは、公開から 15 分ほどかけて Cloudflare が決めます
- 手元で Workers と同じ環境を試すには、`.dev.vars` に `DATABASE_URL` などを書いて `npm run cf:preview`
- 手元から公開するには、`npx wrangler login` のあと `npm run cf:deploy`

## 問い合わせと運営者のページ

- 利用者は `/contact` から問い合わせを送れます（データベースに保存し、180 日で自動的に消します）
- 運営者は `/admin` で `ADMIN_TOKEN` を入れると、問い合わせを読み、対応済みにし、報告された診断を消せます
  - 入ったあと「この端末を登録する」を押すと、次からはその端末の指紋・顔認証（パスキー）で入れます。パスキーはドメインごとなので、`takoshin.daigakunote.com` で登録します

## つくり

| 場所                                                 | 中身                                                                              |
| ---------------------------------------------------- | --------------------------------------------------------------------------------- |
| `src/data/`                                          | 32 問（場面ごとの言い方つき）・16 タイプの本文・4 軸と 4 界隈・禁止語             |
| `src/lib/scoring.ts`                                 | 判定の計算と分析の材料（仕様書 §6・§7）                                           |
| `src/lib/describe.ts`                                | 分析の文の組み立て                                                                |
| `src/lib/surveys.ts`                                 | 診断の作成・回答の受付・結果の確定（N 人目と同じトランザクションで 1 回だけ計算） |
| `src/lib/db.ts`                                      | PostgreSQL（pg）と PGlite の切り替え。Workers では問い合わせごとに接続する        |
| `worker.ts`・`wrangler.jsonc`・`open-next.config.ts` | Cloudflare Workers の入口と設定                                                   |
| `src/lib/image.tsx`                                  | シェア画像                                                                        |
| `src/app/`                                           | 画面と API                                                                        |
| `src/components/`                                    | 画面の部品（回答の画面・タコのキャラクター・結果のカードなど）                    |
| `tests/`                                             | テスト（仕様書 §14）                                                              |

## 注意

娯楽用のコンテンツで、心理検査ではありません。MBTI および Myers-Briggs Type Indicator は Myers & Briggs Foundation の登録商標です。
本サービスは MBTI®・日本MBTI協会・16Personalities とは関係ありません。公開前の確認事項は [docs/PRELAUNCH.md](docs/PRELAUNCH.md) にあります。
