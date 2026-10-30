import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
// @ts-expect-error 型のない .mjs
import * as hyperdrive from "../scripts/hyperdrive.mjs";

const { bindHyperdrive, bindingsHaveHyperdrive, configHasBinding, originFrom } =
  hyperdrive;

describe("Hyperdrive の準備", () => {
  it("Neon の -pooler を外し、ポートを補う", () => {
    expect(
      originFrom(
        "postgresql://u%40x:p%2Fw@ep-a-b-pooler.ap-southeast-1.aws.neon.tech/neondb?sslmode=require&channel_binding=require",
      ),
    ).toEqual({
      scheme: "postgres",
      host: "ep-a-b.ap-southeast-1.aws.neon.tech",
      port: 5432,
      database: "neondb",
      user: "u@x",
      password: "p/w",
    });
  });

  it("ポートがあればそのまま使う", () => {
    expect(originFrom("postgres://u:p@db.example.com:6543/app").port).toBe(
      6543,
    );
  });

  it("wrangler.jsonc の hyperdrive の行を ID に書き換える", () => {
    const out = bindHyperdrive(
      readFileSync("wrangler.jsonc", "utf8"),
      "abc123",
    );
    expect(out).toContain(
      '  "hyperdrive": [{ "binding": "HYPERDRIVE", "id": "abc123" }],',
    );
    expect(out).not.toContain("<Hyperdrive の ID>");
    expect(out).toContain('"placement": { "mode": "smart" }');
  });

  it("書き換えたあとの行も、もう一度書き換えられる", () => {
    const once = bindHyperdrive(readFileSync("wrangler.jsonc", "utf8"), "a1");
    const twice = bindHyperdrive(once, "b2");
    expect(twice).toContain('"id": "b2"');
    expect(twice).not.toContain('"id": "a1"');
  });

  it("前から Hyperdrive を使っていたかを、設定の行と公開中の結び付けから見分ける", () => {
    const config = readFileSync("wrangler.jsonc", "utf8");
    // 注釈のままなら、まだ使っていない
    expect(configHasBinding(config)).toBe(false);
    expect(configHasBinding(bindHyperdrive(config, "abc"))).toBe(true);
    expect(bindingsHaveHyperdrive(undefined)).toBe(false);
    expect(
      bindingsHaveHyperdrive([{ type: "service", name: "WORKER_SELF" }]),
    ).toBe(false);
    expect(
      bindingsHaveHyperdrive([
        { type: "hyperdrive", name: "HYPERDRIVE", id: "x" },
      ]),
    ).toBe(true);
  });
});
