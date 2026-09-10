import React, { createContext, useContext, ReactNode } from 'react';
import { ProjectItem } from '../types';
import { useLocalStorage } from '../hooks/useLocalStorage';
import { generateId } from '../utils/id';

interface ProjectsContextType {
  projects: ProjectItem[];
  addProject: (project: Omit<ProjectItem, 'id' | 'index'>) => string;
  updateProject: (id: string, updates: Partial<ProjectItem>) => void;
  deleteProject: (id: string) => void;
}

const ProjectsContext = createContext<ProjectsContextType | undefined>(undefined);

export function ProjectsProvider({ children }: { children: ReactNode }) {
  const [projects, setProjects] = useLocalStorage<ProjectItem[]>('menkir-projects', []);

  const addProject = (project: Omit<ProjectItem, 'id' | 'index'>) => {
    const id = generateId();
    const index = String(projects.length + 1).padStart(2, '0');
    setProjects((prev) => [...prev, { ...project, id, index }]);
    return id;
  };

  const updateProject = (id: string, updates: Partial<ProjectItem>) => {
    setProjects((prev) => prev.map((p) => (p.id === id ? { updatedAt: new Date().toISOString(), ...p, ...updates } : p)));
  };

  const deleteProject = (id: string) => {
    setProjects((prev) => prev.filter((p) => p.id !== id));
  };

  return (
    <ProjectsContext.Provider value={{ projects, addProject, updateProject, deleteProject }}>
      {children}
    </ProjectsContext.Provider>
  );
}

export function useProjects() {
  const context = useContext(ProjectsContext);
  if (!context) {
    throw new Error('useProjects must be used within a ProjectsProvider');
  }
  return context;
}
