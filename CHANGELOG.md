# Changelog

All notable changes to the Japan Take-Home Pay Calculator will be documented in this file.

## 2026-06-27

### New

- Added support for more income deductions (所得控除) in the "Additional Deductions & Credits" section: life insurance ([生命保険料控除](https://www.nta.go.jp/taxes/shiraberu/taxanswer/shotoku/1140.htm)), earthquake insurance ([地震保険料控除](https://www.nta.go.jp/taxes/shiraberu/taxanswer/shotoku/1145.htm)), and medical expenses ([医療費控除](https://www.nta.go.jp/taxes/shiraberu/taxanswer/shotoku/1120.htm)). Enter your premiums or medical expenses and the calculator works out the deduction — including the different income-tax and residence-tax amounts, and the medical expense income floor — then applies it to your income tax, residence tax, and furusato nozei limit. The Taxes tab shows the combined total with a per-item breakdown.

## 2026-06-21

### Fixed

- Added support for the income amount adjustment deduction ([所得金額調整控除（子ども・特別障害者等を有する者等）](https://www.nta.go.jp/taxes/shiraberu/taxanswer/shotoku/1411.htm)) for taxpayers with employment income exceeding ¥8,500,000 and who have a qualifying dependent (a dependent relative under 23, or a spouse/dependent with special disability status). Up to ¥150,000 is deducted from employment income, which lowers total net income (合計所得金額). Because total net income is the basis for several eligibility limits, this also corrects cases where, for example, the home loan tax credit was wrongly denied near the ¥20,000,000 income limit. Details are in the Net Employment Income tooltip when eligible.

## 2026-05-18

### New

- Added support for the home loan tax credit (住宅ローン控除). Enter the annual credit amount you've calculated (控除可能額) and the year you moved in, and the calculator applies it to your tax owed, up to the applicable cap. Find it in the new "Additional Deductions & Credits" section.

### Updated

- The iDeCo / Corporate DC (defined contribution) input has moved into the new "Additional Deductions & Credits" section.

### Fixed

- Corrected the residence-tax adjustment credit (調整控除) for taxpayers whose taxable income is above ¥2,000,000 and claim a deduction for a spouse or dependents. Residence tax was being slightly under-stated for these households. Taxpayers not claiming a spouse or dependent deduction, anyone with taxable income at or below ¥2,000,000, and anyone with net income exceeding ¥25,000,000, were unaffected.

## 2026-04-05

### Updated

- Added FY2026 National Health Insurance rates for supported providers (except Tokyo's Chuo Ward and Nara prefecture), including the new Childcare Support Contribution (子ども・子育て支援納付金分). NHI rates are now applied considering that rates change mid calendar year. See the tooltips for details.

## 2026-04-02

### Updated

- Support 2026 tax deduction changes to income tax basic deduction, employment income, and spouse/dependent deduction income threshold.

- Updated National Pension contribution amount for FY2026.

## 2026-03-30

### Updated

- Updated Employee Health Insurance rates for FY2026 for all supported providers, including the new Childcare Support Contribution (子ども・子育て支援金). Rates are now applied per-month, so premiums are calculated accurately when rates change mid-year.

## 2026-03-29

### Updated

- Updated Employment Insurance calculation to use the new rate from April 2026 (0.55% to 0.5%)

## 2026-02-22

### Updated

- Foreign stock-based compensation is supported in the "Advanced" income input mode. Taxpayers who receive compensation such as RSUs from a foreign parent company should enter such income using this.

## 2026-02-15

### Updated

- Commuting allowance can now be entered in the "Advanced" income input mode. While commuting allowance is generally non-taxable, it affects the calculation of social insurance premiums.

### Fixed

- The "capped" indicators for health insurance and pension premiums were being incorrectly shown in some mixed income scenarios (e.g. salary + bonus, salary + business income) even when the relevant income was not high enough to be capped. This has been fixed and the indicators will now only show on the specific premium component in the Social Insurance tab.

## 2026-02-10

### New

- Added an "Advanced" income input mode for multiple incomes (e.g. Salary, Bonus, Business). This mode also supports the Blue-Filer special deduction for sole proprietors.

## 2025-12-08

### New

- Added "Manual Social Insurance Entry" option. This allows you to manually input the total social insurance amount if you already know the exact deduction amount, overriding the automatic calculation. This is useful for situations not covered by the options available, such as employees who don't have a fixed annual salary and people on NHI in a municipality not available in the dropdown options.

## 2025-12-07

### New

- Added support for dependent-related deductions. You can now add information about a spouse and other dependents. Depending on applicable deductions, this will affect your income tax and residence tax calculations.
- Added "Custom Employee Health Insurance Provider" option to the Health Insurance Provider input. This allows you to manually input your specific health insurance and long-term care insurance rates if your provider is not listed.

## 2025-11-07

### New

- Added a new Health Insurance Provider option for people who are covered as a dependent under the employees health insurance of someone in the same household (e.g. their spouse). If your income is below the ¥1,300,000 threshold, you can select this new option "None (dependent of insured employee)" in the Health Insurance Provider dropdown.

## 2025-08-23

### New

- This "What's New" dialog to keep you updated on new features and improvements

## 2025-08-17

### New

- Support for National Health Insurance in Nara prefecture, Osaka prefecture, and Tokyo's special 23 wards
- Added more employee health insurance providers: Tokyo Securities, Rakuten, and Recruit

### Updated

- Employee health insurance providers are now sorted alphabetically for easier selecting
- Adds source links for health insurance premium information to the corresponding tooltip

## 2025-08-11

### New

- Complete health insurance rate data for all Kyokai Kenpo regions across Japan

### Updated

- Updated region selection to use searchable dropdown for easier navigation
- Updated Furusato Nozei estimated gift values based on [latest 2024 statistics (PDF)](https://www.soumu.go.jp/main_content/001022815.crdownload)

## 2025-08-05

### New

- Indicators showing when health insurance premiums or pension contributions are capped or fixed

## 2025-07-23

### Updated

- Allow selecting National Health Insurance with employment income

## 2025-07-21

### New

- Take-Home Pay Calculator [announced on r/JapanFinance](https://www.reddit.com/r/JapanFinance/comments/1m5jqjn/new_wiki_domain_and_takehome_pay_calculator/)
