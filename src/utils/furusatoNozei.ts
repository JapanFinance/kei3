// Copyright the original author or authors
// SPDX-License-Identifier: AGPL-3.0-or-later

import type { FurusatoNozeiDetails } from '../types/tax';

// The nominal out-of-pocket cost at the limit is 2,000 yen. The residence tax
// credits are floored to 100 yen separately for the municipal and prefectural
// portions, so an ordinary result lands up to about 200 yen above the nominal
// figure; only a cost above that margin means the bracket shift described on
// the Furusato Nozei tab has actually raised the cost.
const OUT_OF_POCKET_WARNING_THRESHOLD = 2200;

export const hasHighOutOfPocketCost = (furusatoNozei: FurusatoNozeiDetails): boolean =>
  furusatoNozei.outOfPocketCost > OUT_OF_POCKET_WARNING_THRESHOLD;
