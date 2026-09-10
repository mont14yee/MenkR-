import { useState, useEffect, useCallback } from 'react';

// Simple deep merge to handle missing keys and schema changes
function mergeDefaults<T>(stored: any, defaults: T): T {
  if (stored === null || stored === undefined) return defaults;
  if (Array.isArray(defaults)) {
    // If the default is an array, we expect the stored value to be an array.
    // We don't merge arrays element-by-element; we return the stored array, 
    // unless it's completely invalid, then we return defaults.
    return Array.isArray(stored) ? stored as unknown as T : defaults;
  }
  if (typeof defaults === 'object' && defaults !== null) {
    if (typeof stored !== 'object' || Array.isArray(stored)) {
      return defaults;
    }
    const merged = { ...defaults } as Record<string, any>;
    for (const key in stored) {
      if (Object.prototype.hasOwnProperty.call(stored, key)) {
        if (key in defaults) {
          merged[key] = mergeDefaults(stored[key], (defaults as any)[key]);
        } else {
          // preserve unknown keys (might be new schema from other device/future version)
          merged[key] = stored[key];
        }
      }
    }
    return merged as unknown as T;
  }
  // Primitives
  return typeof stored === typeof defaults ? stored : defaults;
}

export function useLocalStorage<T>(key: string, initialValue: T) {
  const [storedValue, setStoredValue] = useState<T>(() => {
    try {
      const item = window.localStorage.getItem(key);
      if (item) {
        try {
          const parsed = JSON.parse(item);
          // Handle schema migration / missing fields by merging with defaults
          return mergeDefaults(parsed, initialValue);
        } catch (parseError) {
          console.error(`Corrupted data found for ${key}, falling back to defaults`, parseError);
          // Auto-heal corrupted data
          window.localStorage.setItem(key, JSON.stringify(initialValue));
          return initialValue;
        }
      }
      return initialValue;
    } catch (error) {
      console.error(`Error reading localStorage key "${key}":`, error);
      return initialValue;
    }
  });

  const setValue = useCallback((value: T | ((val: T) => T)) => {
    setStoredValue((prev) => {
      try {
        const valueToStore = value instanceof Function ? value(prev) : value;
        // Check for partial writes / quota exceeded
        try {
          const stringified = JSON.stringify(valueToStore);
          window.localStorage.setItem(key, stringified);
          
          // Verify it was written successfully
          const verification = window.localStorage.getItem(key);
          if (verification !== stringified) {
            throw new Error('Partial write detected');
          }
        } catch (writeError: any) {
          if (writeError.name === 'QuotaExceededError' || writeError.name === 'NS_ERROR_DOM_QUOTA_REACHED') {
            console.error(`Storage limit exceeded for key "${key}". Cannot save data.`);
            alert('Your local storage is full. Please clear some space or export your data and reset.');
          } else {
            console.error(`Failed to write to localStorage for key "${key}":`, writeError);
          }
          // Do not update state if write failed
          return prev;
        }
        return valueToStore;
      } catch (error) {
        console.error(error);
        return prev;
      }
    });
  }, [key]);

  return [storedValue, setValue] as const;
}

