/**
 * tools/ogp.html から OGP画像（ogp.png / 1200×630）を書き出すスクリプト。
 *
 * 使い方（リポジトリのルートで実行）:
 *   npm i -D playwright        ← 一時的に入れる（普段は不要）
 *   node tools/render-ogp.mjs
 *   npm un -D playwright       ← 終わったら外す（CIを重くしないため）
 *
 * 日本語の明朝体が必要です。無い場合は次で導入できます:
 *   apt-get install -y fonts-ipaexfont-mincho
 *
 * タイトルやドメインを変えたいときは tools/ogp.html を編集してから実行してください。
 */
import { chromium } from "playwright";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";

const here = dirname(fileURLToPath(import.meta.url));
const src = resolve(here, "ogp.html");
const out = resolve(here, "..", "ogp.png");

// 環境によって Chromium の場所が異なるため、指定があればそれを使う
const executablePath = process.env.CHROMIUM_PATH || undefined;

const browser = await chromium.launch({ executablePath });
const page = await browser.newPage({
  viewport: { width: 1200, height: 630 },
  deviceScaleFactor: 1,
});
await page.goto(`file://${src}`, { waitUntil: "networkidle" });
await page.screenshot({ path: out });
await browser.close();

console.log(`OGP画像を書き出しました: ${out}`);
