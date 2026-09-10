import React, { useEffect, useRef } from 'react';
import { AlertTriangle } from 'lucide-react';

interface ConfirmDialogProps {
  isOpen: boolean;
  onCancel: () => void;
  onConfirm: () => void;
  title: string;
  body?: string;
  confirmLabel?: string;
  cancelLabel?: string;
  danger?: boolean;
}

export function ConfirmDialog({
  isOpen,
  onCancel,
  onConfirm,
  title,
  body,
  confirmLabel = 'Delete',
  cancelLabel = 'Cancel',
  danger = true,
}: ConfirmDialogProps) {
  const confirmRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (isOpen) {
      // Focus the cancel button (or confirm button) when opened for accessibility
      // We focus confirm button by default if it's not danger, otherwise cancel
      if (confirmRef.current && !danger) {
        confirmRef.current.focus();
      }
      
      const handleKeyDown = (e: KeyboardEvent) => {
        if (e.key === 'Escape') {
          onCancel();
        }
      };
      document.addEventListener('keydown', handleKeyDown);
      return () => document.removeEventListener('keydown', handleKeyDown);
    }
  }, [isOpen, onCancel, danger]);

  if (!isOpen) return null;

  return (
    <>
      <div 
        className="fixed inset-0 z-[60] bg-black/40 backdrop-blur-sm transition-opacity animate-in fade-in duration-200"
        onClick={onCancel}
        aria-hidden="true"
      />
      <div 
        className="fixed inset-0 z-[60] flex items-center justify-center p-4 pointer-events-none"
        role="dialog"
        aria-modal="true"
        aria-labelledby="dialog-title"
        aria-describedby={body ? "dialog-body" : undefined}
      >
        <div className="w-full max-w-[320px] bg-canvas rounded-2xl p-6 shadow-2xl pointer-events-auto flex flex-col gap-4 animate-in zoom-in-95 duration-200">
          <div className="flex flex-col gap-2 text-center items-center">
            {danger && (
              <div className="w-12 h-12 rounded-full bg-red-500/10 text-red-500 flex items-center justify-center mb-1">
                <AlertTriangle size={24} />
              </div>
            )}
            <h2 id="dialog-title" className="text-[18px] font-semibold text-tx-primary leading-tight">{title}</h2>
            {body && (
              <div id="dialog-body" className="text-[14px] text-tx-muted leading-relaxed">
                {body}
              </div>
            )}
          </div>
          <div className="flex gap-3 mt-4">
            <button
              onClick={onCancel}
              autoFocus={danger} // Default focus on cancel if dangerous
              className="flex-1 py-2.5 rounded-xl font-medium text-[15px] bg-surface-neutral text-tx-primary active:opacity-80 transition-opacity focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 focus:ring-offset-canvas"
            >
              {cancelLabel}
            </button>
            <button
              ref={confirmRef}
              onClick={() => {
                onConfirm();
                onCancel();
              }}
              className={`flex-1 py-2.5 rounded-xl font-medium text-[15px] active:opacity-80 transition-opacity focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-canvas ${
                danger ? 'bg-red-500 text-white focus:ring-red-500' : 'bg-tx-primary text-tx-inverse focus:ring-blue-500'
              }`}
            >
              {confirmLabel}
            </button>
          </div>
        </div>
      </div>
    </>
  );
}
