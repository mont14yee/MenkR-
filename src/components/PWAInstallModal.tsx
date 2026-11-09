import React, { useEffect } from 'react';
import { X, Share, PlusSquare, Smartphone, Check, ArrowRight } from 'lucide-react';

interface PWAInstallModalProps {
  isOpen: boolean;
  onClose: () => void;
  isIOS: boolean;
}

export function PWAInstallModal({ isOpen, onClose, isIOS }: PWAInstallModalProps) {
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    if (isOpen) {
      window.addEventListener('keydown', handleKeyDown);
    }
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  return (
    <div 
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-in fade-in duration-200"
      role="dialog"
      aria-modal="true"
      aria-labelledby="pwa-install-title"
    >
      <div 
        className="w-full max-w-sm rounded-2xl bg-canvas border border-bd-subtle shadow-2xl p-6 relative overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Close Button */}
        <button
          onClick={onClose}
          className="absolute top-4 right-4 p-1.5 rounded-lg text-tx-muted hover:text-tx-primary hover:bg-surface-neutral transition-colors"
          aria-label="Close dialog"
        >
          <X size={18} />
        </button>

        {/* Header with App Icon */}
        <div className="flex items-center gap-3.5 mb-4">
          <img 
            src="/icon-192.png" 
            alt="MenkiR Icon" 
            className="w-12 h-12 rounded-xl shadow-xs border border-bd-subtle object-cover" 
          />
          <div>
            <h3 id="pwa-install-title" className="text-base font-semibold text-tx-primary leading-tight">
              Add MenkiR to Home Screen
            </h3>
            <p className="text-xs text-tx-muted mt-0.5">
              Launch directly as a full-screen mobile app
            </p>
          </div>
        </div>

        {/* Benefits */}
        <div className="bg-surface-neutral/60 rounded-xl p-3 mb-5 border border-bd-subtle/80 space-y-1.5 text-xs text-tx-secondary">
          <div className="flex items-center gap-2">
            <Check size={14} className="text-accent-primary shrink-0" />
            <span>Fast instant launch without browser address bars</span>
          </div>
          <div className="flex items-center gap-2">
            <Check size={14} className="text-accent-primary shrink-0" />
            <span>Works offline with cached data & timer tracking</span>
          </div>
          <div className="flex items-center gap-2">
            <Check size={14} className="text-accent-primary shrink-0" />
            <span>Zero app-store installation required</span>
          </div>
        </div>

        {/* Step-by-Step Instructions */}
        {isIOS ? (
          <div className="space-y-3 mb-5">
            <p className="text-xs font-semibold text-tx-muted uppercase tracking-wider">
              Follow these Safari steps:
            </p>
            <div className="flex items-start gap-3 bg-surface-neutral/40 p-2.5 rounded-xl border border-bd-subtle/60 text-xs text-tx-primary">
              <div className="w-6 h-6 rounded-lg bg-surface-neutral flex items-center justify-center shrink-0 text-tx-primary mt-0.5">
                <Share size={14} />
              </div>
              <div>
                <span className="font-semibold">Step 1:</span> Tap the <strong className="text-tx-primary">Share</strong> button in Safari toolbar at the bottom of the screen.
              </div>
            </div>

            <div className="flex items-start gap-3 bg-surface-neutral/40 p-2.5 rounded-xl border border-bd-subtle/60 text-xs text-tx-primary">
              <div className="w-6 h-6 rounded-lg bg-surface-neutral flex items-center justify-center shrink-0 text-tx-primary mt-0.5">
                <PlusSquare size={14} />
              </div>
              <div>
                <span className="font-semibold">Step 2:</span> Scroll down and tap <strong className="text-tx-primary">Add to Home Screen</strong>.
              </div>
            </div>

            <div className="flex items-start gap-3 bg-surface-neutral/40 p-2.5 rounded-xl border border-bd-subtle/60 text-xs text-tx-primary">
              <div className="w-6 h-6 rounded-lg bg-surface-neutral flex items-center justify-center shrink-0 text-tx-primary mt-0.5">
                <Check size={14} />
              </div>
              <div>
                <span className="font-semibold">Step 3:</span> Tap <strong className="text-tx-primary">Add</strong> in the top-right corner to complete.
              </div>
            </div>
          </div>
        ) : (
          <div className="space-y-3 mb-5">
            <p className="text-xs font-semibold text-tx-muted uppercase tracking-wider">
              Follow browser menu steps:
            </p>
            <div className="flex items-start gap-3 bg-surface-neutral/40 p-2.5 rounded-xl border border-bd-subtle/60 text-xs text-tx-primary">
              <div className="w-6 h-6 rounded-lg bg-surface-neutral flex items-center justify-center shrink-0 text-tx-primary font-bold mt-0.5">
                ⋮
              </div>
              <div>
                <span className="font-semibold">Step 1:</span> Tap the browser menu (<strong className="text-tx-primary">⋮</strong>) in the top-right corner.
              </div>
            </div>

            <div className="flex items-start gap-3 bg-surface-neutral/40 p-2.5 rounded-xl border border-bd-subtle/60 text-xs text-tx-primary">
              <div className="w-6 h-6 rounded-lg bg-surface-neutral flex items-center justify-center shrink-0 text-tx-primary mt-0.5">
                <Smartphone size={14} />
              </div>
              <div>
                <span className="font-semibold">Step 2:</span> Select <strong className="text-tx-primary">Add to Home screen</strong> or <strong className="text-tx-primary">Install app</strong>.
              </div>
            </div>
          </div>
        )}

        <button
          onClick={onClose}
          className="w-full py-2.5 px-4 rounded-xl bg-accent-primary text-tx-primary text-xs font-semibold hover:opacity-95 transition-all shadow-xs"
        >
          Got it
        </button>
      </div>
    </div>
  );
}
