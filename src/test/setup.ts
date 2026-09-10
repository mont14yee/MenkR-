import '@testing-library/jest-dom/vitest';
import { afterEach, vi, beforeAll, beforeEach } from 'vitest';

beforeAll(() => {
  Object.defineProperty(window, 'location', {
    configurable: true,
    value: { reload: vi.fn() },
  });
});

beforeEach(() => {
  localStorage.setItem('menkir-seen-onboarding', 'true');
});

afterEach(() => {
  localStorage.clear();
  vi.clearAllMocks();
});
