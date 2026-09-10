import React, { createContext, useContext, ReactNode } from 'react';
import { TemplateItem } from '../types';
import { useLocalStorage } from '../hooks/useLocalStorage';
import { generateId } from '../utils/id';

interface TemplatesContextType {
  templates: TemplateItem[];
  addTemplate: (template: Omit<TemplateItem, 'id' | 'createdAt' | 'updatedAt'>) => void;
  updateTemplate: (id: string, updates: Partial<TemplateItem>) => void;
  deleteTemplate: (id: string) => void;
}

const TemplatesContext = createContext<TemplatesContextType | undefined>(undefined);

export function TemplatesProvider({ children }: { children: ReactNode }) {
  const [templates, setTemplates] = useLocalStorage<TemplateItem[]>('menkir-templates', []);

  const addTemplate = (template: Omit<TemplateItem, 'id' | 'createdAt' | 'updatedAt'>) => {
    const now = new Date().toISOString();
    const newTemplate: TemplateItem = { 
      ...template, 
      id: generateId(),
      createdAt: now,
      updatedAt: now,
    };
    setTemplates((prev) => [...prev, newTemplate]);
  };

  const updateTemplate = (id: string, updates: Partial<TemplateItem>) => {
    const now = new Date().toISOString();
    setTemplates((prev) => prev.map((t) => (t.id === id ? { ...t, ...updates, updatedAt: now } : t)));
  };

  const deleteTemplate = (id: string) => {
    setTemplates((prev) => prev.filter((t) => t.id !== id));
  };

  return (
    <TemplatesContext.Provider value={{ templates, addTemplate, updateTemplate, deleteTemplate }}>
      {children}
    </TemplatesContext.Provider>
  );
}

export function useTemplates() {
  const context = useContext(TemplatesContext);
  if (!context) {
    throw new Error('useTemplates must be used within a TemplatesProvider');
  }
  return context;
}
