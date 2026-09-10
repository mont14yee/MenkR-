import React, { createContext, useContext, ReactNode } from 'react';
import { MessageItem } from '../types';
import { useLocalStorage } from '../hooks/useLocalStorage';
import { generateId } from '../utils/id';

interface MessagesContextValue {
  messages: MessageItem[];
  addMessage: (msg: Omit<MessageItem, 'id' | 'createdAt'>) => void;
  deleteMessage: (id: string) => void;
  messagesForClient: (clientId: string) => MessageItem[];
  lastMessageForClient: (clientId: string) => MessageItem | undefined;
}

const MessagesContext = createContext<MessagesContextValue | undefined>(undefined);

export function MessagesProvider({ children }: { children: ReactNode }) {
  const [messages, setMessages] = useLocalStorage<MessageItem[]>('menkir-messages', []);

  const addMessage = (msg: Omit<MessageItem, 'id' | 'createdAt'>) => {
    const newMessage: MessageItem = {
      ...msg,
      id: generateId(),
      createdAt: new Date().toISOString()
    };
    setMessages((prev) => [newMessage, ...prev]);
  };

  const deleteMessage = (id: string) => {
    setMessages((prev) => prev.filter((m) => m.id !== id));
  };

  const messagesForClient = (clientId: string) => {
    return messages.filter((m) => m.clientId === clientId).sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  };

  const lastMessageForClient = (clientId: string) => {
    return messages.find((m) => m.clientId === clientId);
  };

  return (
    <MessagesContext.Provider value={{ messages, addMessage, deleteMessage, messagesForClient, lastMessageForClient }}>
      {children}
    </MessagesContext.Provider>
  );
}

export function useMessages() {
  const context = useContext(MessagesContext);
  if (!context) {
    throw new Error('useMessages must be used within a MessagesProvider');
  }
  return context;
}
