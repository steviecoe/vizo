// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { AdminTopupDialog } from '../AdminTopupDialog';
import { makeTenant } from '@/test/fixtures';

vi.mock('@/lib/firebase/functions', () => ({
  callFunction: vi.fn(),
}));

import { callFunction } from '@/lib/firebase/functions';

const mockCallFunction = callFunction as ReturnType<typeof vi.fn>;

function renderDialog(props?: Partial<React.ComponentProps<typeof AdminTopupDialog>>) {
  const tenant = { ...makeTenant(), id: 'tenant-1' };
  const defaultProps = {
    tenant,
    onClose: vi.fn(),
    onCompleted: vi.fn(),
    ...props,
  };
  return { ...render(<AdminTopupDialog {...defaultProps} />), ...defaultProps, tenant };
}

describe('AdminTopupDialog', () => {
  beforeEach(() => {
    mockCallFunction.mockReset();
  });

  // ─── Rendering ─────────────────────────────────

  describe('rendering', () => {
    it('renders nothing when tenant is null', () => {
      render(<AdminTopupDialog tenant={null} onClose={vi.fn()} onCompleted={vi.fn()} />);
      expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    });

    it('renders the dialog when tenant is provided', () => {
      renderDialog();
      expect(screen.getByRole('dialog', { name: /top up credits/i })).toBeInTheDocument();
    });

    it('shows tenant name and current balance', () => {
      renderDialog();
      expect(screen.getByText('Fashion Brand Co')).toBeInTheDocument();
      expect(screen.getByText(/1,000 credits/)).toBeInTheDocument();
    });

    it('renders credit amount and description inputs', () => {
      renderDialog();
      expect(screen.getByLabelText(/credit amount/i)).toBeInTheDocument();
      expect(screen.getByLabelText(/description/i)).toBeInTheDocument();
    });
  });

  // ─── Validation ────────────────────────────────

  describe('validation', () => {
    it('shows errors on empty submit', async () => {
      const user = userEvent.setup();
      renderDialog();

      await user.click(screen.getByRole('button', { name: /add credits/i }));

      const alerts = screen.getAllByRole('alert');
      expect(alerts.length).toBeGreaterThan(0);
    });

    it('shows error for missing description', async () => {
      const user = userEvent.setup();
      renderDialog();

      await user.type(screen.getByLabelText(/credit amount/i), '500');
      await user.click(screen.getByRole('button', { name: /add credits/i }));

      const alerts = screen.getAllByRole('alert');
      expect(alerts.length).toBeGreaterThan(0);
    });
  });

  // ─── Success state ─────────────────────────────

  describe('success state', () => {
    it('shows success card after successful top-up', async () => {
      const user = userEvent.setup();
      mockCallFunction.mockResolvedValue({
        success: true,
        ledgerEntryId: 'ledger-abc-123',
      });

      renderDialog();

      await user.type(screen.getByLabelText(/credit amount/i), '500');
      await user.type(screen.getByLabelText(/description/i), 'Free trial');
      await user.click(screen.getByRole('button', { name: /add credits/i }));

      expect(screen.getByRole('heading', { name: /credits added/i })).toBeInTheDocument();
      expect(screen.getByText('+500')).toBeInTheDocument();
      expect(screen.getByText('1,500')).toBeInTheDocument();
      expect(screen.getByText('ledger-abc-123')).toBeInTheDocument();
    });

    it('calls the function with correct payload', async () => {
      const user = userEvent.setup();
      mockCallFunction.mockResolvedValue({ success: true, ledgerEntryId: 'x' });

      renderDialog();

      await user.type(screen.getByLabelText(/credit amount/i), '200');
      await user.type(screen.getByLabelText(/description/i), 'Test topup');
      await user.click(screen.getByRole('button', { name: /add credits/i }));

      expect(mockCallFunction).toHaveBeenCalledWith('adminTopupCredits', {
        tenantId: 'tenant-1',
        creditAmount: 200,
        description: 'Test topup',
      });
    });
  });

  // ─── Error state ───────────────────────────────

  describe('error state', () => {
    it('shows error message on failure', async () => {
      const user = userEvent.setup();
      mockCallFunction.mockRejectedValue({ message: 'Server exploded' });

      renderDialog();

      await user.type(screen.getByLabelText(/credit amount/i), '500');
      await user.type(screen.getByLabelText(/description/i), 'Test');
      await user.click(screen.getByRole('button', { name: /add credits/i }));

      expect(screen.getByText(/server exploded/i)).toBeInTheDocument();
    });

    it('preserves form data on error', async () => {
      const user = userEvent.setup();
      mockCallFunction.mockRejectedValue({ message: 'fail' });

      renderDialog();

      await user.type(screen.getByLabelText(/credit amount/i), '500');
      await user.type(screen.getByLabelText(/description/i), 'Keep this');
      await user.click(screen.getByRole('button', { name: /add credits/i }));

      expect(screen.getByLabelText(/credit amount/i)).toHaveValue(500);
      expect(screen.getByLabelText(/description/i)).toHaveValue('Keep this');
    });
  });

  // ─── Close ─────────────────────────────────────

  describe('close', () => {
    it('calls onClose when Cancel is clicked', async () => {
      const user = userEvent.setup();
      const { onClose } = renderDialog();

      await user.click(screen.getByRole('button', { name: /cancel/i }));
      expect(onClose).toHaveBeenCalled();
    });
  });
});
