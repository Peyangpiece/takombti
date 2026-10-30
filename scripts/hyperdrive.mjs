// 公開の前に、Cloudflare の Hyperdrive（データベース接続の仲立ち）の設定を用意し、
// wrangler.jsonc に結び付けを書き込む。GitHub Actions の Deploy から呼ぶ。
//
// - 設定の名前は takoshin-db。なければ作り、あれば接続先を DATABASE_URL に合わせ直す
// - 結果の使い回し（キャッシュ）は切る。回答数や締め切りの状態が最大 60 秒古く見えるのを防ぐため
// - Neon の接続文字列が「-pooler」付き（接続の取りまとめ役を通す形）なら、直接つなぐ形に変える。
//   Hyperdrive 自身が接続を取りまとめるので、直接つなぐのが推奨されている
// - API トークンに Hyperdrive の権限がないなどで失敗したら、警告だけ出して終わる。
//   そのときは Hyperdrive なしで（DATABASE_URL で直接）公開する。
//   ただし、前から Hyperdrive を使っていた（公開中の Worker に結び付けがある、または wrangler.jsonc に
//   結び付けが書いてある）なら、失敗にして公開を止める（黙って Hyperdrive なしに戻ると、接続が遅くなり、
//   接続の数の上限にも当たりやすくなるため）
//
// 接続文字列やパスワードは表示しない。

import { readFileSync, writeFileSync } from "node:fs";

const NAME = "takoshin-db";
const CONFIG = "wrangler.jsonc";
const { CLOUDFLARE_API_TOKEN: token, CLOUDFLARE_ACCOUNT_ID: account } =
  process.env;
const databaseUrl = process.env.DATABASE_URL;

function warn(message) {
  console.log(`::warning::${message}`);
}

export function originFrom(url) {
  const u = new URL(url);
  if (!u.protocol.startsWith("postgres"))
    throw new Error("postgres の接続文字列ではない");
  return {
    scheme: "postgres",
    host: u.hostname.replace(/-pooler\./, "."),
    port: u.port ? Number(u.port) : 5432,
    database: decodeURIComponent(u.pathname.replace(/^\//, "")),
    user: decodeURIComponent(u.username),
    password: decodeURIComponent(u.password),
  };
}

// wrangler.jsonc の hyperdrive の行（注釈にしたもの、または書き換えたもの）
const HYPERDRIVE_LINE = /^[ \t]*(\/\/ *)?"hyperdrive":.*$/m;

export function bindHyperdrive(config, id) {
  const line = `  "hyperdrive": [{ "binding": "HYPERDRIVE", "id": "${id}" }],`;
  if (!HYPERDRIVE_LINE.test(config))
    throw new Error(`${CONFIG} に hyperdrive の行が見つからない`);
  return config.replace(HYPERDRIVE_LINE, line);
}

// wrangler.jsonc に、注釈ではない hyperdrive の結び付けがあるか
export function configHasBinding(config) {
  return /^[ \t]*"hyperdrive":/m.test(config);
}

// 公開中の Worker の結び付け（Workers の設定の API の bindings）に Hyperdrive があるか
export function bindingsHaveHyperdrive(bindings) {
  return (bindings ?? []).some((b) => b?.type === "hyperdrive");
}

// 前から Hyperdrive を使っていたか。確かめられないとき（API の失敗）は、使っていたものとして扱う
async function previouslyBound(config) {
  if (configHasBinding(config)) return true;
  const name = /"name":\s*"([^"]+)"/.exec(config)?.[1];
  if (!name || !token || !account) return false;
  try {
    const res = await fetch(
      `https://api.cloudflare.com/client/v4/accounts/${account}/workers/scripts/${name}/settings`,
      { headers: { Authorization: `Bearer ${token}` } },
    );
    // まだ一度も公開していない
    if (res.status === 404) return false;
    const data = await res.json().catch(() => ({}));
    if (!res.ok || !data.success) return true;
    return bindingsHaveHyperdrive(data.result?.bindings);
  } catch {
    return true;
  }
}

// 前から使っていたら失敗にし、そうでなければ警告して Hyperdrive なしで続ける
async function giveUp(config, message) {
  if (await previouslyBound(config)) {
    console.log(
      `::error::${message}。前から Hyperdrive を使っているので、Hyperdrive なしでは公開しません`,
    );
    process.exit(1);
  }
  warn(`${message}。Hyperdrive を使わずに公開します`);
}

async function api(method, path, body) {
  const res = await fetch(
    `https://api.cloudflare.com/client/v4/accounts/${account}/hyperdrive/configs${path}`,
    {
      method,
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: body ? JSON.stringify(body) : undefined,
    },
  );
  const data = await res.json().catch(() => ({}));
  if (!res.ok || !data.success) {
    const detail = (data.errors ?? [])
      .map((e) => `${e.code} ${e.message}`)
      .join(" / ");
    throw new Error(`${method} ${res.status} ${detail}`);
  }
  return data.result;
}

async function main() {
  const config = readFileSync(CONFIG, "utf8");
  if (!token || !account || !databaseUrl) {
    await giveUp(
      config,
      "CLOUDFLARE_API_TOKEN・CLOUDFLARE_ACCOUNT_ID・DATABASE_URL のどれかがありません",
    );
    return;
  }
  let id;
  try {
    const body = {
      name: NAME,
      origin: originFrom(databaseUrl),
      caching: { disabled: true },
    };
    const existing = (await api("GET", "")).find((c) => c.name === NAME);
    id = existing
      ? (await api("PATCH", `/${existing.id}`, body)).id
      : (await api("POST", "", body)).id;
    console.log(
      existing
        ? "Hyperdrive の設定を更新しました"
        : "Hyperdrive の設定を作りました",
    );
  } catch (e) {
    await giveUp(
      config,
      `Hyperdrive を用意できませんでした（${e.message}）。` +
        "API トークンに「Hyperdrive の編集（Hyperdrive Edit）」の権限があるか確かめてください",
    );
    return;
  }
  writeFileSync(CONFIG, bindHyperdrive(config, id));
  console.log(`${CONFIG} に Hyperdrive（${id}）を結び付けました`);
}

if (import.meta.url === `file://${process.argv[1]}`) {
  await main();
}
