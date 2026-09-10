import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import App from '../App';
import { describe, it, expect, beforeEach } from 'vitest';

describe('Library Workflow', () => {
  beforeEach(() => {
    window.localStorage.clear();
    window.localStorage.setItem('menkir-seen-onboarding', 'true');
  });

  it('can create a new note in the library and categorize it', async () => {
    const user = userEvent.setup();
    render(<App />);

    // Go to Productivity Tab
    await user.click(screen.getByRole('button', { name: /go to productivity tab/i }));
    
    // Open Library screen
    await user.click(screen.getByText('Library', { selector: 'h3' }));

    // Click Add New
    await user.click(screen.getByText('Add New'));

    // Select Note
    await user.click(screen.getByText('Note'));

    // Fill in Note details
    const nameInput = screen.getByPlaceholderText('Name');
    await user.type(nameInput, 'My First Note');
    const contentInput = screen.getByPlaceholderText('Write your note here...');
    await user.type(contentInput, 'This is a test note for my library.');

    // Save
    await user.click(screen.getByText('Save'));

    // Verify it appears in the list
    await waitFor(() => {
      expect(screen.getByText('My First Note')).toBeInTheDocument();
    });

    // Verify filter works
    await user.click(screen.getByRole('button', { name: 'Documents' })); // Should be empty since default is Documents but let's say we search
    
    // Let's filter by Contracts
    await user.click(screen.getByRole('button', { name: 'Contracts' }));
    expect(screen.queryByText('My First Note')).not.toBeInTheDocument();

    // Go back to All Categories
    await user.click(screen.getByRole('button', { name: 'All Categories' }));
    expect(screen.getByText('My First Note')).toBeInTheDocument();
  });
});
