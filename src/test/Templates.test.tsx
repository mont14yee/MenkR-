import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import App from '../App';
import { describe, it, expect, beforeEach } from 'vitest';

describe('Templates Workflow', () => {
  beforeEach(() => {
    window.localStorage.clear();
    window.localStorage.setItem('menkir-seen-onboarding', 'true');
  });

  it('can create a template and instantiate it', async () => {
    const user = userEvent.setup();
    render(<App />);

    // 1. Go to Productivity Tab (where Templates is)
    await user.click(screen.getByRole('button', { name: /go to productivity tab/i }));
    
    // 2. Open Templates screen
    await user.click(screen.getByText('Templates'));

    // 3. Create a new template
    await user.click(screen.getByText('Create Template'));
    
    const nameInput = screen.getByPlaceholderText('e.g., New Client Onboarding');
    await user.type(nameInput, 'Onboarding Template');
    
    await user.click(screen.getByText('Save'));

    // 4. Verify it's in the list
    await waitFor(() => {
      expect(screen.getByText('Onboarding Template')).toBeInTheDocument();
    });

    // 5. Use the template
    await user.click(screen.getByText('Use'));

    // 6. Enter Project Name
    const projInput = screen.getAllByRole('textbox')[1];
    await user.clear(projInput);
    await user.type(projInput, 'My New Client Project');

    // 7. Click Next
    await user.click(screen.getByText('Next: Review Generated Plan'));
    
    // 8. Confirm & Create
    await user.click(screen.getByText('6. Confirm & Create'));

    // Wait for the modal to close
    await waitFor(() => {
      expect(screen.queryByText('6. Confirm & Create')).not.toBeInTheDocument();
    }, { timeout: 3000 });
  });
});
