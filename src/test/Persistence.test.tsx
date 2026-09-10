import { render, screen, waitFor } from '@testing-library/react';
import { renderHook, act } from '@testing-library/react';
import { useLocalStorage } from '../hooks/useLocalStorage';
import { describe, it, expect, vi } from 'vitest';

describe('useLocalStorage', () => {
  it('handles missing keys by returning initialValue', () => {
    const { result } = renderHook(() => useLocalStorage('missing-key', { a: 1 }));
    expect(result.current[0]).toEqual({ a: 1 });
  });

  it('merges new schema fields (missing fields in stored data)', () => {
    localStorage.setItem('schema-test', JSON.stringify({ a: 1 }));
    const { result } = renderHook(() => useLocalStorage('schema-test', { a: 0, b: 2 }));
    expect(result.current[0]).toEqual({ a: 1, b: 2 });
  });

  it('handles corrupted JSON data by recovering and auto-healing', () => {
    localStorage.setItem('corrupt-test', '{ invalid json');
    const { result } = renderHook(() => useLocalStorage('corrupt-test', { safe: true }));
    expect(result.current[0]).toEqual({ safe: true });
    // Check auto-healing
    expect(localStorage.getItem('corrupt-test')).toBe(JSON.stringify({ safe: true }));
  });

  it('handles quota exceeded gracefully without crashing', () => {
    // Mock window.alert
    const originalAlert = window.alert;
    window.alert = vi.fn();

    const { result } = renderHook(() => useLocalStorage('quota-test', 'initial'));
    
    // Mock setItem to throw quota error
    const originalSetItem = Storage.prototype.setItem;
    Storage.prototype.setItem = vi.fn(() => {
      const err = new Error('Quota exceeded');
      err.name = 'QuotaExceededError';
      throw err;
    });

    // Attempt to save new value
    act(() => {
      result.current[1]('new-value');
    });

    // Should not have crashed, but should not have updated state or localStorage
    expect(result.current[0]).toBe('initial');
    
    Storage.prototype.setItem = originalSetItem;
    expect(window.localStorage.getItem('quota-test')).toBeNull();
    window.alert = originalAlert;
  });

  it('preserves unknown keys when merging objects', () => {
    // Simulating old data with unknown key
    localStorage.setItem('unknown-key-test', JSON.stringify({ a: 1, unknownKey: 'value' }));
    
    // Simulating app loading with an older schema (without unknownKey)
    const { result } = renderHook(() => useLocalStorage('unknown-key-test', { a: 2 }));
    
    expect(result.current[0]).toEqual({ a: 1, unknownKey: 'value' });
  });
});
