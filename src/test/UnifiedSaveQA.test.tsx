import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

describe('MenkR- Unified Save Button QA Suite', () => {
  beforeEach(() => {
    window.localStorage.clear();
    window.localStorage.setItem('menkir-seen-onboarding', 'true');
    vi.restoreAllMocks();
  });

  it('prevents duplicate submissions on rapid synchronous double-clicks', async () => {
    const { BottomSheet } = await import('../components/BottomSheet');
    const onSaveSync = vi.fn();

    render(
      <BottomSheet
        isOpen={true}
        onClose={() => {}}
        title="New Client"
        onSave={onSaveSync}
        saveLabel="Create Client"
      >
        <div>Body</div>
      </BottomSheet>
    );

    const btn = screen.getByRole('button', { name: 'Create Client' });
    fireEvent.click(btn);
    fireEvent.click(btn);

    expect(onSaveSync).toHaveBeenCalledTimes(1);
  });

  it('unlocks immediately on validation or network error so the user can retry without losing input', async () => {
    const { BottomSheet } = await import('../components/BottomSheet');
    let attempt = 0;
    const onClose = vi.fn();

    function Harness() {
      const [name, setName] = React.useState('Acme Workspace');
      const [isOpen, setIsOpen] = React.useState(true);

      const handleSave = async () => {
        attempt += 1;
        if (attempt === 1) {
          throw new Error('503 Service Unavailable: database offline');
        }
        setIsOpen(false);
        onClose();
      };

      return (
        <BottomSheet
          isOpen={isOpen}
          onClose={() => setIsOpen(false)}
          title="New Project"
          onSave={handleSave}
          saveLabel="Create Project"
          savingLabel="Creating..."
        >
          <input
            aria-label="Project Name"
            value={name}
            onChange={(e) => setName(e.target.value)}
          />
        </BottomSheet>
      );
    }

    const user = userEvent.setup();
    render(<Harness />);

    await user.click(screen.getByRole('button', { name: 'Create Project' }));

    await waitFor(() => {
      expect(screen.getByRole('alert')).toHaveTextContent('503 Service Unavailable: database offline');
    });
    expect(onClose).not.toHaveBeenCalled();
    expect(screen.getByLabelText('Project Name')).toHaveValue('Acme Workspace');

    // Retry immediately succeeds cleanly
    await user.click(screen.getByRole('button', { name: 'Create Project' }));
    await waitFor(() => {
      expect(onClose).toHaveBeenCalledTimes(1);
    });
    expect(attempt).toBe(2);
  });

  it('verifies Clients create/edit workflows, invalid email blocking, and quick-action relationships', async () => {
    const App = (await import('../App')).default;
    const user = userEvent.setup();
    render(<App />);

    // Navigate to Clients
    await user.click(screen.getByRole('button', { name: /go to clients tab/i }));
    await user.click(screen.getByRole('button', { name: /add client/i }));

    const newClientSheet = screen.getByRole('dialog', { name: /new client/i });
    const createBtn = within(newClientSheet).getByRole('button', { name: /^create client$/i });
    expect(createBtn).toBeDisabled();

    await user.type(within(newClientSheet).getByPlaceholderText('Jane Doe'), 'Selam Tesfaye');
    expect(createBtn).not.toBeDisabled();

    // Invalid email blocks save
    const emailInput = within(newClientSheet).getByPlaceholderText('jane@example.com');
    await user.type(emailInput, 'not-an-email');
    expect(createBtn).toBeDisabled();

    await user.clear(emailInput);
    await user.type(emailInput, 'selam@addisstudio.et');
    expect(createBtn).not.toBeDisabled();
    await user.click(createBtn);

    // Appears immediately in list & toast confirmation shown
    await waitFor(() => {
      expect(screen.getByText('Client created successfully.')).toBeInTheDocument();
      expect(screen.getAllByText('Selam Tesfaye').length).toBeGreaterThan(0);
    });

    // Open client and verify Edit Client -> Save Changes label & immediate update
    await user.click(screen.getAllByText('Selam Tesfaye')[0]);
    await user.click(screen.getByRole('button', { name: /more options/i }));
    await user.click(screen.getByRole('button', { name: /edit client/i }));

    const editClientSheet = screen.getByRole('dialog', { name: /edit client/i });
    const saveChangesBtn = within(editClientSheet).getByRole('button', { name: /^save changes$/i });
    expect(saveChangesBtn).toBeInTheDocument();

    const companyInput = within(editClientSheet).getByPlaceholderText('Acme Corp');
    await user.type(companyInput, 'Addis Digital');
    await user.click(saveChangesBtn);

    await waitFor(() => {
      expect(screen.getByText('Client updated successfully.')).toBeInTheDocument();
      expect(screen.getAllByText('Addis Digital').length).toBeGreaterThan(0);
    });
  });

  it('verifies Projects create/edit validation (negative budget & out-of-range completion %) and persistence', async () => {
    const App = (await import('../App')).default;
    const user = userEvent.setup();
    render(<App />);

    await user.click(screen.getByRole('button', { name: /go to projects tab/i }));
    await user.click(screen.getByRole('button', { name: /add project/i }));

    const sheet = screen.getByRole('dialog', { name: /new project/i });
    const createBtn = within(sheet).getByRole('button', { name: /^create project$/i });
    expect(createBtn).toBeDisabled();

    await user.type(within(sheet).getByPlaceholderText('Website Redesign'), 'MenkR Mobile Rollout');
    expect(createBtn).not.toBeDisabled();

    // Negative budget disables submit
    const budgetInput = within(sheet).getByPlaceholderText('10000');
    await user.type(budgetInput, '-500');
    expect(createBtn).toBeDisabled();
    await user.clear(budgetInput);
    await user.type(budgetInput, '12000');
    expect(createBtn).not.toBeDisabled();

    // Completion % > 100 disables submit
    const completionInput = sheet.querySelector('input[min="0"][max="100"]') as HTMLInputElement;
    expect(completionInput).toBeTruthy();
    await user.clear(completionInput);
    await user.type(completionInput, '150');
    expect(createBtn).toBeDisabled();

    await user.clear(completionInput);
    await user.type(completionInput, '25');
    expect(createBtn).not.toBeDisabled();
    await user.click(createBtn);

    await waitFor(() => {
      expect(screen.getByText('Project created successfully')).toBeInTheDocument();
      expect(screen.getAllByText('MenkR Mobile Rollout').length).toBeGreaterThan(0);
    });

    const stored = JSON.parse(window.localStorage.getItem('menkir-projects') || '[]');
    expect(stored.some((p: any) => p.name === 'MenkR Mobile Rollout' && p.budget === 12000 && p.completionPct === 25)).toBe(true);
  });

  it('verifies Time Tracker validation against invalid negative hourly rates and saves manual entry', async () => {
    const App = (await import('../App')).default;
    const user = userEvent.setup();
    render(<App />);

    await user.click(screen.getByRole('button', { name: 'Time Tracking' }));
    await user.click(screen.getByRole('button', { name: 'Manual Entry' }));

    const sheet = screen.getByRole('dialog', { name: /save time record/i });
    const saveBtn = within(sheet).getByRole('button', { name: /^save time entry$/i });
    expect(saveBtn).not.toBeDisabled(); // default 01:00:00

    // Enter invalid negative hourly rate
    const rateInput = within(sheet).getByPlaceholderText('e.g. 125');
    await user.type(rateInput, '-45');
    expect(saveBtn).toBeDisabled();

    // Fix rate to valid positive number
    await user.clear(rateInput);
    await user.type(rateInput, '95');
    expect(saveBtn).not.toBeDisabled();

    await user.type(within(sheet).getByPlaceholderText('Work completed...'), 'QA audit pass');
    await user.click(saveBtn);

    await waitFor(() => {
      expect(screen.getByText('Time logged successfully')).toBeInTheDocument();
    });
    const stored = JSON.parse(window.localStorage.getItem('menkir-time-entries') || '[]');
    expect(stored).toHaveLength(1);
    expect(stored[0]).toMatchObject({
      durationSeconds: 3600,
      hourlyRate: 95,
      note: 'QA audit pass',
    });
  });

  it('verifies Library link URL validation and saves resource with Save Resource', async () => {
    const App = (await import('../App')).default;
    const user = userEvent.setup();
    render(<App />);

    await user.click(screen.getByRole('button', { name: 'Library' }));
    await user.click(screen.getByRole('button', { name: /^add new$/i }));

    const menuSheet = screen.getByRole('dialog', { name: /add resource to library/i });
    await user.click(within(menuSheet).getByRole('button', { name: /web url/i }));

    const formSheet = screen.getByRole('dialog', { name: /new link/i });
    const saveBtn = within(formSheet).getByRole('button', { name: /^save resource$/i });
    expect(saveBtn).toBeDisabled();

    await user.type(within(formSheet).getByPlaceholderText('Name'), 'Design System Spec');
    await user.type(within(formSheet).getByPlaceholderText(/https:\/\/drive\.google\.com/i), 'invalid-url');
    expect(saveBtn).toBeDisabled();

    const urlInput = within(formSheet).getByPlaceholderText(/https:\/\/drive\.google\.com/i);
    await user.clear(urlInput);
    await user.type(urlInput, 'https://example.com/spec');
    expect(saveBtn).not.toBeDisabled();
    await user.click(saveBtn);

    await waitFor(() => {
      expect(screen.getByText('Resource securely added to library.')).toBeInTheDocument();
      expect(screen.getByText('Design System Spec')).toBeInTheDocument();
    });
  });

  it('verifies Calendar schedule creation validates time ranges and updates immediately', async () => {
    const App = (await import('../App')).default;
    const user = userEvent.setup();
    render(<App />);

    await user.click(screen.getAllByRole('button', { name: 'Schedule' })[0]);

    // Calendar header '+' button sits next to Today button
    const todayBtn = screen.getByRole('button', { name: /today/i });
    const headerActionContainer = todayBtn.parentElement!;
    const plusBtn = headerActionContainer.querySelector('svg.lucide-plus')?.closest('button');
    expect(plusBtn).toBeTruthy();
    await user.click(plusBtn!);

    const sheet = screen.getByRole('dialog', { name: /new schedule commitment/i });
    const saveBtn = within(sheet).getByRole('button', { name: /^save event$/i });
    expect(saveBtn).toBeDisabled();

    await user.type(within(sheet).getByPlaceholderText(/event title/i), 'Architecture Sync');
    expect(saveBtn).not.toBeDisabled();

    // Ensure all-day is unchecked and test startTime > endTime validation
    const allDayCheckbox = sheet.querySelector('input[type="checkbox"]') as HTMLInputElement;
    if (allDayCheckbox.checked) {
      await user.click(allDayCheckbox);
    }

    const timeInputs = sheet.querySelectorAll('input[type="time"]');
    expect(timeInputs).toHaveLength(2);
    fireEvent.change(timeInputs[0], { target: { value: '15:00' } });
    fireEvent.change(timeInputs[1], { target: { value: '10:00' } });
    expect(saveBtn).toBeDisabled();

    fireEvent.change(timeInputs[1], { target: { value: '16:00' } });
    expect(saveBtn).not.toBeDisabled();
    await user.click(saveBtn);

    await waitFor(() => {
      expect(screen.getByText('Event added to schedule')).toBeInTheDocument();
      expect(screen.getByText('Architecture Sync')).toBeInTheDocument();
    });
  });

  it('verifies Finance transaction create/edit validation and Tasks create/edit with notes & project link', async () => {
    const App = (await import('../App')).default;
    const user = userEvent.setup();
    render(<App />);

    // 1. Finance: Create Expense -> invalid zero/negative blocked, valid saved, then edited
    await user.click(screen.getByRole('button', { name: 'Finance' }));
    await user.click(screen.getAllByRole('button', { name: /log revenue/i })[0]);

    const financeSheet = screen.getByRole('dialog', { name: /record transaction/i });
    const saveTxBtn = within(financeSheet).getByRole('button', { name: /^save transaction$/i });
    expect(saveTxBtn).toBeDisabled();

    await user.click(within(financeSheet).getByRole('button', { name: /^expense$/i }));
    const amountInput = within(financeSheet).getByPlaceholderText('0.00');
    await user.type(amountInput, '-50');
    expect(saveTxBtn).toBeDisabled();

    await user.clear(amountInput);
    await user.type(amountInput, '240');
    await user.type(within(financeSheet).getByPlaceholderText(/aws cloud hosting/i), 'Cloud Infrastructure');
    expect(saveTxBtn).not.toBeDisabled();
    await user.click(saveTxBtn);

    await waitFor(() => {
      expect(screen.getByText('Expense recorded')).toBeInTheDocument();
      expect(screen.getAllByText('Cloud Infrastructure').length).toBeGreaterThan(0);
    });

    // Edit the created financial record -> label Save Changes
    await user.click(screen.getAllByText('Cloud Infrastructure').at(-1)!);
    const editFinanceSheet = screen.getByRole('dialog', { name: /edit financial record/i });
    const editTxBtn = within(editFinanceSheet).getByRole('button', { name: /^save changes$/i });
    const editDescInput = within(editFinanceSheet).getByPlaceholderText(/aws cloud hosting/i);
    await user.clear(editDescInput);
    await user.type(editDescInput, 'Cloud Infrastructure Q4');
    await user.click(editTxBtn);

    await waitFor(() => {
      expect(screen.getByText('Expense updated')).toBeInTheDocument();
      expect(screen.getAllByText('Cloud Infrastructure Q4').length).toBeGreaterThan(0);
    });

    // Dismiss Finance modal and go to Tasks
    await user.click(screen.getAllByRole('button', { name: /^close$/i }).at(-1)!);
    await user.click(screen.getByRole('button', { name: 'Tasks' }));
    await user.click(screen.getAllByRole('button', { name: /new task/i })[0]);

    const taskSheet = screen.getByRole('dialog', { name: /new task/i });
    const createTaskBtn = within(taskSheet).getByRole('button', { name: /^create task$/i });
    expect(createTaskBtn).toBeDisabled();

    await user.type(within(taskSheet).getByPlaceholderText(/task title/i), 'Finalize Delivery Checklist');
    expect(createTaskBtn).not.toBeDisabled();
    await user.click(createTaskBtn);

    await waitFor(() => {
      expect(screen.getByText('Task created successfully')).toBeInTheDocument();
      expect(screen.getAllByText('Finalize Delivery Checklist').length).toBeGreaterThan(0);
    });

    // Edit task to add notes & save changes
    await user.click(screen.getAllByText('Finalize Delivery Checklist').at(-1)!);
    const editTaskSheet = screen.getByRole('dialog', { name: /edit task/i });
    const saveTaskBtn = within(editTaskSheet).getByRole('button', { name: /^save changes$/i });
    const expandNotesBtn = within(editTaskSheet).queryByRole('button', { name: /\+ add optional notes/i });
    if (expandNotesBtn) {
      await user.click(expandNotesBtn);
    }
    const notesBox = editTaskSheet.querySelector('textarea') as HTMLTextAreaElement;
    expect(notesBox).toBeTruthy();
    await user.type(notesBox, 'Verify QA report and handoff doc');
    await user.click(saveTaskBtn);

    await waitFor(() => {
      expect(screen.getByText('Task updated successfully')).toBeInTheDocument();
      expect(screen.getByText('Verify QA report and handoff doc')).toBeInTheDocument();
    });
  });

  it('verifies Settings Profile edit and Preferences Create Category save workflows', async () => {
    const App = (await import('../App')).default;
    const user = userEvent.setup();
    render(<App />);

    await user.click(screen.getByRole('button', { name: 'Settings' }));

    // 1. Account Details (Profile)
    await user.click(screen.getByText('Account Details'));
    const profileSheet = screen.getByRole('dialog', { name: /account details/i });
    const saveProfileBtn = within(profileSheet).getByRole('button', { name: /^save changes$/i });

    const inputs = profileSheet.querySelectorAll('input');
    const nameInput = inputs[0];
    const emailInput = inputs[1];

    await user.clear(nameInput);
    expect(saveProfileBtn).toBeDisabled();
    await user.type(nameInput, 'Dawit Bekele');

    await user.clear(emailInput);
    await user.type(emailInput, 'bad-email');
    expect(saveProfileBtn).toBeDisabled();

    await user.clear(emailInput);
    await user.type(emailInput, 'dawit@menkir.app');
    expect(saveProfileBtn).not.toBeDisabled();
    await user.click(saveProfileBtn);

    await waitFor(() => {
      expect(screen.getByText('Profile details updated successfully.')).toBeInTheDocument();
      expect(screen.getAllByText('Dawit Bekele').length).toBeGreaterThan(0);
    });

    // 2. Preferences -> New Category -> Create Category
    await user.click(screen.getByText('Preferences'));
    await user.click(screen.getByRole('button', { name: /\+ add category/i }));

    const catSheet = screen.getByRole('dialog', { name: /new category/i });
    const createCatBtn = within(catSheet).getByRole('button', { name: /^create category$/i });
    expect(createCatBtn).toBeDisabled();

    await user.type(within(catSheet).getByPlaceholderText('e.g. Design'), 'QA Audits');
    expect(createCatBtn).not.toBeDisabled();
    await user.click(createCatBtn);

    await waitFor(() => {
      expect(screen.getByText('Category added successfully.')).toBeInTheDocument();
      expect(screen.getByText('QA Audits')).toBeInTheDocument();
    });
  });

  it('prevents viewer role from creating, editing, or saving across modules', async () => {
    vi.resetModules();
    vi.doMock('../context/AuthContext', () => ({
      AuthProvider: ({ children }: { children: React.ReactNode }) => <>{children}</>,
      useAuth: () => ({
        user: { uid: 'viewer-1', email: 'viewer@test.com', displayName: 'Viewer User' },
        idToken: 'fake-token',
        organization: { id: 'org-1', name: 'Test Org', slug: 'test-org', currency: 'USD', role: 'viewer' },
        organizations: [{ id: 'org-1', name: 'Test Org', slug: 'test-org', currency: 'USD', role: 'viewer' }],
        role: 'viewer',
        isLoading: false,
        signInWithGoogle: vi.fn(),
        signOut: vi.fn(),
        refreshToken: vi.fn(),
        switchOrganization: vi.fn(),
        createOrg: vi.fn(),
        fetchMembers: vi.fn().mockResolvedValue([]),
        fetchInvitations: vi.fn().mockResolvedValue([]),
        inviteUser: vi.fn(),
        revokeInvite: vi.fn(),
        acceptInvite: vi.fn(),
        changeMemberRole: vi.fn(),
        removeMember: vi.fn(),
      }),
    }));

    const App = (await import('../App')).default;
    const user = userEvent.setup();
    window.localStorage.setItem(
      'menkir-clients',
      JSON.stringify([{ id: 'c-1', name: 'Viewer Client', status: 'active', tags: [], avatarSeed: 's1' }])
    );
    window.localStorage.setItem(
      'menkir-projects',
      JSON.stringify([{ id: 'p-1', index: 'PRJ-01', name: 'Viewer Project', priority: 'high', completionPct: 10, tone: 'lime', status: 'active', clientId: 'c-1' }])
    );

    render(<App />);

    // Clients: Add client button disabled
    await user.click(screen.getByRole('button', { name: /go to clients tab/i }));
    expect(screen.getByRole('button', { name: /add client/i })).toBeDisabled();

    // Projects: Add project button disabled, Quick actions disabled
    await user.click(screen.getByRole('button', { name: /go to projects tab/i }));
    expect(screen.getByRole('button', { name: /add project/i })).toBeDisabled();
    await user.click(screen.getAllByText('Viewer Project')[0]);
    expect(screen.getByRole('button', { name: /log revenue/i })).toBeDisabled();

    // Settings -> Preferences: Add Category & Delete Category disabled
    await user.click(screen.getByRole('button', { name: 'Settings' }));
    await user.click(screen.getByText('Preferences'));
    expect(screen.getByRole('button', { name: /\+ add category/i })).toBeDisabled();
    const deleteCatButtons = screen.getAllByRole('button', { name: /delete category/i });
    deleteCatButtons.forEach((btn) => expect(btn).toBeDisabled());

    vi.doUnmock('../context/AuthContext');
  });

  it('handles workspace creation network failure cleanly without losing input in Settings', async () => {
    vi.resetModules();
    const createOrgMock = vi.fn().mockRejectedValueOnce(new Error('Network error: failed to reach /api/organizations'));
    vi.doMock('../context/AuthContext', () => ({
      AuthProvider: ({ children }: { children: React.ReactNode }) => <>{children}</>,
      useAuth: () => ({
        user: { uid: 'owner-1', email: 'owner@test.com', displayName: 'Owner User' },
        idToken: 'fake-token',
        organization: { id: 'org-1', name: 'Primary Org', slug: 'primary-org', currency: 'USD', role: 'owner' },
        organizations: [{ id: 'org-1', name: 'Primary Org', slug: 'primary-org', currency: 'USD', role: 'owner' }],
        role: 'owner',
        isLoading: false,
        signInWithGoogle: vi.fn(),
        signOut: vi.fn(),
        refreshToken: vi.fn(),
        switchOrganization: vi.fn(),
        createOrg: createOrgMock,
        fetchMembers: vi.fn().mockResolvedValue([]),
        fetchInvitations: vi.fn().mockResolvedValue([]),
        inviteUser: vi.fn(),
        revokeInvite: vi.fn(),
        acceptInvite: vi.fn(),
        changeMemberRole: vi.fn(),
        removeMember: vi.fn(),
      }),
    }));

    const App = (await import('../App')).default;
    const user = userEvent.setup();
    render(<App />);

    await user.click(screen.getByRole('button', { name: 'Settings' }));
    await user.click(screen.getByRole('button', { name: /^switch$/i }));

    const orgSheet = screen.getByRole('dialog', { name: /organizations & workspaces/i });
    const createWsBtn = within(orgSheet).getByRole('button', { name: /^create workspace$/i });
    expect(createWsBtn).toBeDisabled();

    const wsInput = within(orgSheet).getByPlaceholderText('e.g. Acme Studio');
    await user.type(wsInput, 'Addis Ventures');
    expect(createWsBtn).not.toBeDisabled();
    await user.click(createWsBtn);

    await waitFor(() => {
      expect(within(orgSheet).getByRole('alert')).toHaveTextContent(
        'Network error: failed to reach /api/organizations'
      );
    });
    // Modal stays open and typed name is preserved
    expect(within(orgSheet).getByPlaceholderText('e.g. Acme Studio')).toHaveValue('Addis Ventures');

    vi.doUnmock('../context/AuthContext');
  });
});
