"use strict";

/**
 * 記事ページ用のスクリプト。
 *
 * やることは2つだけ。
 *   1. アクセス解析（GoatCounter）の読み込み ※ index.html と同じ条件
 *   2. 「記事 → 診断」への遷移と、記事内の広告クリックの計測
 *
 * 入力値のような個人に関わるデータは扱いません（記事ページに入力欄はありません）。
 */
(function () {
  var cfg = window.SITE_CONFIG || {};

  // ---- アクセス解析の読み込み ----
  if (cfg.goatCounterEndpoint) {
    var s = document.createElement("script");
    s.async = true;
    s.src = "//gc.zgo.at/count.js";
    s.setAttribute("data-goatcounter", cfg.goatCounterEndpoint);
    document.head.appendChild(s);
  }

  /**
   * イベント名だけを送る（金額や個人に関わる値は送らない）。
   * @param {string} name
   */
  function track(name) {
    var gc = window.goatcounter;
    if (gc && typeof gc.count === "function") {
      gc.count({ path: "event/" + name, title: name, event: true });
    }
    if (typeof window.gtag === "function") {
      window.gtag("event", name, {});
    }
  }

  // 記事のスラッグ（<body data-article="..."> で指定）
  var slug = (document.body && document.body.getAttribute("data-article")) || "unknown";

  document.addEventListener(
    "click",
    function (e) {
      var target = e.target;
      if (!target || typeof target.closest !== "function") return;

      // 記事 → 診断への遷移
      var toDiagnosis = target.closest("[data-track='to-diagnosis']");
      if (toDiagnosis) {
        track("article_to_diagnosis/" + slug);
        return;
      }

      // 記事内の広告クリック（ASP発行コードには手を入れず、親要素で拾う）
      var adLink = target.closest(".ad-card__link a");
      if (adLink) {
        var card = adLink.closest(".ad-card");
        var adSlot = (card && card.getAttribute("data-ad-slot")) || "unknown";
        track("ad_click/" + adSlot);
      }
    },
    true
  );

  // 記事内に広告が表示されたことを記録する
  document.querySelectorAll(".ad-card[data-ad-slot]").forEach(function (card) {
    track("ad_view/" + (card.getAttribute("data-ad-slot") || "unknown"));
  });
})();
