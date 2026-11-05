"use strict";
// tools/check-sources.py の文字コード判定（detect_charset）の回帰テスト。
// Source Check で公式ページを文字化けせずに読めることを保証する。
const test = require("node:test");
const assert = require("node:assert/strict");
const path = require("node:path");
const { execFileSync } = require("node:child_process");

const script = path.join(__dirname, "..", "tools", "check-sources.py");

/** detect_charset(header, body) を Python で実行し、結果の文字コード名を返す */
function detect(header, bodyHtml) {
  const code = `
import importlib.util, sys
spec = importlib.util.spec_from_file_location("cs", sys.argv[1])
m = importlib.util.module_from_spec(spec); spec.loader.exec_module(m)
header = sys.argv[2] or None
print(m.detect_charset(header, sys.argv[3].encode("ascii")))
`;
  return execFileSync("python3", ["-I", "-c", code, script, header, bodyHtml], { encoding: "utf8" }).trim();
}

test("ヘッダーに文字コードがあれば、それを使う", () => {
  assert.equal(detect("euc-jp", '<meta charset="utf-8">'), "euc-jp");
});

test("ヘッダーが無ければ meta charset を使う", () => {
  assert.equal(detect("", '<meta charset="Shift_JIS">'), "shift_jis");
});

test("http-equiv 形式の meta からも読む", () => {
  assert.equal(detect("", '<meta http-equiv="Content-Type" content="text/html; charset=Shift_JIS">'), "shift_jis");
});

test("= の前後に空白がある meta charset も読む", () => {
  assert.equal(detect("", '<meta charset = "Shift_JIS">'), "shift_jis");
});

test("知らない文字コード名や指定なしは UTF-8 に戻す", () => {
  assert.equal(detect("", "<meta charset=bogus>"), "utf-8");
  assert.equal(detect("", "<p>no meta</p>"), "utf-8");
});
