import { render, screen, fireEvent, act } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook } from '@testing-library/react';
import { usePWAInstall } from '../hooks/usePWAInstall';
import { PWAInstallBanner } from '../components/PWAInstallBanner';
import { PWAInstallButton } from '../components/PWAInstallButton';
import { PWAInstallModal } from '../components/PWAInstallModal';

describe('PWA Install Workflow & Components', () => {
  beforeEach(() => {
    localStorage.clear();
    vi.restoreAllMocks();
  });

  it('detects when app is not installed and handles beforeinstallprompt', () => {
    const { result } = renderHook(() => usePWAInstall());
    expect(result.current.isInstalled).toBe(false);
    expect(result.current.isInstallable).toBe(false);

    // Simulate beforeinstallprompt event
    const promptMock = vi.fn().mockResolvedValue(undefined);
    const mockEvent = new Event('beforeinstallprompt') as any;
    mockEvent.prompt = promptMock;
    mockEvent.userChoice = Promise.resolve({ outcome: 'accepted', platform: 'web' });

    act(() => {
      window.dispatchEvent(mockEvent);
    });

    expect(result.current.isInstallable).toBe(true);
  });

  it('handles appinstalled event by marking app as installed', () => {
    const { result } = renderHook(() => usePWAInstall());

    act(() => {
      window.dispatchEvent(new Event('appinstalled'));
    });

    expect(result.current.isInstalled).toBe(true);
    expect(result.current.isInstallable).toBe(false);
  });

  it('triggers native prompt on install() when beforeinstallprompt was fired', async () => {
    const { result } = renderHook(() => usePWAInstall());

    const promptMock = vi.fn().mockResolvedValue(undefined);
    const mockEvent = new Event('beforeinstallprompt') as any;
    mockEvent.prompt = promptMock;
    mockEvent.userChoice = Promise.resolve({ outcome: 'accepted', platform: 'web' });

    act(() => {
      window.dispatchEvent(mockEvent);
    });

    let outcome = false;
    await act(async () => {
      outcome = await result.current.install();
    });

    expect(promptMock).toHaveBeenCalled();
    expect(outcome).toBe(true);
    expect(result.current.isInstalled).toBe(true);
  });

  it('shows guidance modal when native prompt is unavailable (e.g. iOS or manual install)', async () => {
    const { result } = renderHook(() => usePWAInstall());
    expect(result.current.isInstallable).toBe(false);

    await act(async () => {
      await result.current.install();
    });

    expect(result.current.showGuideModal).toBe(true);
  });

  it('renders PWAInstallBanner with Add to Home Screen actions and handles dismissal', () => {
    render(<PWAInstallBanner forceVisible />);

    expect(screen.getByText('Install MenkiR')).toBeDefined();
    expect(screen.getByLabelText('Add MenkiR to Home Screen')).toBeDefined();

    // Click dismiss button
    const dismissBtn = screen.getByLabelText('Dismiss install banner');
    fireEvent.click(dismissBtn);

    // Check localStorage saved dismissal
    expect(localStorage.getItem('menkir-pwa-banner-dismissed')).toBeTruthy();
  });

  it('renders PWAInstallModal with step-by-step instructions for iOS and Android', () => {
    const onClose = vi.fn();
    const { rerender } = render(<PWAInstallModal isOpen={true} onClose={onClose} isIOS={true} />);

    expect(screen.getByText('Add MenkiR to Home Screen')).toBeDefined();
    expect(screen.getByText(/Share/i)).toBeDefined();
    expect(screen.getByText(/Add to Home Screen/i)).toBeDefined();

    // Rerender for Android
    rerender(<PWAInstallModal isOpen={true} onClose={onClose} isIOS={false} />);
    expect(screen.getAllByText(/browser menu/i).length).toBeGreaterThan(0);

    // Click "Got it"
    const gotItBtn = screen.getByText('Got it');
    fireEvent.click(gotItBtn);
    expect(onClose).toHaveBeenCalled();
  });

  it('PWAInstallButton suppresses itself when already installed in standalone mode', () => {
    // Mock matchMedia to simulate standalone mode
    const originalMatchMedia = window.matchMedia;
    window.matchMedia = vi.fn().mockImplementation((query: string) => ({
      matches: query.includes('display-mode: standalone'),
      media: query,
      onchange: null,
      addListener: vi.fn(),
      removeListener: vi.fn(),
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      dispatchEvent: vi.fn(),
    } as any));

    const { container } = render(<PWAInstallButton />);
    expect(container.firstChild).toBeNull();

    window.matchMedia = originalMatchMedia;
  });
});
