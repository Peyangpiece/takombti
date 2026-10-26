// 公開の前に、Cloudflare の Hyperdrive（データベース接続の仲立ち）の設定を用意し、
// wrangler.jsonc に結び付けを書き込む。GitHub Actions の Deploy から呼ぶ。
//
// - 設定の名前は takoshin-db。なければ作り、あれば接続先を DATABASE_URL に合わせ直す
// - 結果の使い回し（キャッシュ）は切る。回答数や締め切りの状態が最大 60 秒古く見えるのを防ぐため
// - Neon の接続文字列が「-pooler」付き（接続の取りまとめ役を通す形）なら、直接つなぐ形に変える。
//   Hyperdrive 自身が接続を取りまとめるので、直接つなぐのが推奨されている
// - API トークンに Hyperdrive の権限がないなどで失敗したら、警告だけ出して終わる。
//   そのときは Hyperdrive なしで（DATABASE_URL で直接）公開する
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

export function bindHyperdrive(config, id) {
  const line = `  "hyperdrive": [{ "binding": "HYPERDRIVE", "id": "${id}" }],`;
  const out = config.replace(/^[ \t]*\/\/ *"hyperdrive":.*$/m, line);
  if (out === config)
    throw new Error(`${CONFIG} に hyperdrive の行が見つからない`);
  return out;
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
  if (!token || !account || !databaseUrl) {
    warn(
      "CLOUDFLARE_API_TOKEN・CLOUDFLARE_ACCOUNT_ID・DATABASE_URL のどれかがないので、Hyperdrive を使わずに公開します",
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
    warn(
      `Hyperdrive を用意できなかったので、使わずに公開します（${e.message}）。` +
        "API トークンに「Hyperdrive の編集（Hyperdrive Edit）」の権限があるか確かめてください",
    );
    return;
  }
  writeFileSync(CONFIG, bindHyperdrive(readFileSync(CONFIG, "utf8"), id));
  console.log(`${CONFIG} に Hyperdrive（${id}）を結び付けました`);
}

if (import.meta.url === `file://${process.argv[1]}`) {
  await main();
}
