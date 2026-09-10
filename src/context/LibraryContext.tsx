import React, { createContext, useContext, ReactNode } from 'react';
import { LibraryItem } from '../types';
import { useLocalStorage } from '../hooks/useLocalStorage';
import { generateId } from '../utils/id';

interface LibraryContextType {
  library: LibraryItem[];
  addLibraryItem: (item: Omit<LibraryItem, 'id' | 'createdAt' | 'updatedAt'>) => void;
  updateLibraryItem: (id: string, updates: Partial<LibraryItem>) => void;
  deleteLibraryItem: (id: string) => void;
}

const LibraryContext = createContext<LibraryContextType | undefined>(undefined);

export function LibraryProvider({ children }: { children: ReactNode }) {
  const [library, setLibrary] = useLocalStorage<LibraryItem[]>('menkir-library', []);

  const addLibraryItem = (item: Omit<LibraryItem, 'id' | 'createdAt' | 'updatedAt'>) => {
    const now = new Date().toISOString();
    const newItem: LibraryItem = { 
      ...item, 
      id: generateId(),
      createdAt: now,
      updatedAt: now,
    };
    setLibrary((prev) => [...prev, newItem]);
  };

  const updateLibraryItem = (id: string, updates: Partial<LibraryItem>) => {
    const now = new Date().toISOString();
    setLibrary((prev) => prev.map((t) => (t.id === id ? { ...t, ...updates, updatedAt: now } : t)));
  };

  const deleteLibraryItem = (id: string) => {
    setLibrary((prev) => prev.filter((t) => t.id !== id));
  };

  return (
    <LibraryContext.Provider value={{ library, addLibraryItem, updateLibraryItem, deleteLibraryItem }}>
      {children}
    </LibraryContext.Provider>
  );
}

export function useLibrary() {
  const context = useContext(LibraryContext);
  if (!context) {
    throw new Error('useLibrary must be used within a LibraryProvider');
  }
  return context;
}
