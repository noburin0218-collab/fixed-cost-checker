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

test("ヘッダーが無ければ meta charset を使う（Shift_JIS 系は cp932 として読む）", () => {
  assert.equal(detect("", '<meta charset="Shift_JIS">'), "cp932");
  assert.equal(detect("", '<meta charset="utf-8">'), "utf-8");
});

test("ヘッダーの Shift_JIS 指定も cp932 として読む", () => {
  assert.equal(detect("Shift_JIS", ""), "cp932");
});

test("http-equiv 形式の meta からも読む", () => {
  assert.equal(detect("", '<meta http-equiv="Content-Type" content="text/html; charset=Shift_JIS">'), "cp932");
});

test("= の前後に空白がある meta charset も読む", () => {
  assert.equal(detect("", '<meta charset = "Shift_JIS">'), "cp932");
});

test("知らない文字コード名や指定なしは UTF-8 に戻す", () => {
  assert.equal(detect("", "<meta charset=bogus>"), "utf-8");
  assert.equal(detect("", "<p>no meta</p>"), "utf-8");
});

test("Shift_JIS ページの丸数字（①）などの拡張文字が文字化けしない", () => {
  const code = `
import importlib.util, sys
spec = importlib.util.spec_from_file_location("cs", sys.argv[1])
m = importlib.util.module_from_spec(spec); spec.loader.exec_module(m)
body = '<meta charset="Shift_JIS"><p>①料金</p>'.encode("cp932")
cs = m.detect_charset(None, body)
sys.stdout.buffer.write(body.decode(cs, errors="replace").encode("utf-8"))
`;
  const out = execFileSync("python3", ["-I", "-c", code, script], { encoding: "utf8" });
  assert.ok(out.includes("①料金"), out);
});

test("URL や Content-Type で分からない Excel（e-Stat のダウンロード形式）も、ZIP の中身で判定する", () => {
  const code = `
import importlib.util, io, sys, zipfile
from email.message import Message
spec = importlib.util.spec_from_file_location("cs", sys.argv[1])
m = importlib.util.module_from_spec(spec); spec.loader.exec_module(m)
h = Message(); h["Content-Type"] = "application/octet-stream"
def zipped(name):
    b = io.BytesIO()
    with zipfile.ZipFile(b, "w") as z: z.writestr(name, "x")
    return b.getvalue()
url = "https://www.e-stat.go.jp/stat-search/file-download?statInfId=1&fileKind=0"
print(m.kind_of(url, h, zipped("xl/workbook.xml")), m.kind_of(url, h, zipped("a.txt")), m.kind_of(url, h, b"%PDF-1.7"))
`;
  const out = execFileSync("python3", ["-I", "-c", code, script], { encoding: "utf8" }).trim();
  assert.equal(out, "xlsx html pdf");
});
