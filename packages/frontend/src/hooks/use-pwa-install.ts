import { useCallback, useEffect, useState } from 'react';

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed'; platform: string }>;
}

interface InstallState {
  canInstall: boolean;
  isStandalone: boolean;
  deferredPrompt: BeforeInstallPromptEvent | null;
}

export function isStandalone(): boolean {
  return window.matchMedia('(display-mode: standalone)').matches
    || (navigator as any).standalone === true;
}

export function usePwaInstall(): InstallState & {
  promptInstall: () => Promise<{ outcome: string; platform: string } | undefined>;
} {
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [canInstall, setCanInstall] = useState(false);
  const [isStandaloneMode, setIsStandaloneMode] = useState(false);

  useEffect(() => {
    const media = window.matchMedia('(display-mode: standalone)');

    const updateStandalone = () => setIsStandaloneMode(media.matches || (navigator as any).standalone === true);
    updateStandalone();
    media.addEventListener('change', updateStandalone);

    const onPrompt = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e as BeforeInstallPromptEvent);
      setCanInstall(true);
    };

    const onInstalled = () => {
      setCanInstall(false);
      setDeferredPrompt(null);
    };

    window.addEventListener('beforeinstallprompt', onPrompt);
    window.addEventListener('appinstalled', onInstalled);

    return () => {
      media.removeEventListener('change', updateStandalone);
      window.removeEventListener('beforeinstallprompt', onPrompt);
      window.removeEventListener('appinstalled', onInstalled);
    };
  }, []);

  const promptInstall = useCallback(async () => {
    if (!deferredPrompt) return undefined;
    deferredPrompt.prompt();
    const choice = await deferredPrompt.userChoice;
    setDeferredPrompt(null);
    setCanInstall(false);
    return { outcome: choice.outcome, platform: choice.platform };
  }, [deferredPrompt]);

  return { canInstall, isStandalone: isStandaloneMode, deferredPrompt, promptInstall };
}