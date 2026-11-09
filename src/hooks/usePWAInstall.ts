import { useEffect, useState, useCallback } from 'react';

export interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed'; platform: string }>;
}

export function usePWAInstall() {
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [isInstalled, setIsInstalled] = useState(false);
  const [isIOS, setIsIOS] = useState(false);
  const [isMobile, setIsMobile] = useState(false);
  const [showGuideModal, setShowGuideModal] = useState(false);

  useEffect(() => {
    // Detect standalone display mode (already installed on Home Screen / Desktop app)
    const checkIsStandalone = () => {
      try {
        const isStandaloneMedia =
          typeof window !== 'undefined' && typeof window.matchMedia === 'function'
            ? window.matchMedia('(display-mode: standalone)').matches
            : false;
        const isIOSStandalone =
          typeof window !== 'undefined' &&
          (window.navigator as unknown as { standalone?: boolean })?.standalone === true;
        return isStandaloneMedia || isIOSStandalone;
      } catch {
        return false;
      }
    };

    setIsInstalled(checkIsStandalone());

    let cleanupMedia: (() => void) | undefined;
    if (typeof window !== 'undefined' && typeof window.matchMedia === 'function') {
      try {
        const mediaQuery = window.matchMedia('(display-mode: standalone)');
        const handleMediaChange = (e: MediaQueryListEvent) => {
          setIsInstalled(e.matches);
        };
        if (typeof mediaQuery.addEventListener === 'function') {
          mediaQuery.addEventListener('change', handleMediaChange);
          cleanupMedia = () => mediaQuery.removeEventListener('change', handleMediaChange);
        } else if (typeof (mediaQuery as any).addListener === 'function') {
          (mediaQuery as any).addListener(handleMediaChange);
          cleanupMedia = () => (mediaQuery as any).removeListener(handleMediaChange);
        }
      } catch {
        // Safe fallback in restricted media environments
      }
    }

    // Detect mobile device user-agent
    const userAgent = typeof navigator !== 'undefined' ? (navigator.userAgent || '').toLowerCase() : '';
    const isIOSDevice = /iphone|ipad|ipod/.test(userAgent);
    const isMobileDevice = isIOSDevice || /android|mobile|webos|blackberry|iemobile|opera mini/.test(userAgent);

    setIsIOS(isIOSDevice);
    setIsMobile(isMobileDevice);

    const handleBeforeInstallPrompt = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e as BeforeInstallPromptEvent);
    };

    const handleAppInstalled = () => {
      setIsInstalled(true);
      setDeferredPrompt(null);
      setShowGuideModal(false);
    };

    if (typeof window !== 'undefined') {
      window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
      window.addEventListener('appinstalled', handleAppInstalled);
    }

    return () => {
      cleanupMedia?.();
      if (typeof window !== 'undefined') {
        window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
        window.removeEventListener('appinstalled', handleAppInstalled);
      }
    };
  }, []);

  const install = useCallback(async (): Promise<boolean> => {
    if (deferredPrompt) {
      try {
        await deferredPrompt.prompt();
        const { outcome } = await deferredPrompt.userChoice;
        if (outcome === 'accepted') {
          setIsInstalled(true);
          setDeferredPrompt(null);
          setShowGuideModal(false);
          return true;
        }
      } catch (err) {
        console.warn('PWA install prompt error:', err);
      }
      return false;
    }

    // If native prompt is not available (iOS Safari, or browsers where prompt event hasn't fired yet)
    setShowGuideModal(true);
    return false;
  }, [deferredPrompt]);

  return {
    isInstallable: !!deferredPrompt,
    isInstalled,
    isIOS,
    isMobile,
    showGuideModal,
    setShowGuideModal,
    install,
  };
}
