// Copyright the original author or authors
// SPDX-License-Identifier: AGPL-3.0-or-later

import ModalLoadingDialog from './ui/ModalLoadingDialog';

/**
 * Stands in for {@link import('./ChangelogModal')} while its module is still
 * loading, so opening the changelog has a visible effect when the wait is long
 * enough to notice.
 */
export default function ChangelogLoadingDialog({ onClose }: { onClose: () => void }) {
  return <ModalLoadingDialog onClose={onClose} ariaLabel="Loading changelog" />;
}
