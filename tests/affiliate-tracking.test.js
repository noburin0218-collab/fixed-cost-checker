"use strict";
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const { JSDOM } = require("jsdom");
const source = file => fs.readFileSync(path.join(__dirname, "..", file), "utf8");

for (const page of ["article", "diagnosis"]) {
  test(`${page}: nested advertisement click emits one GA4 event and preserves ASP markup`, () => {
    const dom = new JSDOM('<body data-article="4nin-kazoku-tsushinhi"><div class="ad-card" data-ad-slot="mobile"><p class="ad-card__link"><a href="#" rel="nofollow"><span>広告</span></a></p></div></body>', { runScripts: "outside-only", url: "https://example.test/" });
    const w = dom.window;
    w.eval(source("config.js"));
    w.SITE_CONFIG.goatCounterEndpoint = "";
    const ga = [], gc = [];
    w.gtag = (...args) => ga.push(args);
    w.goatcounter = { count: event => gc.push(event) };
    const before = w.document.querySelector(".ad-card__link").innerHTML;
    if (page === "article") w.eval(source("articles.js"));
    else w.eval(source("script.js") + "\nsetupAdClickTracking();");
    w.document.querySelector("span").dispatchEvent(new w.MouseEvent("click", { bubbles: true }));
    const clicks = ga.filter(event => event[1] === "affiliate_click");
    assert.equal(clicks.length, 1);
    assert.deepEqual(JSON.parse(JSON.stringify(clicks[0][2])), { merchant: "LIBMO", affiliate_program: "a8", placement: page === "article" ? "article/4nin-kazoku-tsushinhi/mobile" : "diagnosis/mobile" });
    assert.equal(ga.filter(event => event[1] === "ad_click/mobile").length, 0);
    assert.equal(gc.filter(event => event.path === "event/ad_click/mobile").length, 1);
    assert.equal(w.document.querySelector(".ad-card__link").innerHTML, before);
    dom.window.close();
  });
}
test("article: GA4 loads only with a configured measurement ID", () => {
  for (const id of ["", "G-TEST123"]) {
    const dom = new JSDOM("<body></body>", { runScripts: "outside-only" });
    dom.window.SITE_CONFIG = { gaMeasurementId: id };
    dom.window.eval(source("articles.js"));
    assert.equal(dom.window.document.querySelectorAll('script[src*="googletagmanager"]').length, id ? 1 : 0);
    if (id) assert.equal(dom.window.dataLayer[1][1], id);
    dom.window.close();
  }
});
