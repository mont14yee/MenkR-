import React, { useState } from 'react';
import { Download, X, Smartphone } from 'lucide-react';
import { usePWAInstall } from '../hooks/usePWAInstall';
import { PWAInstallModal } from './PWAInstallModal';

interface PWAInstallBannerProps {
  className?: string;
  forceVisible?: boolean;
}

export function PWAInstallBanner({ className = '', forceVisible = false }: PWAInstallBannerProps) {
  const { isInstalled, isIOS, showGuideModal, setShowGuideModal, install } = usePWAInstall();
  const [isDismissed, setIsDismissed] = useState(() => {
    try {
      const dismissed = localStorage.getItem('menkir-pwa-banner-dismissed');
      if (!dismissed) return false;
      const dismissedAt = parseInt(dismissed, 10);
      // Re-surface after 7 days if not installed
      return Date.now() - dismissedAt < 7 * 24 * 60 * 60 * 1000;
    } catch {
      return false;
    }
  });

  const handleDismiss = () => {
    setIsDismissed(true);
    try {
      localStorage.setItem('menkir-pwa-banner-dismissed', Date.now().toString());
    } catch {
      // ignore
    }
  };

  // If already installed as PWA or dismissed (and not force-visible), don't render
  if ((isInstalled || isDismissed) && !forceVisible) {
    return <PWAInstallModal isOpen={showGuideModal} onClose={() => setShowGuideModal(false)} isIOS={isIOS} />;
  }

  return (
    <>
      <div 
        className={`bg-surface-neutral/90 backdrop-blur-md border-b border-bd-subtle px-4 py-2.5 flex items-center justify-between gap-3 text-xs z-30 transition-all ${className}`}
        role="region"
        aria-label="Add to Home Screen"
      >
        <div className="flex items-center gap-2.5 min-w-0">
          <img 
            src="/icon-192.png" 
            alt="MenkiR Icon" 
            className="w-8 h-8 rounded-lg shadow-2xs border border-bd-subtle object-cover shrink-0" 
          />
          <div className="min-w-0">
            <p className="font-semibold text-tx-primary truncate">
              Install MenkiR
            </p>
            <p className="text-[11px] text-tx-muted truncate">
              Add to Home Screen for fast offline app access
            </p>
          </div>
        </div>

        <div className="flex items-center gap-1.5 shrink-0">
          <button
            onClick={() => install()}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-accent-primary text-tx-primary font-semibold text-xs hover:opacity-90 active:scale-95 transition-all shadow-2xs"
            aria-label="Add MenkiR to Home Screen"
          >
            <Download size={13} />
            <span>Install</span>
          </button>
          
          <button
            onClick={handleDismiss}
            className="p-1.5 rounded-lg text-tx-muted hover:text-tx-primary hover:bg-surface-neutral active:scale-90 transition-all"
            aria-label="Dismiss install banner"
          >
            <X size={15} />
          </button>
        </div>
      </div>

      <PWAInstallModal 
        isOpen={showGuideModal} 
        onClose={() => setShowGuideModal(false)} 
        isIOS={isIOS} 
      />
    </>
  );
}
