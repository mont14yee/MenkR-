import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { Settings } from '../screens/Settings';
import { ToastProvider } from '../context/ToastContext';
import { ProfileProvider } from '../context/ProfileContext';
import { describe, it, expect, vi } from 'vitest';
import userEvent from '@testing-library/user-event';

describe('Settings Export & Import', () => {
  it('validates imported data and rolls back on failure', async () => {
    localStorage.setItem('menkir-test', 'original');
    
    render(
      <ToastProvider>
        <ProfileProvider>
          <Settings onDismiss={() => {}} />
        </ProfileProvider>
      </ToastProvider>
    );
    
    // Attempt import
    const fileInput = document.querySelector('input[type="file"]') as HTMLInputElement;
    expect(fileInput).toBeInTheDocument();
    
    const invalidJsonFile = new File(['[1,2,3]'], 'backup.json', { type: 'application/json' });
    Object.defineProperty(fileInput, 'files', {
      value: [invalidJsonFile],
    });
    fireEvent.change(fileInput);
    
    // Confirm import dialog should appear
    expect(await screen.findByText('Import Data?')).toBeInTheDocument();
    
    const confirmBtn = screen.getByRole('button', { name: /Yes, import data/i });
    fireEvent.click(confirmBtn);
    
    // Should show failure toast and rollback
    expect(await screen.findByText(/Import failed: Invalid backup format/i)).toBeInTheDocument();
    expect(localStorage.getItem('menkir-test')).toBe('original');
  });

  it('imports valid data successfully', async () => {
    localStorage.setItem('menkir-test', 'old');
    
    render(
      <ToastProvider>
        <ProfileProvider>
          <Settings onDismiss={() => {}} />
        </ProfileProvider>
      </ToastProvider>
    );
    
    const fileInput = document.querySelector('input[type="file"]') as HTMLInputElement;
    const validJsonFile = new File([JSON.stringify({
      "menkir-test": JSON.stringify("new-value"),
      "menkir-profile": JSON.stringify({ name: "Test User" })
    })], 'backup.json', { type: 'application/json' });
    
    Object.defineProperty(fileInput, 'files', {
      value: [validJsonFile],
    });
    fireEvent.change(fileInput);
    
    expect(await screen.findByText('Import Data?')).toBeInTheDocument();
    
    const confirmBtn = screen.getByRole('button', { name: /Yes, import data/i });
    fireEvent.click(confirmBtn);
    
    // Since it succeeds, it will try to reload the page via setTimeout. We can check localStorage immediately
    expect(localStorage.getItem('menkir-test')).toBe(JSON.stringify("new-value"));
    expect(localStorage.getItem('menkir-profile')).toBe(JSON.stringify({ name: "Test User" }));
  });
});
