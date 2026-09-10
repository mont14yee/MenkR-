import React, { createContext, useContext, ReactNode } from 'react';
import { Client } from '../types';
import { useLocalStorage } from '../hooks/useLocalStorage';
import { generateId } from '../utils/id';

interface ClientsContextValue {
  clients: Client[];
  addClient: (client: Omit<Client, 'id'>) => void;
  updateClient: (id: string, updates: Partial<Client>) => void;
  deleteClient: (id: string) => void;
}

const ClientsContext = createContext<ClientsContextValue | undefined>(undefined);

const initialClients: Client[] = [];

export function ClientsProvider({ children }: { children: ReactNode }) {
  const [clients, setClients] = useLocalStorage<Client[]>('menkir-clients', initialClients);

  const addClient = (client: Omit<Client, 'id'>) => {
    const newClient: Client = { ...client, id: generateId() };
    setClients((prev) => [...prev, newClient]);
  };

  const updateClient = (id: string, updates: Partial<Client>) => {
    setClients((prev) => prev.map((c) => (c.id === id ? { ...c, ...updates } : c)));
  };

  const deleteClient = (id: string) => {
    setClients((prev) => prev.filter((c) => c.id !== id));
  };

  return (
    <ClientsContext.Provider value={{ clients, addClient, updateClient, deleteClient }}>
      {children}
    </ClientsContext.Provider>
  );
}

export function useClients() {
  const context = useContext(ClientsContext);
  if (!context) {
    throw new Error('useClients must be used within a ClientsProvider');
  }
  return context;
}
