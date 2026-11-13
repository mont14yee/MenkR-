import { describe, it, expect, vi, beforeEach } from 'vitest';
import { 
  validateRequired, 
  validateEmail, 
  validatePhone, 
  validatePositiveNumber, 
  validateUrl, 
  validateDateString, 
  safeJsonParse 
} from '../utils/validation';
import { checkClientDependencies, checkProjectDependencies } from '../services/activityService';
import { pushDataToPostgres } from '../services/syncService';

describe('Validation, Error Handling, and Resilience', () => {
  describe('Input Validation Utilities', () => {
    it('validates required fields and strips leading/trailing whitespace', () => {
      expect(validateRequired('').isValid).toBe(false);
      expect(validateRequired('   ').isValid).toBe(false);
      expect(validateRequired(null).isValid).toBe(false);
      expect(validateRequired(undefined).isValid).toBe(false);

      const valid = validateRequired('  Design System  ', 'Project Name');
      expect(valid.isValid).toBe(true);
      expect(valid.value).toBe('Design System');
    });

    it('validates email addresses accurately', () => {
      // Valid emails
      expect(validateEmail('mon14yee@gmail.com').isValid).toBe(true);
      expect(validateEmail('alex.smith+test@sub.example.co.uk').isValid).toBe(true);

      // Invalid emails
      expect(validateEmail('invalid-email').isValid).toBe(false);
      expect(validateEmail('@missing-user.com').isValid).toBe(false);
      expect(validateEmail('user@missing-tld').isValid).toBe(false);
      expect(validateEmail('user@.com').isValid).toBe(false);

      // Optional behavior
      expect(validateEmail('', false).isValid).toBe(true);
      expect(validateEmail('', true).isValid).toBe(false);
    });

    it('validates international and domestic phone numbers', () => {
      expect(validatePhone('+1 555-0199').isValid).toBe(true);
      expect(validatePhone('(555) 234-5678').isValid).toBe(true);
      expect(validatePhone('+44 20 7946 0991').isValid).toBe(true);

      // Invalid phone
      expect(validatePhone('abc-phone').isValid).toBe(false);
      expect(validatePhone('12').isValid).toBe(false); // too short

      // Optional behavior
      expect(validatePhone('', false).isValid).toBe(true);
      expect(validatePhone('', true).isValid).toBe(false);
    });

    it('validates positive numbers and monetary amounts strictly', () => {
      // Valid positive numbers
      const validAmount = validatePositiveNumber('1500.50', 'Budget');
      expect(validAmount.isValid).toBe(true);
      expect(validAmount.value).toBe(1500.5);

      // Rejects negative amounts and zero when zero is disallowed
      expect(validatePositiveNumber('-250', 'Expense').isValid).toBe(false);
      expect(validatePositiveNumber(0, 'Hourly Rate', false).isValid).toBe(false);

      // Allows zero when explicitly permitted
      expect(validatePositiveNumber(0, 'Hourly Rate', true).isValid).toBe(true);

      // Rejects non-numeric strings
      expect(validatePositiveNumber('not-a-number').isValid).toBe(false);
    });

    it('validates web URLs safely', () => {
      expect(validateUrl('https://example.com').isValid).toBe(true);
      expect(validateUrl('subdomain.company.org/path?q=1').isValid).toBe(true);

      // Optional behavior
      expect(validateUrl('', false).isValid).toBe(true);
      expect(validateUrl('', true).isValid).toBe(false);
    });

    it('validates date strings (YYYY-MM-DD or standard parseable dates)', () => {
      expect(validateDateString('2026-11-03').isValid).toBe(true);
      expect(validateDateString('2026-12-31T23:59:59.000Z').isValid).toBe(true);

      // Invalid dates
      expect(validateDateString('invalid-date').isValid).toBe(false);
      expect(validateDateString('').isValid).toBe(false);
      expect(validateDateString(null).isValid).toBe(false);
    });

    it('safely parses JSON without throwing unhandled fatal exceptions', () => {
      const fallback = { status: 'default' };

      // Valid JSON
      const good = safeJsonParse('{"status": "ok", "count": 5}', fallback);
      expect(good.success).toBe(true);
      expect((good.data as any).count).toBe(5);

      // Corrupted / malformed JSON recovers using fallback
      const corrupt = safeJsonParse('{status: broken, json', fallback);
      expect(corrupt.success).toBe(false);
      expect(corrupt.data).toEqual(fallback);
      expect(corrupt.error).toBeDefined();

      // Empty input
      const empty = safeJsonParse('', fallback);
      expect(empty.success).toBe(false);
      expect(empty.data).toEqual(fallback);
    });
  });

  describe('Service Failure and Network Resilience', () => {
    beforeEach(() => {
      vi.restoreAllMocks();
    });

    it('checkClientDependencies handles network timeouts and 500 errors gracefully returning null fallback', async () => {
      global.fetch = vi.fn().mockRejectedValue(new Error('Network timeout'));

      const result = await checkClientDependencies('test-token', 'org-1', 'client-xyz');
      // When network drops, returns null preventing blocking client deletion flow
      expect(result).toBeNull();

      // When API succeeds, returns parsed dependencies
      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({ clientId: 'client-xyz', hasDependencies: true, projectsCount: 2, tasksCount: 5 }),
      });
      const successResult = await checkClientDependencies('test-token', 'org-1', 'client-xyz');
      expect(successResult).not.toBeNull();
      expect(successResult?.hasDependencies).toBe(true);
      expect(successResult?.projectsCount).toBe(2);
      expect(successResult?.tasksCount).toBe(5);
    });

    it('checkProjectDependencies handles network drop gracefully and parses successful responses', async () => {
      global.fetch = vi.fn().mockRejectedValue(new Error('Connection reset'));

      const result = await checkProjectDependencies('test-token', 'org-1', 'proj-xyz');
      expect(result).toBeNull();

      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({ projectId: 'proj-xyz', hasDependencies: true, tasksCount: 3, timeEntriesCount: 4 }),
      });
      const successResult = await checkProjectDependencies('test-token', 'org-1', 'proj-xyz');
      expect(successResult).not.toBeNull();
      expect(successResult?.hasDependencies).toBe(true);
      expect(successResult?.tasksCount).toBe(3);
      expect(successResult?.timeEntriesCount).toBe(4);
    });

    it('pushDataToPostgres surfaces meaningful error message when server responds with 400/500', async () => {
      global.fetch = vi.fn().mockResolvedValue({
        ok: false,
        json: () => Promise.resolve({ error: 'Database constraint violation: duplicate slug' }),
      });

      await expect(
        pushDataToPostgres('dummy-token', { name: 'Test', email: 'test@example.com', avatarSeed: 'seed' }, {})
      ).rejects.toThrow('Database constraint violation: duplicate slug');
    });
  });

  describe('BottomSheet Form Save and Submission Resilience', () => {
    beforeEach(async () => {
      const { cleanup } = await import('@testing-library/react');
      cleanup();
    });

    it('disables save button and displays saving state when isSaving is true', async () => {
      const { render, screen } = await import('@testing-library/react');
      const { BottomSheet } = await import('../components/BottomSheet');

      const onSaveMock = vi.fn();
      const { rerender } = render(
        <BottomSheet
          isOpen={true}
          onClose={() => {}}
          title="Create Record"
          onSave={onSaveMock}
          saveLabel="Save"
          isSaving={false}
          saveDisabled={false}
        >
          <div>Form Content</div>
        </BottomSheet>
      );

      const saveBtn = screen.getByRole('button', { name: 'Save' });
      expect(saveBtn).not.toBeDisabled();

      // When saving is active
      rerender(
        <BottomSheet
          isOpen={true}
          onClose={() => {}}
          title="Create Record"
          onSave={onSaveMock}
          saveLabel="Save"
          isSaving={true}
          saveDisabled={false}
        >
          <div>Form Content</div>
        </BottomSheet>
      );

      const savingBtn = screen.getByRole('button', { name: 'Saving...' });
      expect(savingBtn).toBeDisabled();
    });

    it('disables save button when saveDisabled is explicitly set', async () => {
      const { render, screen } = await import('@testing-library/react');
      const { BottomSheet } = await import('../components/BottomSheet');

      render(
        <BottomSheet
          isOpen={true}
          onClose={() => {}}
          title="Create Record"
          onSave={() => {}}
          saveLabel="Submit"
          saveDisabled={true}
        >
          <div>Form Content</div>
        </BottomSheet>
      );

      const btn = screen.getByRole('button', { name: 'Submit' });
      expect(btn).toBeDisabled();
    });

    it('prevents double submission during async save and shows loading state', async () => {
      const { render, screen, waitFor } = await import('@testing-library/react');
      const userEvent = (await import('@testing-library/user-event')).default;
      const { BottomSheet } = await import('../components/BottomSheet');

      let resolveSave!: () => void;
      const onSaveMock = vi.fn(
        () =>
          new Promise<void>((resolve) => {
            resolveSave = resolve;
          })
      );

      const user = userEvent.setup();
      render(
        <BottomSheet
          isOpen={true}
          onClose={() => {}}
          title="New Client"
          onSave={onSaveMock}
          saveLabel="Create Client"
          savingLabel="Creating..."
        >
          <div>Client Form</div>
        </BottomSheet>
      );

      const btn = screen.getByRole('button', { name: 'Create Client' });
      await user.click(btn);
      await user.click(btn);

      expect(onSaveMock).toHaveBeenCalledTimes(1);
      const loadingBtn = screen.getByRole('button', { name: 'Creating...' });
      expect(loadingBtn).toBeDisabled();
      expect(loadingBtn).toHaveAttribute('aria-busy', 'true');

      resolveSave();
      await waitFor(() => {
        expect(screen.getByRole('button', { name: 'Create Client' })).not.toBeDisabled();
      });
    });

    it('displays inline error alert, keeps sheet open, and preserves entered data when save fails', async () => {
      const { render, screen, waitFor } = await import('@testing-library/react');
      const userEvent = (await import('@testing-library/user-event')).default;
      const React = await import('react');
      const { BottomSheet } = await import('../components/BottomSheet');

      const onCloseMock = vi.fn();

      function TestHarness() {
        const [value, setValue] = React.useState('');
        const [isOpen, setIsOpen] = React.useState(true);
        const handleSave = async () => {
          throw new Error('Network error while saving transaction');
        };
        return (
          <BottomSheet
            isOpen={isOpen}
            onClose={() => {
              setIsOpen(false);
              onCloseMock();
            }}
            title="Record Transaction"
            onSave={handleSave}
            saveLabel="Save Transaction"
          >
            <input
              aria-label="Amount"
              value={value}
              onChange={(e) => setValue(e.target.value)}
            />
          </BottomSheet>
        );
      }

      const user = userEvent.setup();
      render(<TestHarness />);

      const input = screen.getByLabelText('Amount');
      await user.type(input, '425.50');
      await user.click(screen.getByRole('button', { name: 'Save Transaction' }));

      await waitFor(() => {
        expect(screen.getByRole('alert')).toHaveTextContent(
          'Network error while saving transaction'
        );
      });
      expect(onCloseMock).not.toHaveBeenCalled();
      expect(screen.getByLabelText('Amount')).toHaveValue('425.50');
    });

    it('exposes contextual labels and disabled state until valid inputs on Finance and Tasks forms', async () => {
      const { render, screen, within } = await import('@testing-library/react');
      const userEvent = (await import('@testing-library/user-event')).default;
      const App = (await import('../App')).default;

      window.localStorage.setItem('menkir-seen-onboarding', 'true');
      const user = userEvent.setup();
      render(<App />);

      // Open Tasks via Productivity tab -> verify disabled Create Task until title entered
      await user.click(screen.getByRole('button', { name: /go to productivity tab/i }));
      await user.click(screen.getByText('Tasks', { selector: 'h3' }));
      await user.click(screen.getByRole('button', { name: /add task/i }));

      const newTaskDialog = screen.getByRole('dialog', { name: /new task/i });
      const createTaskBtn = within(newTaskDialog).getByRole('button', { name: /^create task$/i });
      expect(createTaskBtn).toBeDisabled();

      await user.type(within(newTaskDialog).getByPlaceholderText(/task title/i), 'Review Architecture');
      expect(createTaskBtn).not.toBeDisabled();
      await user.click(createTaskBtn);

      // Edit task -> verify Save Changes label
      const taskNodes = screen.getAllByText('Review Architecture');
      await user.click(taskNodes[taskNodes.length - 1]);
      const editTaskDialog = screen.getByRole('dialog', { name: /edit task/i });
      expect(within(editTaskDialog).getByRole('button', { name: /^save changes$/i })).toBeInTheDocument();
      await user.click(within(editTaskDialog).getByRole('button', { name: /close sheet/i }));
      const backBtns = screen.getAllByRole('button', { name: /^back$/i });
      await user.click(backBtns[backBtns.length - 1]);

      // Open Finance -> verify Save Transaction disabled until amount > 0
      await user.click(screen.getByText('Finance', { selector: 'h3' }));
      await user.click(screen.getAllByRole('button', { name: /log revenue/i })[0]);

      const txDialog = screen.getByRole('dialog', { name: /record transaction/i });
      const saveTxBtn = within(txDialog).getByRole('button', { name: /^save transaction$/i });
      expect(saveTxBtn).toBeDisabled();
      await user.type(within(txDialog).getByPlaceholderText('0.00'), '1500');
      expect(saveTxBtn).not.toBeDisabled();
    });

    it('requires explicit approval before saving AI-generated templates and opens unified SaveActionButton', async () => {
      const { render, screen, waitFor, within } = await import('@testing-library/react');
      const userEvent = (await import('@testing-library/user-event')).default;
      const App = (await import('../App')).default;

      window.localStorage.clear();
      window.localStorage.setItem('menkir-seen-onboarding', 'true');

      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        json: () =>
          Promise.resolve({
            text: JSON.stringify({
              name: 'Client Onboarding Flow',
              description: 'End-to-end onboarding plan',
              type: 'project',
              projectPriority: 'high',
              projectDurationDays: 14,
              tasks: [
                { title: 'Kickoff Call', priority: 'High', durationMinutes: 45, offsetDays: 0 },
              ],
            }),
          }),
      }) as any;

      const user = userEvent.setup();
      render(<App />);

      await user.click(screen.getByRole('button', { name: /go to productivity tab/i }));
      await user.click(screen.getByText('Templates', { selector: 'h3' }));
      await user.click(screen.getByRole('button', { name: /generate with ai/i }));

      const aiDialog = screen.getByRole('dialog', { name: /generate ai template/i });
      await user.type(
        within(aiDialog).getByPlaceholderText(/onboarding workflow/i),
        'Design agency onboarding'
      );
      await user.click(within(aiDialog).getByRole('button', { name: /^generate template$/i }));

      // Wait for approval review screen — must NOT auto-save before user approves
      const reviewDialog = await screen.findByRole('dialog', { name: /review generated template/i });
      expect(within(reviewDialog).getByDisplayValue('Client Onboarding Flow')).toBeInTheDocument();
      const storedBeforeApproval = JSON.parse(window.localStorage.getItem('menkir-templates') || '[]');
      expect(storedBeforeApproval).toHaveLength(0);

      // Approve & save
      await user.click(within(reviewDialog).getByRole('button', { name: /approve & save template/i }));

      await waitFor(() => {
        expect(screen.getByText('Client Onboarding Flow')).toBeInTheDocument();
      });
      const storedAfterApproval = JSON.parse(window.localStorage.getItem('menkir-templates') || '[]');
      expect(storedAfterApproval).toHaveLength(1);
    });

    it('preserves client relationship when logging revenue from a linked project', async () => {
      const { render, screen, waitFor, within } = await import('@testing-library/react');
      const userEvent = (await import('@testing-library/user-event')).default;
      const App = (await import('../App')).default;

      window.localStorage.clear();
      window.localStorage.setItem('menkir-seen-onboarding', 'true');
      window.localStorage.setItem(
        'menkir-clients',
        JSON.stringify([
          { id: 'c-1', name: 'Apex Corp', status: 'active', tags: [], avatarSeed: 'seed-1' },
        ])
      );
      window.localStorage.setItem(
        'menkir-projects',
        JSON.stringify([
          {
            id: 'p-1',
            index: 'PRJ-01',
            name: 'Apex Portal',
            priority: 'high',
            completionPct: 20,
            tone: 'lime',
            status: 'active',
            clientId: 'c-1',
          },
        ])
      );

      const user = userEvent.setup();
      render(<App />);

      await user.click(screen.getByRole('button', { name: /go to projects tab/i }));
      await user.click(screen.getAllByText('Apex Portal')[0]);
      await user.click(screen.getByRole('button', { name: /log revenue/i }));

      const revDialog = screen.getByRole('dialog', { name: /add revenue entry/i });
      const saveRevBtn = within(revDialog).getByRole('button', { name: /^save transaction$/i });
      expect(saveRevBtn).toBeDisabled();

      await user.type(within(revDialog).getByPlaceholderText('e.g. 5000'), '2750');
      expect(saveRevBtn).not.toBeDisabled();
      await user.click(saveRevBtn);

      await waitFor(() => {
        const storedRevenues = JSON.parse(window.localStorage.getItem('menkir-revenue') || '[]');
        expect(storedRevenues).toHaveLength(1);
        expect(storedRevenues[0]).toMatchObject({
          amount: 2750,
          projectId: 'p-1',
          clientId: 'c-1',
        });
      });
    });
  });
});
