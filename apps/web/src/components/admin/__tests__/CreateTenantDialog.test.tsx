// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { CreateTenantDialog } from '../CreateTenantDialog';

// Mock the callFunction helper
vi.mock('@/lib/firebase/functions', () => ({
  callFunction: vi.fn(),
}));

import { callFunction } from '@/lib/firebase/functions';

const mockCallFunction = callFunction as ReturnType<typeof vi.fn>;

function renderDialog(props?: Partial<React.ComponentProps<typeof CreateTenantDialog>>) {
  const defaultProps = {
    isOpen: true,
    onClose: vi.fn(),
    onCreated: vi.fn(),
    ...props,
  };
  return { ...render(<CreateTenantDialog {...defaultProps} />), ...defaultProps };
}

describe('CreateTenantDialog', () => {
  beforeEach(() => {
    mockCallFunction.mockReset();
  });

  // ─── Rendering ───────────────────────────────────

  describe('rendering', () => {
    it('renders nothing when isOpen is false', () => {
      render(
        <CreateTenantDialog isOpen={false} onClose={vi.fn()} onCreated={vi.fn()} />,
      );
      expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    });

    it('renders the dialog when isOpen is true', () => {
      renderDialog();
      expect(screen.getByRole('dialog', { name: /create tenant/i })).toBeInTheDocument();
    });

    it('renders all form sections', () => {
      renderDialog();
      expect(screen.getByLabelText(/name/i)).toBeInTheDocument();
      expect(screen.getByLabelText(/slug/i)).toBeInTheDocument();
      expect(screen.getByLabelText(/price per credit/i)).toBeInTheDocument();
      expect(screen.getByText(/shopify integration/i)).toBeInTheDocument();
      expect(screen.getByText(/photoshoot mode/i)).toBeInTheDocument();
      expect(screen.getByText(/quick generation/i)).toBeInTheDocument();
      expect(screen.getByText(/gemini api key/i)).toBeInTheDocument();
      expect(screen.getByText(/tenant admin emails/i)).toBeInTheDocument();
    });

    it('renders the API key input as a password field', () => {
      renderDialog();
      const input = document.getElementById('tenant-api-key') as HTMLInputElement;
      expect(input.type).toBe('password');
      expect(input.autocomplete).toBe('off');
    });
  });

  // ─── Auto-slug generation ────────────────────────

  describe('slug auto-generation', () => {
    it('auto-generates slug from name', async () => {
      const user = userEvent.setup();
      renderDialog();

      await user.type(screen.getByLabelText(/name/i), 'My Fashion Brand');

      expect(screen.getByLabelText(/slug/i)).toHaveValue('my-fashion-brand');
    });

    it('stops auto-generating after slug is manually edited', async () => {
      const user = userEvent.setup();
      renderDialog();

      // Type name first
      await user.type(screen.getByLabelText(/name/i), 'Brand');
      expect(screen.getByLabelText(/slug/i)).toHaveValue('brand');

      // Manually edit slug
      await user.clear(screen.getByLabelText(/slug/i));
      await user.type(screen.getByLabelText(/slug/i), 'custom-slug');

      // Type more in name - slug should not change
      await user.clear(screen.getByLabelText(/name/i));
      await user.type(screen.getByLabelText(/name/i), 'New Brand');
      expect(screen.getByLabelText(/slug/i)).toHaveValue('custom-slug');
    });
  });

  // ─── Email management ────────────────────────────

  describe('email management', () => {
    it('adds an email when Add button is clicked', async () => {
      const user = userEvent.setup();
      renderDialog();

      const emailInput = screen.getByPlaceholderText('admin@brand.com');
      await user.type(emailInput, 'test@example.com');
      await user.click(screen.getByRole('button', { name: /^add$/i }));

      expect(screen.getByText('test@example.com')).toBeInTheDocument();
    });

    it('adds an email on Enter key', async () => {
      const user = userEvent.setup();
      renderDialog();

      const emailInput = screen.getByPlaceholderText('admin@brand.com');
      await user.type(emailInput, 'test@example.com{enter}');

      expect(screen.getByText('test@example.com')).toBeInTheDocument();
    });

    it('removes an email when Remove button is clicked', async () => {
      const user = userEvent.setup();
      renderDialog();

      // Add two emails
      const emailInput = screen.getByPlaceholderText('admin@brand.com');
      await user.type(emailInput, 'first@test.com{enter}');
      await user.type(emailInput, 'second@test.com{enter}');

      expect(screen.getByText('first@test.com')).toBeInTheDocument();
      expect(screen.getByText('second@test.com')).toBeInTheDocument();

      // Remove first
      await user.click(screen.getByRole('button', { name: /remove first@test.com/i }));

      expect(screen.queryByText('first@test.com')).not.toBeInTheDocument();
      expect(screen.getByText('second@test.com')).toBeInTheDocument();
    });

    it('does not add duplicate emails', async () => {
      const user = userEvent.setup();
      renderDialog();

      const emailInput = screen.getByPlaceholderText('admin@brand.com');
      await user.type(emailInput, 'test@example.com{enter}');
      await user.type(emailInput, 'test@example.com{enter}');

      const items = screen.getAllByText('test@example.com');
      expect(items).toHaveLength(1);
    });
  });

  // ─── Validation ──────────────────────────────────

  describe('validation', () => {
    it('shows field errors on invalid submit', async () => {
      const user = userEvent.setup();
      renderDialog();

      // Submit with empty form
      await user.click(screen.getByRole('button', { name: /create tenant/i }));

      // Should show validation errors
      const alerts = screen.getAllByRole('alert');
      expect(alerts.length).toBeGreaterThan(0);
    });

    it('shows error for missing admin emails', async () => {
      const user = userEvent.setup();
      renderDialog();

      // Fill required fields but no email
      await user.type(screen.getByLabelText(/name/i), 'Test');
      await user.type(screen.getByLabelText(/price per credit/i), '0.5');
      const apiKeyInput = document.getElementById('tenant-api-key')!;
      await user.type(apiKeyInput, 'key-123');

      await user.click(screen.getByRole('button', { name: /create tenant/i }));

      const alerts = screen.getAllByRole('alert');
      expect(alerts.length).toBeGreaterThan(0);
    });
  });

  // ─── Creating state ──────────────────────────────

  describe('creating state', () => {
    it('disables form during creation', async () => {
      const user = userEvent.setup();
      // Make callFunction hang (never resolve)
      mockCallFunction.mockReturnValue(new Promise(() => {}));

      renderDialog();

      // Fill valid form
      await user.type(screen.getByLabelText(/name/i), 'Test Brand');
      await user.type(screen.getByLabelText(/price per credit/i), '0.5');
      const apiKeyInput = document.getElementById('tenant-api-key')!;
      await user.type(apiKeyInput, 'key-123');
      await user.type(screen.getByPlaceholderText('admin@brand.com'), 'admin@test.com{enter}');

      await user.click(screen.getByRole('button', { name: /create tenant/i }));

      // Button should show "Creating..."
      expect(screen.getByRole('button', { name: /creating/i })).toBeInTheDocument();

      // Name input should be disabled
      expect(screen.getByLabelText(/name/i)).toBeDisabled();
    });
  });

  // ─── Success state ───────────────────────────────

  describe('success state', () => {
    async function fillAndSubmitForm() {
      const user = userEvent.setup();
      mockCallFunction.mockResolvedValue({
        success: true,
        tenantId: 'new-tenant-123',
        message: 'Tenant "Test Brand" created with 1 admin(s)',
      });

      renderDialog();

      await user.type(screen.getByLabelText(/name/i), 'Test Brand');
      await user.type(screen.getByLabelText(/price per credit/i), '0.5');
      const apiKeyInput = document.getElementById('tenant-api-key')!;
      await user.type(apiKeyInput, 'key-123');
      await user.type(screen.getByPlaceholderText('admin@brand.com'), 'admin@test.com{enter}');

      await user.click(screen.getByRole('button', { name: /create tenant/i }));
    }

    it('shows success card after successful creation', async () => {
      await fillAndSubmitForm();

      expect(
        screen.getByText(/tenant created successfully/i),
      ).toBeInTheDocument();
    });

    it('displays tenant details in success card', async () => {
      await fillAndSubmitForm();

      expect(screen.getByText('Test Brand')).toBeInTheDocument();
      expect(screen.getByText('new-tenant-123')).toBeInTheDocument();
      expect(screen.getByText('test-brand')).toBeInTheDocument();
      expect(screen.getByText('admin@test.com')).toBeInTheDocument();
    });

    it('shows API key stored confirmation, not the actual key', async () => {
      await fillAndSubmitForm();

      expect(
        screen.getByText(/stored in gcp secret manager/i),
      ).toBeInTheDocument();
      expect(screen.queryByText('key-123')).not.toBeInTheDocument();
    });

    it('calls callFunction with correct payload', async () => {
      await fillAndSubmitForm();

      expect(mockCallFunction).toHaveBeenCalledWith('createTenant', {
        name: 'Test Brand',
        slug: 'test-brand',
        pricePerCredit: 0.5,
        allowedFeatures: {
          shopifyIntegration: true,
          photoshootMode: true,
          quickGeneration: true,
        },
        adminEmails: ['admin@test.com'],
        geminiApiKey: 'key-123',
      });
    });
  });

  // ─── Error state ─────────────────────────────────

  describe('error state', () => {
    it('shows error message on failure', async () => {
      const user = userEvent.setup();
      mockCallFunction.mockRejectedValue({
        code: 'functions/internal',
        message: 'Something went wrong',
      });

      renderDialog();

      await user.type(screen.getByLabelText(/name/i), 'Test Brand');
      await user.type(screen.getByLabelText(/price per credit/i), '0.5');
      const apiKeyInput = document.getElementById('tenant-api-key')!;
      await user.type(apiKeyInput, 'key-123');
      await user.type(screen.getByPlaceholderText('admin@brand.com'), 'admin@test.com{enter}');

      await user.click(screen.getByRole('button', { name: /create tenant/i }));

      expect(screen.getByText(/something went wrong/i)).toBeInTheDocument();
    });

    it('shows user-friendly message for duplicate slug', async () => {
      const user = userEvent.setup();
      mockCallFunction.mockRejectedValue({
        code: 'functions/already-exists',
        message: 'Tenant with slug "test-brand" already exists',
      });

      renderDialog();

      await user.type(screen.getByLabelText(/name/i), 'Test Brand');
      await user.type(screen.getByLabelText(/price per credit/i), '0.5');
      const apiKeyInput = document.getElementById('tenant-api-key')!;
      await user.type(apiKeyInput, 'key-123');
      await user.type(screen.getByPlaceholderText('admin@brand.com'), 'admin@test.com{enter}');

      await user.click(screen.getByRole('button', { name: /create tenant/i }));

      expect(
        screen.getByText(/already exists.*different slug/i),
      ).toBeInTheDocument();
    });

    it('preserves form data on error for retry', async () => {
      const user = userEvent.setup();
      mockCallFunction.mockRejectedValue({
        code: 'functions/internal',
        message: 'Server error',
      });

      renderDialog();

      await user.type(screen.getByLabelText(/name/i), 'Test Brand');
      await user.type(screen.getByLabelText(/price per credit/i), '0.5');
      const apiKeyInput = document.getElementById('tenant-api-key')!;
      await user.type(apiKeyInput, 'key-123');
      await user.type(screen.getByPlaceholderText('admin@brand.com'), 'admin@test.com{enter}');

      await user.click(screen.getByRole('button', { name: /create tenant/i }));

      // Form data should still be present
      expect(screen.getByLabelText(/name/i)).toHaveValue('Test Brand');
      expect(screen.getByText('admin@test.com')).toBeInTheDocument();
    });
  });

  // ─── Dialog close / reset ────────────────────────

  describe('dialog close', () => {
    it('calls onClose and resets form when Cancel is clicked', async () => {
      const user = userEvent.setup();
      const { onClose } = renderDialog();

      await user.type(screen.getByLabelText(/name/i), 'Test Brand');
      await user.click(screen.getByRole('button', { name: /cancel/i }));

      expect(onClose).toHaveBeenCalled();
    });
  });
});
