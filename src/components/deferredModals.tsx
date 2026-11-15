// Copyright the original author or authors
// SPDX-License-Identifier: AGPL-3.0-or-later

import { useEffect, useSyncExternalStore, type ComponentProps, type ComponentType } from 'react';

import {
  changelogModalStore,
  inputModalsStore,
  type ChangelogModule,
  type DeferredModuleStore,
  type InputModalsModule,
} from '../utils/deferredModules';
import ModalLoadingDialog from './ui/ModalLoadingDialog';

interface ModalProps {
  open: boolean;
  onClose: () => void;
}

/**
 * Wraps a deferred modal module without `React.lazy` + `Suspense`:
 * - When the module has already finished background-loading, renders the real
 *   dialog synchronously on the click render so zero loading UI appears.
 * - While still downloading, avoids React's 300 ms `FALLBACK_THROTTLE_MS` so
 *   fast fetches swap in before `ModalLoadingDialog`'s 150 ms spinner delay.
 */
function createDeferredModal<TModule, P extends ModalProps>(
  store: DeferredModuleStore<TModule>,
  selectComponent: (mod: TModule) => ComponentType<P>,
  loadingAriaLabel: string,
  displayName: string,
): ComponentType<P> {
  function DeferredModal(props: P) {
    const mod = useSyncExternalStore(store.subscribe, store.getSnapshot);

    useEffect(() => {
      if (props.open && !mod) {
        store.request();
      }
    }, [props.open, mod]);

    if (!mod) {
      return props.open ? (
        <ModalLoadingDialog onClose={props.onClose} ariaLabel={loadingAriaLabel} />
      ) : null;
    }

    const Modal = selectComponent(mod);
    return <Modal {...props} />;
  }

  DeferredModal.displayName = displayName;
  return DeferredModal;
}

function createDeferredInputModal<K extends keyof InputModalsModule>(
  exportName: K,
  loadingAriaLabel: string,
) {
  return createDeferredModal<InputModalsModule, ComponentProps<InputModalsModule[K]>>(
    inputModalsStore,
    mod => mod[exportName] as ComponentType<ComponentProps<InputModalsModule[K]>>,
    loadingAriaLabel,
    exportName,
  );
}

export const AdditionalDeductionsModal = createDeferredInputModal(
  'AdditionalDeductionsModal',
  'Loading additional deductions dialog',
);

export const DependentsModal = createDeferredInputModal(
  'DependentsModal',
  'Loading dependents dialog',
);

export const IncomeDetailsModal = createDeferredInputModal(
  'IncomeDetailsModal',
  'Loading income details dialog',
);

export const ChangelogModal = createDeferredModal<
  ChangelogModule,
  ComponentProps<ChangelogModule['default']>
>(changelogModalStore, mod => mod.default, 'Loading changelog', 'ChangelogModal');
