// 当サイト固有のグローバル（計測タグ・設定）を型として宣言する。
export {};

declare global {
  /** 1本のアフィリエイトリンク */
  interface SiteAffiliateLink {
    label?: string;
    href: string;
    /** A8の表示計測用1×1画像（素材コードに含まれるもの） */
    impression?: string;
  }
  /**
   * カテゴリごとの設定。次のいずれかの形をとる。
   *  - 単一リンク: { label, href }
   *  - 世帯人数での出し分け: { family（3人以上）, default（2人以下） }
   */
  interface SiteAffiliate {
    label?: string;
    href?: string;
    impression?: string;
    family?: SiteAffiliateLink;
    default?: SiteAffiliateLink;
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
