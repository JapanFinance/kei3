// Copyright the original author or authors
// SPDX-License-Identifier: AGPL-3.0-or-later

/**
 * Central registry of the official sources cited across the calculator.
 *
 * Every static government URL the UI links to lives here exactly once; components and data
 * modules reference entries by id (see {@link OfficialSourceId}), so a maintainer citation and the
 * user-facing citation of the same document cannot drift. The only URLs allowed outside this file
 * are data-carried ones (per-municipality NHI rate pages, per-provider EHI rate tables), which
 * live in their data records and are passed around as {@link OfficialSource} objects.
 *
 * Labeling conventions (enforced by shape, verified against the live pages):
 *  - `org` is a short English tag (NTA, MHLW, …; municipalities by English name). Full names for
 *    the fixed tags are in {@link SOURCE_ORG_FULL_NAMES} and surface as a hover title.
 *  - `docNo` is the organization's own document number, when it has one (タックスアンサー
 *    "No.1140", procedure index "A1-8").
 *  - `title` is the document's own title, verbatim — official Japanese for Japanese pages,
 *    official English for English pages. Never a paraphrase (repo rule: official terminology
 *    only).
 *  - `gloss` is an optional English hint for readers who don't parse the Japanese title. It is
 *    presentation, not terminology, and renders visibly de-emphasized.
 */
export interface OfficialSource {
  /** Short issuing-organization tag, e.g. 'NTA' or a municipality/provider name. */
  org: string;
  /** The organization's own document number, e.g. 'No.1140' (タックスアンサー) or 'A1-8'. */
  docNo?: string;
  /** The document's own title, verbatim from the page. */
  title: string;
  /** Optional English hint rendered de-emphasized after the title. */
  gloss?: string;
  url: string;
}

/**
 * Full organization names behind the fixed short tags, shown as a hover title on the tag.
 * Data-carried sources may use free-form tags (a municipality or provider name) with no entry
 * here; those render without the hover title.
 */
export const SOURCE_ORG_FULL_NAMES: Record<string, string> = {
  NTA: 'National Tax Agency (国税庁)',
  MHLW: 'Ministry of Health, Labour and Welfare (厚生労働省)',
  MIC: 'Ministry of Internal Affairs and Communications (総務省)',
  MLIT: 'Ministry of Land, Infrastructure, Transport and Tourism (国土交通省)',
  'Japan Pension Service': '日本年金機構',
  'e-Gov': 'e-Gov 法令検索 (Japanese Law Translation portal of the digital government)',
  'Tokyo Bureau of Taxation': '東京都主税局',
  'Nerima City': '練馬区',
  'Yokohama City': '横浜市',
};

export const OFFICIAL_SOURCES = {
  // --- NTA タックスアンサー ---------------------------------------------------------------
  nta1120: {
    org: 'NTA',
    docNo: 'No.1120',
    title: '医療費を支払ったとき（医療費控除）',
    gloss: 'Medical expense deduction',
    url: 'https://www.nta.go.jp/taxes/shiraberu/taxanswer/shotoku/1120.htm',
  },
  nta1135: {
    org: 'NTA',
    docNo: 'No.1135',
    title: '小規模企業共済等掛金控除',
    gloss: 'iDeCo / small enterprise mutual aid deduction',
    url: 'https://www.nta.go.jp/taxes/shiraberu/taxanswer/shotoku/1135.htm',
  },
  nta1140: {
    org: 'NTA',
    docNo: 'No.1140',
    title: '生命保険料控除',
    gloss: 'Life insurance deduction',
    url: 'https://www.nta.go.jp/taxes/shiraberu/taxanswer/shotoku/1140.htm',
  },
  nta1145: {
    org: 'NTA',
    docNo: 'No.1145',
    title: '地震保険料控除',
    gloss: 'Earthquake insurance deduction',
    url: 'https://www.nta.go.jp/taxes/shiraberu/taxanswer/shotoku/1145.htm',
  },
  nta1160: {
    org: 'NTA',
    docNo: 'No.1160',
    title: '障害者控除',
    gloss: 'Disability deduction',
    url: 'https://www.nta.go.jp/taxes/shiraberu/taxanswer/shotoku/1160.htm',
  },
  nta1177: {
    org: 'NTA',
    docNo: 'No.1177',
    title: '特定親族特別控除',
    gloss: 'Specific relative special deduction',
    url: 'https://www.nta.go.jp/taxes/shiraberu/taxanswer/shotoku/1177.htm',
  },
  nta1180: {
    org: 'NTA',
    docNo: 'No.1180',
    title: '扶養控除',
    gloss: 'Dependent deduction',
    url: 'https://www.nta.go.jp/taxes/shiraberu/taxanswer/shotoku/1180.htm',
  },
  nta1191: {
    org: 'NTA',
    docNo: 'No.1191',
    title: '配偶者控除',
    gloss: 'Spouse deduction',
    url: 'https://www.nta.go.jp/taxes/shiraberu/taxanswer/shotoku/1191.htm',
  },
  nta1195: {
    org: 'NTA',
    docNo: 'No.1195',
    title: '配偶者特別控除',
    gloss: 'Spouse special deduction',
    url: 'https://www.nta.go.jp/taxes/shiraberu/taxanswer/shotoku/1195.htm',
  },
  nta1199: {
    org: 'NTA',
    docNo: 'No.1199',
    title: '基礎控除',
    gloss: 'Basic deduction',
    url: 'https://www.nta.go.jp/taxes/shiraberu/taxanswer/shotoku/1199.htm',
  },
  nta1410: {
    org: 'NTA',
    docNo: 'No.1410',
    title: '給与所得控除',
    gloss: 'Employment income deduction',
    url: 'https://www.nta.go.jp/taxes/shiraberu/taxanswer/shotoku/1410.htm',
  },
  nta1411: {
    org: 'NTA',
    docNo: 'No.1411',
    title: '所得金額調整控除',
    gloss: 'Income amount adjustment deduction',
    url: 'https://www.nta.go.jp/taxes/shiraberu/taxanswer/shotoku/1411.htm',
  },
  nta1540: {
    org: 'NTA',
    docNo: 'No.1540',
    title: 'ストック・オプション税制の適用を受けて取得した株式を譲渡した場合',
    gloss: 'Qualified stock options',
    url: 'https://www.nta.go.jp/taxes/shiraberu/taxanswer/shotoku/1540.htm',
  },
  nta1543: {
    org: 'NTA',
    docNo: 'No.1543',
    title: '税制非適格ストック・オプションに係る課税関係について',
    gloss: 'Non-qualified stock options',
    url: 'https://www.nta.go.jp/taxes/shiraberu/taxanswer/shotoku/1543.htm',
  },
  nta2072: {
    org: 'NTA',
    docNo: 'No.2072',
    title: '青色申告特別控除',
    gloss: 'Blue return special deduction',
    url: 'https://www.nta.go.jp/taxes/shiraberu/taxanswer/shotoku/2072.htm',
  },
  nta2260: {
    org: 'NTA',
    docNo: 'No.2260',
    title: '所得税の税率',
    gloss: 'Income tax rates',
    url: 'https://www.nta.go.jp/taxes/shiraberu/taxanswer/shotoku/2260.htm',
  },

  // --- NTA (other) ----------------------------------------------------------------------
  ntaBasicDeduction2025Reform: {
    org: 'NTA',
    title: '令和７年度税制改正による所得税の基礎控除の見直し等について',
    gloss: '2025 reform of the basic deduction',
    url: 'https://www.nta.go.jp/users/gensen/2025kiso/index.htm#a-01',
  },
  ntaHomeLoanCreditGuide: {
    org: 'NTA',
    title: '住宅ローン控除を受ける方へ',
    gloss: 'Home loan credit filing guide',
    url: 'https://www.nta.go.jp/taxes/shiraberu/shinkoku/tokushu/keisubetsu/juutaku.htm',
  },
  ntaReconstructionSurtax: {
    org: 'NTA',
    title: '個人の方に係る復興特別所得税のあらまし',
    gloss: 'Reconstruction surtax overview',
    url: 'https://www.nta.go.jp/publication/pamph/shotoku/fukko_tokubetsu/index.htm',
  },
  ntaBlueReturnApproval: {
    org: 'NTA',
    docNo: 'A1-8',
    title: '青色申告の承認申請',
    gloss: 'Blue return approval application',
    url: 'https://www.nta.go.jp/taxes/tetsuzuki/shinsei/annai/shinkoku/annai/09.htm',
  },
  ntaEmploymentIncomeDeductionEn: {
    org: 'NTA',
    docNo: 'No.12012',
    title: 'Overview of deduction for employment income',
    url: 'https://www.nta.go.jp/english/taxes/individual/12012.htm',
  },

  // --- MHLW -------------------------------------------------------------------------------
  mhlwDcPlanOverview: {
    org: 'MHLW',
    title: '確定拠出年金制度の概要',
    gloss: 'Defined contribution pension overview',
    url: 'https://www.mhlw.go.jp/stf/seisakunitsuite/bunya/nenkin/nenkin/kyoshutsu/gaiyou.html',
  },
  mhlwEmploymentInsuranceRates: {
    org: 'MHLW',
    title: '雇用保険料率について',
    gloss: 'Employment insurance premium rates',
    url: 'https://www.mhlw.go.jp/stf/seisakunitsuite/bunya/0000108634.html',
  },
  mhlwLivingConditionsSurvey2024: {
    org: 'MHLW',
    title: '2024（令和６）年　国民生活基礎調査の概況',
    gloss: 'Comprehensive Survey of Living Conditions',
    url: 'https://www.mhlw.go.jp/toukei/saikin/hw/k-tyosa/k-tyosa24/index.html',
  },

  // --- MIC (総務省) -------------------------------------------------------------------------
  micResidenceTaxHomeLoanCredit: {
    org: 'MIC',
    title: '個人住民税の住宅ローン控除',
    gloss: 'Residence tax home loan credit',
    url: 'https://www.soumu.go.jp/main_sosiki/jichi_zeisei/czaisei/czaisei_seido/090929.html',
  },
  micFurusatoNozeiSurvey: {
    org: 'MIC',
    title: 'ふるさと納税に関する現況調査結果',
    gloss: 'Furusato Nozei survey results',
    url: 'https://www.soumu.go.jp/main_sosiki/jichi_zeisei/czaisei/czaisei_seido/furusato/archive/#ac02',
  },

  // --- MLIT -------------------------------------------------------------------------------
  mlitHomeLoanTaxReduction: {
    org: 'MLIT',
    title: '住宅ローン減税',
    gloss: 'Home loan tax reduction',
    url: 'https://www.mlit.go.jp/jutakukentiku/house/jutakukentiku_house_tk2_000017.html',
  },

  // --- Japan Pension Service (日本年金機構) ---------------------------------------------------
  jpsNationalPensionPremium: {
    org: 'Japan Pension Service',
    title: '国民年金保険料',
    gloss: 'National pension contributions',
    url: 'https://www.nenkin.go.jp/service/kokunen/hokenryo/hokenryo.html#cms01',
  },
  jpsSmrPremiumTable: {
    org: 'Japan Pension Service',
    title: '保険料額表（令和2年9月分～）（厚生年金保険と協会けんぽ管掌の健康保険）',
    gloss: 'SMR premium amount table',
    url: 'https://www.nenkin.go.jp/service/kounen/hokenryo/ryogaku/ryogakuhyo/20200825.html',
  },
  jpsEmployeesPensionPremium: {
    org: 'Japan Pension Service',
    title: '厚生年金保険の保険料',
    gloss: 'Employees pension premiums',
    url: 'https://www.nenkin.go.jp/service/kounen/hokenryo/hoshu/20150515-01.html',
  },

  // --- Statutes (e-Gov 法令検索) --------------------------------------------------------------
  egovLocalTaxActArt314_6: {
    org: 'e-Gov',
    title: '地方税法 第314条の6',
    gloss: 'Local Tax Act, Article 314-6',
    url: 'https://laws.e-gov.go.jp/law/325AC0000000226#Mp-At_314_6',
  },

  // --- Residence tax (東京都主税局 and municipal explainers) -----------------------------------
  tokyoResidenceTax: {
    org: 'Tokyo Bureau of Taxation',
    title: '個人住民税',
    gloss: 'Individual residence tax',
    url: 'https://www.tax.metro.tokyo.lg.jp/kazei/life/kojin_ju',
  },
  nerimaPersonalDeductions: {
    org: 'Nerima City',
    title: '人的控除（基礎控除・配偶者控除など）',
    gloss: 'Residence tax personal deductions',
    url: 'https://www.city.nerima.tokyo.jp/kurashi/zei/jyuminzei/shotokukojo/jintekikojo.html',
  },
  nerimaResidenceTaxReform2026: {
    org: 'Nerima City',
    title:
      '令和8年度特別区民税・都民税（住民税）から適用される税制改正（いわゆる年収の壁への対応）の概要',
    gloss: 'FY2026 residence tax reform',
    url: 'https://www.city.nerima.tokyo.jp/kurashi/zei/jyuminzei/seido/8zeiseikaisei.html',
  },
  yokohamaResidenceTaxReform2021: {
    org: 'Yokohama City',
    title: '住民税税制改正のお知らせ（令和３年度実施分）',
    gloss: 'FY2021 residence tax reform',
    url: 'https://www.city.yokohama.lg.jp/kurashi/koseki-zei-hoken/zeikin/y-shizei/kojin-shiminzei-kenminzei/kaisei/R3zeiseikaisei.html#4',
  },
} as const satisfies Record<string, OfficialSource>;

/** Id of a registry entry; the only way for components to cite a static source. */
export type OfficialSourceId = keyof typeof OFFICIAL_SOURCES;

/**
 * What citing code passes around: a registry id for static sources, or a full
 * {@link OfficialSource} for data-carried ones (e.g. a municipality's NHI rate page).
 */
export type OfficialSourceRef = OfficialSourceId | OfficialSource;

export function resolveOfficialSource(ref: OfficialSourceRef): OfficialSource {
  return typeof ref === 'string' ? OFFICIAL_SOURCES[ref] : ref;
}
