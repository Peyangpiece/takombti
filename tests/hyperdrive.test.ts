import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
// @ts-expect-error 型のない .mjs
import { bindHyperdrive, originFrom } from "../scripts/hyperdrive.mjs";

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
});
