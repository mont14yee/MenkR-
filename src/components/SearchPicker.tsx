import React, { useState } from 'react';
import { Search, X, ChevronDown, Check } from 'lucide-react';

interface SearchPickerItem {
  id: string;
  label: string;
  sublabel?: string;
}

interface SearchPickerProps {
  items: SearchPickerItem[];
  value?: string;
  onChange: (id: string) => void;
  onCreateNew?: (name: string) => string | void;
}

export function SearchPicker({
  items,
  value,
  onChange,
  onCreateNew,
}: SearchPickerProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [search, setSearch] = useState('');

  const selectedItem = items.find(i => i.id === value);

  const filteredItems = items.filter(i => 
    i.label.toLowerCase().includes(search.toLowerCase()) || 
    (i.sublabel && i.sublabel.toLowerCase().includes(search.toLowerCase()))
  );
  
  const showCreate = onCreateNew && search.trim() !== '' && !items.some(i => i.label.toLowerCase() === search.trim().toLowerCase());

  if (!isOpen && selectedItem) {
    return (
      <button 
        type="button"
        onClick={() => setIsOpen(true)} 
        className="inline-flex items-center gap-2 px-4 py-2 bg-surface-neutral text-tx-primary rounded-full text-[14px] font-medium active:opacity-80 transition-opacity w-fit max-w-full"
      >
        <span className="truncate">{selectedItem.label}</span>
        <ChevronDown size={16} className="text-tx-muted shrink-0 ml-1" />
      </button>
    );
  }

  return (
    <div className="flex flex-col gap-2 w-full">
      <div className="flex items-center gap-2 bg-surface-neutral rounded-xl px-4 py-3 border border-transparent focus-within:border-bd-subtle transition-colors">
        <Search size={18} className="text-tx-muted shrink-0" />
        <input 
          autoFocus={isOpen}
          type="text"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search..."
          className="flex-1 bg-transparent border-none outline-none text-[15px] text-tx-primary min-w-0"
        />
        {(isOpen && selectedItem) && (
          <button type="button" onClick={() => { setIsOpen(false); setSearch(''); }} className="p-1 text-tx-muted hover:text-tx-primary shrink-0" aria-label="Clear selection">
            <X size={16} />
          </button>
        )}
      </div>

      <div className="flex flex-col max-h-48 overflow-y-auto no-scrollbar rounded-xl border border-bd-subtle bg-canvas shadow-sm">
        {filteredItems.map(item => (
          <button
            key={item.id}
            type="button"
            onClick={() => {
              onChange(item.id);
              setIsOpen(false);
              setSearch('');
            }}
            className="flex items-center justify-between px-4 py-3 border-b border-bd-subtle/50 last:border-b-0 hover:bg-surface-neutral active:bg-surface-neutral text-left transition-colors"
          >
            <div className="flex flex-col min-w-0 pr-2">
              <span className="text-[15px] font-medium text-tx-primary truncate">{item.label}</span>
              {item.sublabel && <span className="text-[13px] text-tx-muted truncate">{item.sublabel}</span>}
            </div>
            {value === item.id && <Check size={18} className="text-tx-primary shrink-0" />}
          </button>
        ))}
        {showCreate && (
          <button
            type="button"
            onClick={() => {
              if (onCreateNew) {
                const newId = onCreateNew(search.trim());
                if (typeof newId === 'string') {
                  onChange(newId);
                }
              }
              setIsOpen(false);
              setSearch('');
            }}
            className="flex items-center gap-2 px-4 py-3 hover:bg-surface-neutral active:bg-surface-neutral text-left transition-colors text-tx-primary"
          >
            <span className="text-[15px] font-medium">Create <span className="font-semibold">"{search.trim()}"</span></span>
          </button>
        )}
        {filteredItems.length === 0 && !showCreate && (
          <div className="px-4 py-6 text-center text-tx-muted text-[14px]">No results found.</div>
        )}
      </div>
    </div>
  );
}
