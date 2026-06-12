// 当サイト固有のグローバル（計測タグ・設定）を型として宣言する。
export {};

declare global {
  interface SiteAffiliate {
    label: string;
    href: string;
  }
  interface SiteConfig {
    gaMeasurementId?: string;
    cta?: { label?: string; href?: string };
    affiliates?: Record<string, SiteAffiliate>;
  }
  interface Window {
    SITE_CONFIG?: SiteConfig;
    gtag?: (...args: any[]) => void;
    dataLayer?: any[];
  }
  // CommonJS（テスト用 module.exports）をブラウザJSからも参照するため
  // eslint-disable-next-line no-var
  var module: any;
}
