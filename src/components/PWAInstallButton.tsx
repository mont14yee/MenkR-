import React from 'react';
import { Download, Smartphone } from 'lucide-react';
import { usePWAInstall } from '../hooks/usePWAInstall';
import { PWAInstallModal } from './PWAInstallModal';

interface PWAInstallButtonProps {
  className?: string;
  variant?: 'primary' | 'secondary' | 'outline' | 'subtle';
  size?: 'sm' | 'md';
  showLabel?: boolean;
}

export function PWAInstallButton({
  className = '',
  variant = 'outline',
  size = 'sm',
  showLabel = true,
}: PWAInstallButtonProps) {
  const { isInstalled, isIOS, showGuideModal, setShowGuideModal, install } = usePWAInstall();

  // If already running in standalone mode (already installed), suppress the button
  if (isInstalled) {
    return null;
  }

  const baseStyles = 'inline-flex items-center justify-center gap-2 rounded-xl font-medium transition-all active:scale-95 cursor-pointer';
  
  const sizeStyles = size === 'sm' ? 'px-3 py-1.5 text-xs' : 'px-4 py-2 text-sm';
  
  const variantStyles = {
    primary: 'bg-accent-primary text-tx-primary hover:opacity-95 shadow-xs font-semibold',
    secondary: 'bg-surface-neutral text-tx-primary hover:bg-surface-neutral/80 border border-bd-subtle',
    outline: 'border border-bd-subtle text-tx-primary hover:bg-surface-neutral',
    subtle: 'text-tx-secondary hover:text-tx-primary hover:bg-surface-neutral/60',
  }[variant];

  return (
    <>
      <button
        onClick={() => install()}
        className={`${baseStyles} ${sizeStyles} ${variantStyles} ${className}`}
        aria-label="Add to Home Screen"
        title="Add MenkiR to Home Screen"
      >
        <Smartphone size={size === 'sm' ? 14 : 16} className="shrink-0 text-accent-primary" />
        {showLabel && <span>Add to Home Screen</span>}
      </button>

      <PWAInstallModal
        isOpen={showGuideModal}
        onClose={() => setShowGuideModal(false)}
        isIOS={isIOS}
      />
    </>
  );
}
