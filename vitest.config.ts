import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

export default defineConfig({
  // tsconfig.json の paths と同じ（API の処理をテストから直接呼ぶため）
  resolve: {
    alias: { "@": fileURLToPath(new URL("./src", import.meta.url)) },
  },
  test: {
    environment: "node",
    include: ["tests/**/*.test.ts"],
    testTimeout: 30000,
    // 本物の PostgreSQL で動かすときは、テストのファイルどうしが同じ表を消し合わないよう、1 つずつ動かす
    fileParallelism: !process.env.DATABASE_URL,
  },
});
