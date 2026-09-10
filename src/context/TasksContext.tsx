import React, { createContext, useContext, ReactNode } from 'react';
import { TaskItem } from '../types';
import { useLocalStorage } from '../hooks/useLocalStorage';
import { generateId } from '../utils/id';

interface TasksContextType {
  tasks: TaskItem[];
  addTask: (task: Omit<TaskItem, 'id'>) => string;
  updateTask: (id: string, updates: Partial<TaskItem>) => void;
  deleteTask: (id: string) => void;
  completeTask: (id: string) => void;
}

const TasksContext = createContext<TasksContextType | undefined>(undefined);

export function TasksProvider({ children }: { children: ReactNode }) {
  const [tasks, setTasks] = useLocalStorage<TaskItem[]>('menkir-tasks', []);

  const addTask = (task: Omit<TaskItem, 'id'>) => {
    const newTask: TaskItem = { ...task, id: generateId(), createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() };
    setTasks((prev) => [...prev, newTask]);
    return newTask.id;
  };

  const updateTask = (id: string, updates: Partial<TaskItem>) => {
    setTasks((prev) => prev.map((t) => (t.id === id ? { updatedAt: new Date().toISOString(), ...t, ...updates } : t)));
  };

  const deleteTask = (id: string) => {
    setTasks((prev) => prev.filter((t) => t.id !== id));
  };

  const completeTask = (id: string) => {
    setTasks((prev) =>
      prev.map((t) =>
        t.id === id ? { ...t, status: t.status === 'done' ? 'active' : 'done' } : t
      )
    );
  };

  return (
    <TasksContext.Provider value={{ tasks, addTask, updateTask, deleteTask, completeTask }}>
      {children}
    </TasksContext.Provider>
  );
}

export function useTasks() {
  const context = useContext(TasksContext);
  if (!context) {
    throw new Error('useTasks must be used within a TasksProvider');
  }
  return context;
}
