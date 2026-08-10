/**
 * tools/brand-assets.html から SNS用の画像を書き出す。
 *   brand/icon.png   … アイコン（400×400）
 *   brand/header.png … ヘッダー（1500×500）
 *
 * 使い方（リポジトリのルートで実行）:
 *   npm i -D playwright        ← 一時的に入れる（普段は不要）
 *   node tools/render-brand.mjs
 *   npm un -D playwright       ← 終わったら外す（CIを重くしないため）
 *
 * 日本語の明朝体が必要です。無い場合は次で導入できます:
 *   apt-get install -y fonts-ipaexfont-mincho
 *
 * 文言を変えたいときは tools/brand-assets.html を編集してから実行してください。
 */
import { chromium } from "playwright";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";
import { mkdirSync } from "node:fs";

const here = dirname(fileURLToPath(import.meta.url));
const src = resolve(here, "brand-assets.html");
const outDir = resolve(here, "..", "brand");
mkdirSync(outDir, { recursive: true });

const executablePath = process.env.CHROMIUM_PATH || undefined;

const browser = await chromium.launch({ executablePath });
const page = await browser.newPage({ viewport: { width: 1600, height: 900 } });
await page.goto(`file://${src}`, { waitUntil: "networkidle" });

for (const [id, file] of [
  ["#icon", "icon.png"],
  ["#header", "header.png"],
]) {
  const el = await page.$(id);
  await el.screenshot({ path: resolve(outDir, file) });
  console.log(`書き出しました: brand/${file}`);
}

await browser.close();
