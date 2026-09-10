import React, { ReactNode, useState, useEffect, useRef } from 'react';
import { X } from 'lucide-react';
import { Header } from './Shared';

export function BottomSheet({
  isOpen,
  onClose,
  title,
  children,
  onSave,
  saveLabel = 'Save',
  secondaryAction,
}: {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  children: ReactNode;
  onSave?: () => void;
  saveLabel?: string;
  secondaryAction?: ReactNode;
}) {
  const sheetRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (isOpen) {
      const handleKeyDown = (e: KeyboardEvent) => {
        if (e.key === 'Escape') {
          onClose();
        }
      };
      document.addEventListener('keydown', handleKeyDown);
      return () => document.removeEventListener('keydown', handleKeyDown);
    }
  }, [isOpen, onClose]);

  if (!isOpen) return null;

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
          {onSave && (
            <button
              onClick={onSave}
              className="w-full py-3.5 rounded-full bg-tx-primary text-tx-inverse text-[15px] font-medium active:opacity-80 transition-opacity focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-canvas focus:ring-tx-primary"
            >
              {saveLabel}
            </button>
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
