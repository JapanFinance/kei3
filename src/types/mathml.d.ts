// Copyright the original author or authors
// SPDX-License-Identifier: AGPL-3.0-or-later

import React from 'react';

declare module 'react/jsx-runtime' {
    namespace JSX {
        interface IntrinsicElements {
            math: React.DetailedHTMLProps<React.HTMLAttributes<HTMLElement>, HTMLElement>;
            mrow: React.DetailedHTMLProps<React.HTMLAttributes<HTMLElement>, HTMLElement>;
            mn: React.DetailedHTMLProps<React.HTMLAttributes<HTMLElement>, HTMLElement>;
            mo: React.DetailedHTMLProps<React.HTMLAttributes<HTMLElement>, HTMLElement>;
            mi: React.DetailedHTMLProps<React.HTMLAttributes<HTMLElement>, HTMLElement>;
            msqrt: React.DetailedHTMLProps<React.HTMLAttributes<HTMLElement>, HTMLElement>;
            frac: React.DetailedHTMLProps<React.HTMLAttributes<HTMLElement>, HTMLElement>;
        }
    }
}
