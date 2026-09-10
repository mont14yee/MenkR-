import React, { createContext, useContext, ReactNode } from 'react';
import { RevenueEntry } from '../types';
import { useLocalStorage } from '../hooks/useLocalStorage';
import { generateId } from '../utils/id';

interface RevenueContextType {
  revenues: RevenueEntry[];
  yearlyGoal: number;
  addRevenue: (revenue: Omit<RevenueEntry, 'id'>) => void;
  updateRevenue: (id: string, updates: Partial<RevenueEntry>) => void;
  deleteRevenue: (id: string) => void;
  setYearlyGoal: (amount: number) => void;
}

const RevenueContext = createContext<RevenueContextType | undefined>(undefined);

export function RevenueProvider({ children }: { children: ReactNode }) {
  const [revenues, setRevenues] = useLocalStorage<RevenueEntry[]>('menkir-revenue', []);
  const [yearlyGoal, setYearlyGoal] = useLocalStorage<number>('menkir-yearly-goal', 8367);

  const addRevenue = (revenue: Omit<RevenueEntry, 'id'>) => {
    const newRevenue: RevenueEntry = { ...revenue, id: generateId(), createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() };
    setRevenues((prev) => [...prev, newRevenue]);
  };

  const updateRevenue = (id: string, updates: Partial<RevenueEntry>) => {
    setRevenues((prev) => prev.map((r) => (r.id === id ? { updatedAt: new Date().toISOString(), ...r, ...updates } : r)));
  };

  const deleteRevenue = (id: string) => {
    setRevenues((prev) => prev.filter((r) => r.id !== id));
  };

  return (
    <RevenueContext.Provider value={{ revenues, yearlyGoal, addRevenue, updateRevenue, deleteRevenue, setYearlyGoal }}>
      {children}
    </RevenueContext.Provider>
  );
}

export function useRevenue() {
  const context = useContext(RevenueContext);
  if (!context) {
    throw new Error('useRevenue must be used within a RevenueProvider');
  }
  return context;
}
