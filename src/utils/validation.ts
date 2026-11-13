/**
 * Reusable validation utilities for MenkiR.
 * Provides predictable input validation and error reporting across all forms and data entries.
 */

export interface ValidationResult<T = any> {
  isValid: boolean;
  error?: string;
  value?: T;
}

/**
 * Validates non-empty required string.
 */
export function validateRequired(value: string | undefined | null, fieldName = 'This field'): ValidationResult<string> {
  if (!value || typeof value !== 'string' || !value.trim()) {
    return {
      isValid: false,
      error: `${fieldName} is required.`,
    };
  }
  return {
    isValid: true,
    value: value.trim(),
  };
}

/**
 * Validates email address format (optional or required).
 */
export function validateEmail(email: string | undefined | null, isRequired = false): ValidationResult<string> {
  const trimmed = email ? email.trim() : '';
  if (!trimmed) {
    if (isRequired) {
      return { isValid: false, error: 'Email address is required.' };
    }
    return { isValid: true, value: '' };
  }

  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailRegex.test(trimmed)) {
    return { isValid: false, error: 'Please enter a valid email address.' };
  }

  return { isValid: true, value: trimmed };
}

/**
 * Validates phone numbers (optional or required).
 */
export function validatePhone(phone: string | undefined | null, isRequired = false): ValidationResult<string> {
  const trimmed = phone ? phone.trim() : '';
  if (!trimmed) {
    if (isRequired) {
      return { isValid: false, error: 'Phone number is required.' };
    }
    return { isValid: true, value: '' };
  }

  // Permissive international/local phone check
  const phoneRegex = /^[+]?[(]?[0-9]{1,4}[)]?[-\s./0-9]{4,15}$/;
  if (!phoneRegex.test(trimmed)) {
    return { isValid: false, error: 'Please enter a valid phone number.' };
  }

  return { isValid: true, value: trimmed };
}

/**
 * Validates positive monetary amount or number.
 */
export function validatePositiveNumber(
  val: number | string | undefined | null,
  fieldName = 'Amount',
  allowZero = false
): ValidationResult<number> {
  if (val === undefined || val === null || val === '') {
    return { isValid: false, error: `${fieldName} is required.` };
  }

  const num = typeof val === 'number' ? val : parseFloat(val);
  if (isNaN(num)) {
    return { isValid: false, error: `${fieldName} must be a valid number.` };
  }

  if (allowZero ? num < 0 : num <= 0) {
    return {
      isValid: false,
      error: `${fieldName} must be ${allowZero ? 'zero or greater' : 'greater than 0'}.`,
    };
  }

  return { isValid: true, value: num };
}

/**
 * Validates web URL (http/https).
 */
export function validateUrl(url: string | undefined | null, isRequired = false): ValidationResult<string> {
  const trimmed = url ? url.trim() : '';
  if (!trimmed) {
    if (isRequired) {
      return { isValid: false, error: 'URL is required.' };
    }
    return { isValid: true, value: '' };
  }

  if (/\s/.test(trimmed)) {
    return { isValid: false, error: 'Please enter a valid web URL.' };
  }

  const hasExplicitScheme = /^[a-zA-Z][a-zA-Z0-9+.-]*:/.test(trimmed);
  if (hasExplicitScheme && !/^https?:\/\//i.test(trimmed)) {
    return { isValid: false, error: 'URL must start with http:// or https://.' };
  }

  try {
    const candidate = /^https?:\/\//i.test(trimmed) ? trimmed : `https://${trimmed}`;
    const parsed = new URL(candidate);
    const hostname = parsed.hostname;
    const isLocalhost = hostname === 'localhost';
    const hasValidDomain = /^[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/.test(hostname) && !hostname.startsWith('.') && !hostname.endsWith('.');
    const isIpv4 = /^(\d{1,3}\.){3}\d{1,3}$/.test(hostname);

    if (!hostname || (!isLocalhost && !hasValidDomain && !isIpv4)) {
      return { isValid: false, error: 'Please enter a valid web URL.' };
    }
    return { isValid: true, value: parsed.href };
  } catch {
    return { isValid: false, error: 'Please enter a valid web URL.' };
  }
}

/**
 * Validates date string (YYYY-MM-DD or standard parseable ISO).
 */
export function validateDateString(date: string | undefined | null, fieldName = 'Date'): ValidationResult<string> {
  if (!date || typeof date !== 'string' || !date.trim()) {
    return { isValid: false, error: `${fieldName} is required.` };
  }

  const parsed = new Date(date);
  if (isNaN(parsed.getTime())) {
    return { isValid: false, error: `Invalid ${fieldName} format.` };
  }

  return { isValid: true, value: date.trim() };
}

/**
 * Predictable JSON parse with fallback.
 */
export function safeJsonParse<T>(jsonStr: string | null | undefined, fallback: T): { success: boolean; data: T; error?: string } {
  if (!jsonStr) {
    return { success: false, data: fallback, error: 'Empty JSON payload' };
  }

  try {
    const data = JSON.parse(jsonStr);
    return { success: true, data };
  } catch (err: any) {
    return { success: false, data: fallback, error: err?.message || 'JSON parsing error' };
  }
}
