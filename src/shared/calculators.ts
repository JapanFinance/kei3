// Copyright the original author or authors
// SPDX-License-Identifier: AGPL-3.0-or-later

export interface Calculator {
  /** Path the calculator is served at (with trailing slash). */
  href: string
  /** Short label used in the header navigation. */
  label: string
  /** Full title used on the landing-page cards. */
  title: string
  /** One-line description for the landing-page cards. */
  description: string
  /** Placeholder tools that are not yet functional. */
  comingSoon?: boolean
}

// Single source of truth for the set of calculators: used by both the shared
// header navigation and the landing-page cards so they can never drift apart.
export const CALCULATORS: Calculator[] = [
  {
    href: '/takehome/',
    label: 'Take-Home',
    title: 'Take-Home Pay Calculator',
    description: 'Estimate your net pay in Japan: income tax, residence tax, health insurance, pension, and Furusato Nozei limits.',
  },
  {
    href: '/loan/',
    label: 'Loan',
    title: 'Home Loan Rate Simulator',
    description: 'Compare fixed vs. variable mortgage rate scenarios and see how interest costs play out over time.',
    comingSoon: true,
  },
]
