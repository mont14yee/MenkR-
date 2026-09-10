export interface AIResponse<T = string> {
  data?: T;
  error?: string;
  missingKey?: boolean;
}

export interface AIGenerateOptions {
  prompt: string;
  systemInstruction?: string;
  responseSchema?: any;
  model?: string;
}

/**
 * Clean client-side service boundary for AI capabilities.
 * All requests are proxied through the secure Express backend to protect the Gemini API key.
 */
export async function generateAIContent<T = string>(options: AIGenerateOptions): Promise<AIResponse<T>> {
  try {
    const response = await fetch('/api/ai/generate', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
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
        return { data: parsed as T };
      } catch (parseError) {
        return { error: 'Failed to parse structured AI response.' };
      }
    }

    return { data: data.text as T };
  } catch (error: any) {
    return { error: error.message || 'Network error occurred while reaching the AI service.' };
  }
}
