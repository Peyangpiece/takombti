// ホーム画面のアイコン（PNG）を、土台のマスコット（mascot-base.svg）から書き出す。
// iPhone はホーム画面のアイコンに SVG を使えず、透明な所を黒く塗るので、うすいピンクの背景を敷いた PNG にする。
// 角はそれぞれの端末が丸めるので、四角いまま書き出し、まわりに余白をとる（Android の丸や角丸に切られても欠けない）。
//   node design/build_icons.cjs
const { chromium } = require("playwright");
const fs = require("fs");
const path = require("path");

const here = __dirname;
const root = path.join(here, "..");
const BG = "#FFF1F6";
const svg = fs
  .readFileSync(path.join(here, "mascot-base.svg"), "utf8")
  .replace(/viewBox="[^"]*"/, 'viewBox="14 8 212 212"')
  .replace(/<ellipse cx="120" cy="194"[^>]*\/>/, "");

const outputs = [
  ["src/app/apple-icon.png", 180],
  ["public/icon-192.png", 192],
  ["public/icon-512.png", 512],
];

(async () => {
  const browser = await chromium.launch();
  for (const [file, size] of outputs) {
    const inner = Math.round(size * 0.78);
    const page = await browser.newPage({
      viewport: { width: size, height: size },
    });
    await page.setContent(
      `<body style="margin:0;width:${size}px;height:${size}px;background:${BG};display:flex;align-items:center;justify-content:center">` +
        svg.replace(
          /width="\d+" height="\d+"/,
          `width="${inner}" height="${inner}"`,
        ) +
        "</body>",
    );
    fs.mkdirSync(path.dirname(path.join(root, file)), { recursive: true });
    await page.screenshot({ path: path.join(root, file) });
    await page.close();
    console.log(`${file}（${size}px）`);
  }
  await browser.close();
})();
