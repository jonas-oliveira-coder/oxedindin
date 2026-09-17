import { useEffect, useRef } from 'react';
import { registerSW } from 'virtual:pwa-register';

export interface PwaRegistration {
  needRefresh: boolean;
  offlineReady: boolean;
  updateServiceWorker: (reload?: boolean) => Promise<void>;
}

export function usePwaRegister(onUpdate: () => void, onReady: () => void): PwaRegistration {
  const stateRef = useRef<PwaRegistration>({
    needRefresh: false,
    offlineReady: false,
    updateServiceWorker: async () => {},
  });

  useEffect(() => {
    const updateSW = registerSW({
      immediate: true,
      onNeedRefresh() {
        stateRef.current = { ...stateRef.current, needRefresh: true };
        onUpdate();
      },
      onOfflineReady() {
        stateRef.current = { ...stateRef.current, offlineReady: true };
        onReady();
      },
    });

    stateRef.current.updateServiceWorker = async (reload?: boolean) => {
      await updateSW(reload);
    };

    return () => {};
  }, [onUpdate, onReady]);

  return stateRef.current;
}