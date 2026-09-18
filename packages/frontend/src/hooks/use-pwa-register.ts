import { useEffect } from 'react';
import { registerSW } from 'virtual:pwa-register';

export function usePwaRegister(): void {
  useEffect(() => {
    registerSW({ immediate: true });
  }, []);
}