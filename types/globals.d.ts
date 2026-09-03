// 当サイト固有のグローバル（計測タグ・設定）を型として宣言する。
export {};

declare global {
  /** 広告カード1件分の設定 */
  interface SiteAffiliate {
    /** サイト側で書く見出し（広告コードの外側） */
    heading?: string;
    /** サイト側で書く説明文（広告コードの外側） */
    body?: string;
    /** ASPが発行した広告コード。改変せずそのまま貼る。空なら非表示 */
    code?: string;
    /** 表示条件のしきい値（円／年）。実績を見て調整する前提の設定値 */
    thresholds?: { rarely?: number; sometimes?: number };
  }
  interface SiteConfig {
    /** GoatCounter の集計先URL。空なら計測しない */
    goatCounterEndpoint?: string;
    gaMeasurementId?: string;
    cta?: { label?: string; href?: string };
    affiliates?: Record<string, SiteAffiliate>;
    /** 貯蓄相談の導線（保険とは別枠） */
    savingsAdvisor?: SiteAffiliate;
    /**
     * 比較記事で横並びにする案件。掲載順は五十音順で、順番に意味を持たせない。
     * code はASP発行コードの原文。
     */
    insuranceComparison?: { slot: string; name: string; code: string }[];
  }
  interface Window {
    SITE_CONFIG?: SiteConfig;
    gtag?: (...args: any[]) => void;
    /** GoatCounter の計測スクリプトが読み込まれると生える */
    goatcounter?: { count?: (opts: { path: string; title?: string; event?: boolean }) => void };
    dataLayer?: any[];
  }
  // CommonJS（テスト用 module.exports）をブラウザJSからも参照するため
  // eslint-disable-next-line no-var
  var module: any;
}
