import { describe, it, expect } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import App from '../App';
import React from 'react';

// Helper to get the currently visible tab container (avoids querying hidden tabs)
const getActiveTab = (container: HTMLElement) => {
  const tabs = container.querySelectorAll('.h-full.relative.z-0 > div');
  for (const tab of Array.from(tabs)) {
    if (tab.classList.contains('block')) {
      return tab as HTMLElement;
    }
  }
  throw new Error('No active tab found');
};

describe('MenkiR App Tests', () => {
  it('1. Mounts without errors and renders all four tabs', () => {
    const { container } = render(<App />);
    
    const dashboardBtn = screen.getByRole('button', { name: /go to dashboard tab/i });
    const projectsBtn = screen.getByRole('button', { name: /go to projects tab/i });
    const toolsBtn = screen.getByRole('button', { name: /go to productivity tab/i });
    const clientsBtn = screen.getByRole('button', { name: /go to clients tab/i });
    
    expect(dashboardBtn).toBeInTheDocument();
    expect(projectsBtn).toBeInTheDocument();
    expect(toolsBtn).toBeInTheDocument();
    expect(clientsBtn).toBeInTheDocument();
  });

  it('2. Client CRUD updates localStorage', async () => {
    const user = userEvent.setup();
    const { container } = render(<App />);
    
    const clientsBtn = screen.getByRole('button', { name: /go to clients tab/i });
    await user.click(clientsBtn);
    
    const activeTab = getActiveTab(container);
    const addClientBtn = within(activeTab).getByRole('button', { name: /add client/i });
    await user.click(addClientBtn);
    
    let nameInput = screen.getByPlaceholderText(/jane doe/i);
    await user.type(nameInput, 'John Doe Test');
    
    const saveBtn = screen.getByRole('button', { name: /^save$/i });
    await user.click(saveBtn);
    
    let clientsData = JSON.parse(localStorage.getItem('menkir-clients') || '[]');
    expect(clientsData.length).toBe(1);
    expect(clientsData[0].name).toBe('John Doe Test');

    const clientItem = within(activeTab).getByText('John Doe Test');
    await user.click(clientItem);
    
    const moreOptionsBtn = within(activeTab).getByRole('button', { name: /more options/i });
    await user.click(moreOptionsBtn);
    
    const editBtn = within(activeTab).getByRole('button', { name: /edit client/i });
    await user.click(editBtn);
    
    // Re-query the input because it re-rendered
    nameInput = screen.getByPlaceholderText(/jane doe/i);
    await user.clear(nameInput);
    await user.type(nameInput, 'Jane Doe Test');
    
    // Re-query save button just in case
    const saveEditBtn = screen.getByRole('button', { name: /^save$/i });
    await user.click(saveEditBtn);
    
    clientsData = JSON.parse(localStorage.getItem('menkir-clients') || '[]');
    expect(clientsData[0].name).toBe('Jane Doe Test');

    await user.click(within(activeTab).getByRole('button', { name: /more options/i }));
    const deleteBtn = within(activeTab).getByRole('button', { name: /delete/i });
    await user.click(deleteBtn);
    
    const confirmDeleteBtn = screen.getAllByRole('button', { name: /delete/i }).find(btn => btn.textContent === 'Delete');
    if (confirmDeleteBtn) await user.click(confirmDeleteBtn);
    
    clientsData = JSON.parse(localStorage.getItem('menkir-clients') || '[]');
    expect(clientsData.length).toBe(0);
  });

  it('3. Remount persistence', async () => {
    const user = userEvent.setup();
    const { container, unmount } = render(<App />);
    
    await user.click(screen.getByRole('button', { name: /go to clients tab/i }));
    await user.click(within(getActiveTab(container)).getByRole('button', { name: /add client/i }));
    
    const nameInput = screen.getByPlaceholderText(/jane doe/i);
    await user.type(nameInput, 'Persistent Client');
    await user.click(screen.getByRole('button', { name: /^save$/i }));
    
    expect(JSON.parse(localStorage.getItem('menkir-clients') || '[]').length).toBe(1);
    
    unmount();
    
    const { container: newContainer } = render(<App />);
    await user.click(screen.getByRole('button', { name: /go to clients tab/i }));
    expect(within(getActiveTab(newContainer)).getByText('Persistent Client')).toBeInTheDocument();
  });

  it('4. TimeTracker persistence across unmount', async () => {
    const user = userEvent.setup();
    const { container, unmount } = render(<App />);
    
    await user.click(screen.getByRole('button', { name: /go to productivity tab/i }));
    await user.click(within(getActiveTab(container)).getByText('Time Tracker'));
    
    const startBtns = screen.getAllByRole('button', { name: /start/i });
    // The first one is the main screen Start button
    await user.click(startBtns[0]);
    
    // Clicking the first one opens the BottomSheet. The second Start button is in the BottomSheet.
    const confirmStartBtns = screen.getAllByRole('button', { name: /start/i });
    await user.click(confirmStartBtns[1] || confirmStartBtns[0]);
    
    const timerStateBefore = JSON.parse(localStorage.getItem('menkir-timer-state') || 'null');
    expect(timerStateBefore).toBe('running');
    
    unmount();
    
    render(<App />);
    
    const timerStateAfter = JSON.parse(localStorage.getItem('menkir-timer-state') || 'null');
    expect(timerStateAfter).toBe('running');
  });
});
