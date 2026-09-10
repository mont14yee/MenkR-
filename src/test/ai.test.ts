import { describe, it, expect, vi } from 'vitest';
import { generateAIContent } from '../lib/ai';

describe('AI Client Library', () => {
  it('handles missing API key errors gracefully', async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: false,
      json: () => Promise.resolve({ error: 'AI capabilities are not currently configured.', missingKey: true })
    });

    const response = await generateAIContent({ prompt: 'Test' });
    expect(response.error).toBe('AI capabilities are not currently configured.');
    expect(response.missingKey).toBe(true);
    expect(response.data).toBeUndefined();
  });

  it('parses JSON responses correctly when schema is provided', async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ text: '{"summary": "Test summary"}' })
    });

    const response = await generateAIContent<{summary: string}>({ 
      prompt: 'Test', 
      responseSchema: { type: 'OBJECT', properties: { summary: { type: 'STRING' } } }
    });
    
    expect(response.error).toBeUndefined();
    expect(response.data?.summary).toBe('Test summary');
  });
});
