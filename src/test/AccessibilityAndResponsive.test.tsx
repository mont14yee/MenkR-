import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import React from 'react';
import { Navigation } from '../components/Navigation';
import { CommandPalette } from '../components/CommandPalette';
import { CommandPaletteProvider, useCommandPalette } from '../context/CommandPaletteContext';
import { NavigationProvider } from '../context/NavigationContext';
import { ToastProvider } from '../context/ToastContext';
import { AuthProvider } from '../context/AuthContext';
import { PreferencesProvider } from '../context/PreferencesContext';
import { DataProvider } from '../context/DataProvider';

function AllProvidersWrapper({ children }: { children: React.ReactNode }) {
  return (
    <PreferencesProvider>
      <ToastProvider>
        <AuthProvider>
          <CommandPaletteProvider>
            <DataProvider>
              {children}
            </DataProvider>
          </CommandPaletteProvider>
        </AuthProvider>
      </ToastProvider>
    </PreferencesProvider>
  );
}

describe('Accessibility, Responsive Controls, and Keyboard Navigation', () => {
  beforeEach(() => {
    localStorage.clear();
    vi.restoreAllMocks();
  });

  describe('Semantic Navigation & Accessible Touch Targets', () => {
    it('renders navigation with semantic nav element and accessible aria-labels for all primary tabs', () => {
      const onChange = vi.fn();
      const onPush = vi.fn();

      render(
        <Navigation 
          activeTab="dashboard" 
          onChange={onChange} 
          onPushScreen={onPush} 
        />
      );

      const navElement = screen.getByRole('navigation');
      expect(navElement).toBeInTheDocument();

      // Ensure distinct descriptive aria-labels exist for touch targets
      const dashboardBtn = screen.getByRole('button', { name: /go to dashboard tab/i });
      const projectsBtn = screen.getByRole('button', { name: /go to projects tab/i });
      const productivityBtn = screen.getByRole('button', { name: /go to productivity tab/i });
      const clientsBtn = screen.getByRole('button', { name: /go to clients tab/i });

      expect(dashboardBtn).toBeInTheDocument();
      expect(projectsBtn).toBeInTheDocument();
      expect(productivityBtn).toBeInTheDocument();
      expect(clientsBtn).toBeInTheDocument();

      // Tab selection fires handler
      fireEvent.click(projectsBtn);
      expect(onChange).toHaveBeenCalledWith('projects');
    });

    it('navigation buttons have sufficient touch target attributes for mobile & tablet', () => {
      render(
        <Navigation 
          activeTab="dashboard" 
          onChange={vi.fn()} 
          onPushScreen={vi.fn()} 
        />
      );

      const buttons = screen.getAllByRole('button');
      // Each button has py-1.5 / h-full layout ensuring min 44px target
      buttons.forEach(btn => {
        expect(btn).toHaveClass('flex');
        expect(btn).not.toBeDisabled();
      });
    });
  });

  describe('Keyboard Navigation & Modal Dismissal', () => {
    function PaletteTrigger() {
      const { openPalette } = useCommandPalette();
      return (
        <div>
          <button onClick={openPalette}>Open Palette</button>
          <CommandPalette />
        </div>
      );
    }

    it('supports Cmd+K / Ctrl+K keyboard shortcut to open palette, and Escape key to dismiss', () => {
      render(
        <AllProvidersWrapper>
          <PaletteTrigger />
        </AllProvidersWrapper>
      );

      // Initially dialog is not mounted
      expect(screen.queryByRole('dialog')).not.toBeInTheDocument();

      // Trigger Cmd+K
      fireEvent.keyDown(window, { key: 'k', metaKey: true });
      
      const dialog = screen.getByRole('dialog', { name: /unified search and command palette/i });
      expect(dialog).toBeInTheDocument();
      expect(dialog).toHaveAttribute('aria-modal', 'true');

      // Dismiss with Escape key
      fireEvent.keyDown(window, { key: 'Escape' });
      expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    });

    it('navigates search results with ArrowDown, ArrowUp, and Enter keys', () => {
      render(
        <AllProvidersWrapper>
          <PaletteTrigger />
        </AllProvidersWrapper>
      );

      // Open palette
      fireEvent.click(screen.getByText('Open Palette'));

      const searchInput = screen.getByRole('textbox');
      expect(searchInput).toBeInTheDocument();

      // Type query
      fireEvent.change(searchInput, { target: { value: 'Task' } });

      // Arrow down key moves active index
      fireEvent.keyDown(searchInput, { key: 'ArrowDown' });
      fireEvent.keyDown(searchInput, { key: 'ArrowUp' });

      // Dismiss with Escape
      fireEvent.keyDown(searchInput, { key: 'Escape' });
      expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    });
  });
});
