import React, { ReactNode, useState, useEffect, useRef } from 'react';
import { X, Loader2, AlertCircle } from 'lucide-react';

export interface SaveActionButtonProps {
  onSave: () => void | boolean | Promise<void | boolean>;
  label?: string;
  savingLabel?: string;
  disabled?: boolean;
  isSaving?: boolean;
  onError?: (message: string | null) => void;
  className?: string;
  variant?: 'sheet' | 'compact';
  type?: 'button' | 'submit';
}

export function SaveActionButton({
  onSave,
  label = 'Save',
  savingLabel = 'Saving...',
  disabled = false,
  isSaving = false,
  onError,
  className = '',
  variant = 'sheet',
  type = 'button',
}: SaveActionButtonProps) {
  const [internalSaving, setInternalSaving] = useState(false);
  const submitLockRef = useRef(false);
  const isMountedRef = useRef(true);

  useEffect(() => {
    isMountedRef.current = true;
    return () => {
      isMountedRef.current = false;
    };
  }, []);

  const effectiveSaving = isSaving || internalSaving;

  const handleClick = async () => {
    if (disabled || effectiveSaving || submitLockRef.current) return;
    submitLockRef.current = true;
    onError?.(null);

    let failed = false;
    try {
      const result = onSave();
      if (result != null && typeof (result as Promise<unknown>).then === 'function') {
        if (isMountedRef.current) setInternalSaving(true);
        const resolved = await result;
        if (resolved === false) failed = true;
      } else if (result === false) {
        failed = true;
      }
    } catch (err: unknown) {
      failed = true;
      const message =
        err instanceof Error && err.message
          ? err.message
          : 'Unable to save changes. Please try again.';
      onError?.(message);
    } finally {
      if (isMountedRef.current) {
        setInternalSaving(false);
      }
      if (failed) {
        submitLockRef.current = false;
      } else {
        setTimeout(() => {
          submitLockRef.current = false;
        }, 120);
      }
    }
  };

  const variantClasses =
    variant === 'sheet'
      ? 'w-full py-3.5 rounded-full bg-tx-primary text-tx-inverse text-[15px] font-medium active:opacity-80 transition-opacity focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-canvas focus:ring-tx-primary disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2'
      : 'inline-flex items-center justify-center h-10 px-4 text-sm font-medium rounded-xl gap-2 bg-tx-primary text-canvas hover:bg-tx-primary/90 active:bg-tx-primary/80 shadow-xs border border-transparent transition-all duration-150 select-none focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-bd-focus focus-visible:ring-offset-2 focus-visible:ring-offset-canvas disabled:opacity-50 disabled:cursor-not-allowed active:scale-[0.98]';

  return (
    <button
      type={type}
      onClick={handleClick}
      disabled={disabled || effectiveSaving}
      aria-busy={effectiveSaving || undefined}
      className={`${variantClasses} ${className}`.trim()}
    >
      {effectiveSaving && (
        <Loader2 size={17} className="animate-spin shrink-0" aria-hidden="true" />
      )}
      <span>{effectiveSaving ? savingLabel : label}</span>
    </button>
  );
}

export interface BottomSheetProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  children: ReactNode;
  onSave?: () => void | boolean | Promise<void | boolean>;
  saveLabel?: string;
  savingLabel?: string;
  saveDisabled?: boolean;
  isSaving?: boolean;
  saveError?: string | null;
  onSaveError?: (error: string | null) => void;
  secondaryAction?: ReactNode;
}

export function BottomSheet({
  isOpen,
  onClose,
  title,
  children,
  onSave,
  saveLabel = 'Save',
  savingLabel = 'Saving...',
  saveDisabled = false,
  isSaving = false,
  saveError = null,
  onSaveError,
  secondaryAction,
}: BottomSheetProps) {
  const sheetRef = useRef<HTMLDivElement>(null);
  const [internalError, setInternalError] = useState<string | null>(null);

  useEffect(() => {
    if (!isOpen) {
      setInternalError(null);
      return;
    }
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      }
    };
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const displayedError = saveError || internalError;

  const handleError = (msg: string | null) => {
    setInternalError(msg);
    onSaveError?.(msg);
  };

  return (
    <>
      <div 
        className="fixed inset-0 bg-tx-primary/20 backdrop-blur-sm z-50 transition-opacity" 
        onClick={onClose} 
        aria-hidden="true"
      />
      <div 
        ref={sheetRef}
        tabIndex={-1}
        role="dialog"
        aria-modal="true"
        aria-label={title}
        className="fixed bottom-0 left-0 right-0 max-w-[430px] mx-auto bg-canvas rounded-t-[32px] z-50 flex flex-col max-h-[90vh] shadow-2xl animate-in slide-in-from-bottom duration-300 focus:outline-none"
      >
        <div className="flex items-center justify-between px-5 pt-4 pb-2 border-b border-bd-subtle shrink-0">
          <button onClick={onClose} className="w-10 h-10 flex items-center justify-center bg-surface-neutral rounded-full text-tx-primary focus:outline-none focus:ring-2 focus:ring-tx-primary focus:ring-offset-2 focus:ring-offset-canvas" aria-label="Close sheet">
            <X size={20} />
          </button>
          <h2 className="text-[17px] font-medium text-tx-primary flex-1 text-center">{title}</h2>
          <div className="w-10" />
        </div>
        
        <div className="flex-1 overflow-y-auto px-5 py-4 flex flex-col gap-4 no-scrollbar">
          {children}
        </div>
        
        <div className="p-5 border-t border-bd-subtle bg-canvas shrink-0 flex flex-col gap-2">
          {displayedError && (
            <div
              role="alert"
              className="px-3.5 py-2.5 rounded-xl bg-red-500/10 border border-red-500/25 text-red-600 text-[13px] font-medium flex items-center gap-2"
            >
              <AlertCircle size={15} className="shrink-0" aria-hidden="true" />
              <span className="leading-snug">{displayedError}</span>
            </div>
          )}
          {onSave && (
            <SaveActionButton
              onSave={onSave}
              label={saveLabel}
              savingLabel={savingLabel}
              disabled={saveDisabled}
              isSaving={isSaving}
              onError={handleError}
              variant="sheet"
            />
          )}
          {secondaryAction}
        </div>
      </div>
    </>
  );
}

export function BottomSheetField({ label, children, className = '' }: { label?: string; children: ReactNode; className?: string }) {
  return (
    <div className={`flex flex-col gap-1.5 ${className}`}>
      {label && <label className="text-[13px] font-medium text-tx-muted">{label}</label>}
      {children}
    </div>
  );
}

export function CategoryPicker({
  value,
  onChange,
  scope,
  categories,
  onAddCategory,
}: {
  value: string;
  onChange: (id: string) => void;
  scope: 'task' | 'event' | 'revenue';
  categories: any[];
  onAddCategory: (category: Omit<any, 'id'>) => void;
}) {
  const [isAdding, setIsAdding] = useState(false);
  const [newLabel, setNewLabel] = useState('');
  const filtered = categories.filter((c) => c.scope === scope);

  const handleAdd = () => {
    if (newLabel.trim()) {
      onAddCategory({ label: newLabel.trim(), color: '#888E80', scope });
      setNewLabel('');
    }
    setIsAdding(false);
  };

  return (
    <div className="flex flex-wrap gap-2">
      {filtered.map((cat) => (
        <button
          key={cat.id}
          onClick={() => onChange(cat.id)}
          className={`px-3 py-1.5 rounded-full text-[13px] font-medium transition-colors border ${
            value === cat.id 
              ? 'bg-tx-primary text-tx-inverse border-tx-primary' 
              : 'bg-canvas text-tx-primary border-bd-subtle'
          }`}
        >
          <div className="flex items-center gap-1.5">
            <div className="w-2 h-2 rounded-full" style={{ backgroundColor: cat.color }} />
            {cat.label}
          </div>
        </button>
      ))}
      {isAdding ? (
        <div className="flex items-center gap-1">
          <input 
            autoFocus
            type="text"
            value={newLabel}
            onChange={e => setNewLabel(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && handleAdd()}
            placeholder="Name..."
            className="px-3 py-1.5 rounded-full text-[13px] bg-canvas text-tx-primary border border-bd-subtle outline-none w-24"
          />
          <button onClick={handleAdd} className="px-3 py-1.5 rounded-full bg-tx-primary text-tx-inverse text-[13px] font-medium">
             Add
          </button>
        </div>
      ) : (
        <button
          onClick={() => setIsAdding(true)}
          className="px-3 py-1.5 rounded-full text-[13px] font-medium bg-surface-neutral text-tx-primary border border-transparent"
        >
          + New
        </button>
      )}
    </div>
  );
}
