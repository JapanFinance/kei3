// Copyright the original author or authors
// SPDX-License-Identifier: AGPL-3.0-or-later

interface MediaRuleLike {
  media: MediaList;
  cssRules: CSSRuleList;
}

interface StyleRuleLike {
  selectorText: string;
  style: CSSStyleDeclaration;
}

const isMediaRule = (rule: CSSRule): rule is CSSRule & MediaRuleLike =>
  'media' in rule && 'cssRules' in rule;

const isStyleRule = (rule: CSSRule): rule is CSSRule & StyleRuleLike =>
  'selectorText' in rule && 'style' in rule;

const matchesSelector = (element: Element, selector: string): boolean => {
  try {
    return element.matches(selector);
  } catch {
    return false;
  }
};

export const getReducedMotionStyles = (element: Element): CSSStyleDeclaration[] => {
  const styles: CSSStyleDeclaration[] = [];

  for (const sheet of document.styleSheets) {
    for (const rule of sheet.cssRules) {
      if (!isMediaRule(rule) || !/prefers-reduced-motion:\s*reduce/.test(rule.media.mediaText)) {
        continue;
      }

      for (const nested of rule.cssRules) {
        if (isStyleRule(nested) && matchesSelector(element, nested.selectorText)) {
          styles.push(nested.style);
        }
      }
    }
  }

  return styles;
};
