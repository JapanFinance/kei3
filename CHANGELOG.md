# Changelog

All notable changes to the Japan Take-Home Pay Calculator will be documented in this file.

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
