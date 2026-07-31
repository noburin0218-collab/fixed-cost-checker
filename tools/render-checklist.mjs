/**
 * tools/checklist.html から無料配布PDF（checklist.pdf / A4縦・2ページ）を書き出す。
 *
 * 使い方（リポジトリのルートで実行）:
 *   npm i -D playwright        ← 一時的に入れる（普段は不要）
 *   node tools/render-checklist.mjs
 *   npm un -D playwright       ← 終わったら外す（CIを重くしないため）
 *
 * 日本語の明朝体が必要です。無い場合は次で導入できます:
 *   apt-get install -y fonts-ipaexfont-mincho
 *
 * 中身を直したいときは tools/checklist.html を編集してから実行してください。
 */
import { chromium } from "playwright";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";

const here = dirname(fileURLToPath(import.meta.url));
const src = resolve(here, "checklist.html");
const out = resolve(here, "..", "checklist.pdf");

const executablePath = process.env.CHROMIUM_PATH || undefined;

const browser = await chromium.launch({ executablePath });
const page = await browser.newPage();
await page.goto(`file://${src}`, { waitUntil: "networkidle" });
await page.pdf({
  path: out,
  format: "A4",
  printBackground: true,
  // 余白は @page 側（CSS）で指定しているため、ここでは0にする
  margin: { top: "0", right: "0", bottom: "0", left: "0" },
  preferCSSPageSize: true,
});
await browser.close();

console.log(`配布用PDFを書き出しました: ${out}`);
