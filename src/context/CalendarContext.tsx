import React, { createContext, useContext, ReactNode } from 'react';
import { EventItem } from '../types';
import { useLocalStorage } from '../hooks/useLocalStorage';
import { generateId } from '../utils/id';

interface CalendarContextType {
  events: EventItem[];
  addEvent: (event: Omit<EventItem, 'id'>) => string;
  updateEvent: (id: string, updates: Partial<EventItem>) => void;
  deleteEvent: (id: string) => void;
}

const CalendarContext = createContext<CalendarContextType | undefined>(undefined);

export function CalendarProvider({ children }: { children: ReactNode }) {
  const [events, setEvents] = useLocalStorage<EventItem[]>('menkir-events', []);

  const addEvent = (event: Omit<EventItem, 'id'>) => {
    const newEvent: EventItem = { ...event, id: generateId(), createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() };
    setEvents((prev) => [...prev, newEvent]);
    return newEvent.id;
  };

  const updateEvent = (id: string, updates: Partial<EventItem>) => {
    setEvents((prev) => prev.map((e) => (e.id === id ? { updatedAt: new Date().toISOString(), ...e, ...updates } : e)));
  };

  const deleteEvent = (id: string) => {
    setEvents((prev) => prev.filter((e) => e.id !== id));
  };

  return (
    <CalendarContext.Provider value={{ events, addEvent, updateEvent, deleteEvent }}>
      {children}
    </CalendarContext.Provider>
  );
}

export function useCalendar() {
  const context = useContext(CalendarContext);
  if (!context) {
    throw new Error('useCalendar must be used within a CalendarProvider');
  }
  return context;
}
