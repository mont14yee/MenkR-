import React, { createContext, useContext, useState, ReactNode } from 'react';
import { AIWorkflowType } from '../lib/ai';
import { AIAssistantModal } from '../components/AIAssistantModal';

interface AIAssistantContextType {
  openAssistant: (workflow?: AIWorkflowType, projectId?: string) => void;
  closeAssistant: () => void;
  isAssistantOpen: boolean;
}

const AIAssistantContext = createContext<AIAssistantContextType | undefined>(undefined);

export function AIAssistantProvider({ children }: { children: ReactNode }) {
  const [isOpen, setIsOpen] = useState(false);
  const [workflow, setWorkflow] = useState<AIWorkflowType>('project-summary');
  const [projectId, setProjectId] = useState<string | undefined>(undefined);

  const openAssistant = (wf: AIWorkflowType = 'project-summary', pId?: string) => {
    setWorkflow(wf);
    setProjectId(pId);
    setIsOpen(true);
  };

  const closeAssistant = () => {
    setIsOpen(false);
  };

  return (
    <AIAssistantContext.Provider value={{ openAssistant, closeAssistant, isAssistantOpen: isOpen }}>
      {children}
      {isOpen && (
        <AIAssistantModal
          isOpen={isOpen}
          onClose={closeAssistant}
          initialWorkflow={workflow}
          initialProjectId={projectId}
        />
      )}
    </AIAssistantContext.Provider>
  );
}

export function useAIAssistant() {
  const ctx = useContext(AIAssistantContext);
  if (!ctx) {
    throw new Error('useAIAssistant must be used within an AIAssistantProvider');
  }
  return ctx;
}
