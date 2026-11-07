export interface AIResponse<T = string> {
  data?: T;
  text?: string;
  error?: string;
  missingKey?: boolean;
}

export interface AIGenerateOptions {
  prompt: string;
  systemInstruction?: string;
  responseSchema?: any;
  model?: string;
}

export type AIWorkflowType =
  | 'project-summary'
  | 'task-breakdown'
  | 'meeting-notes'
  | 'draft-project-plan'
  | 'risk-identification'
  | 'status-report';

export interface AIWorkflowOptions {
  workflow: AIWorkflowType;
  payload: Record<string, any>;
  customPrompt?: string;
  model?: string;
}

export interface AIWorkflowResult<T = any> {
  workflow: AIWorkflowType;
  text: string;
  data?: T;
  model: string;
  error?: string;
  missingKey?: boolean;
}

export interface AIStatusInfo {
  configured: boolean;
  defaultModel: string;
  allowedModels: string[];
  supportedWorkflows: string[];
}

function getAuthHeaders(): Record<string, string> {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
  };
  try {
    const token = localStorage.getItem('menkir-auth-token') || sessionStorage.getItem('menkir-auth-token');
    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
    }
    const activeOrgId = localStorage.getItem('menkir-active-org-id');
    if (activeOrgId) {
      headers['x-organization-id'] = activeOrgId;
    }
  } catch {}
  return headers;
}

/**
 * Checks server-side Gemini configuration status (without exposing secrets).
 */
export async function getAIStatus(): Promise<AIStatusInfo> {
  try {
    const res = await fetch('/api/ai/status');
    if (!res.ok) throw new Error('Status check failed');
    return await res.json();
  } catch {
    return {
      configured: false,
      defaultModel: 'gemini-3.8-flash',
      allowedModels: ['gemini-3.8-flash'],
      supportedWorkflows: [],
    };
  }
}

/**
 * General client-side service boundary for AI content generation.
 * All requests are proxied through the secure Express backend to protect the Gemini API key.
 */
export async function generateAIContent<T = string>(options: AIGenerateOptions): Promise<AIResponse<T>> {
  try {
    const response = await fetch('/api/ai/generate', {
      method: 'POST',
      headers: getAuthHeaders(),
      body: JSON.stringify(options),
    });

    const data = await response.json();

    if (!response.ok) {
      return { 
        error: data.error || 'An unexpected error occurred while communicating with the AI service.',
        missingKey: data.missingKey
      };
    }

    // If a JSON schema was requested, attempt to parse the response
    if (options.responseSchema) {
      try {
        const parsed = JSON.parse(data.text);
        return { data: parsed as T, text: data.text };
      } catch (parseError) {
        return { error: 'Failed to parse structured AI response.', text: data.text };
      }
    }

    return { data: data.text as T, text: data.text };
  } catch (error: any) {
    return { error: error.message || 'Network error occurred while reaching the AI service.' };
  }
}

/**
 * Executes a focused, production-grade AI workflow (project summaries, task breakdowns,
 * meeting notes, draft plans, risk assessments, or status reports) with structured output.
 */
export async function runAIWorkflow<T = any>(options: AIWorkflowOptions): Promise<AIWorkflowResult<T>> {
  try {
    const response = await fetch('/api/ai/workflow', {
      method: 'POST',
      headers: getAuthHeaders(),
      body: JSON.stringify(options),
    });

    const data = await response.json();

    if (!response.ok) {
      return {
        workflow: options.workflow,
        text: '',
        model: options.model || 'gemini-3.8-flash',
        error: data.error || 'Failed to complete AI workflow request.',
        missingKey: data.missingKey,
      };
    }

    return {
      workflow: data.workflow || options.workflow,
      text: data.text || '',
      data: data.data as T,
      model: data.model || options.model || 'gemini-3.8-flash',
    };
  } catch (error: any) {
    return {
      workflow: options.workflow,
      text: '',
      model: options.model || 'gemini-3.8-flash',
      error: error.message || 'Network error occurred during AI workflow execution.',
    };
  }
}
