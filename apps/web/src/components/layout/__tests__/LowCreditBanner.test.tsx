// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { LowCreditBanner } from '../LowCreditBanner';

vi.mock('@/lib/firebase/functions', () => ({
  callFunction: vi.fn(),
}));

vi.mock('@/lib/hooks/useAuth', () => ({
  useAuth: vi.fn(),
}));

import { callFunction } from '@/lib/firebase/functions';
import { useAuth } from '@/lib/hooks/useAuth';
const mockCallFunction = callFunction as ReturnType<typeof vi.fn>;
const mockUseAuth = useAuth as ReturnType<typeof vi.fn>;

describe('LowCreditBanner', () => {
  beforeEach(() => {
    mockCallFunction.mockReset();
    mockUseAuth.mockReset();
  });

  it('renders nothing for non-tenant users', () => {
    mockUseAuth.mockReturnValue({ claims: { role: 'vg_admin' }, user: {}, loading: false, refreshClaims: vi.fn() });
    render(<LowCreditBanner />);

    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
  });

  it('renders nothing when balance is above threshold', async () => {
    mockUseAuth.mockReturnValue({ claims: { role: 'tenant_admin' }, user: {}, loading: false, refreshClaims: vi.fn() });
    mockCallFunction.mockResolvedValueOnce({ creditBalance: 500, lowCreditThreshold: 50 });

    render(<LowCreditBanner />);

    // Wait for async check, then verify no banner
    await waitFor(() => {
      expect(mockCallFunction).toHaveBeenCalledWith('getBillingInfo');
    });

    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
  });

  it('shows warning when balance is at or below threshold', async () => {
    mockUseAuth.mockReturnValue({ claims: { role: 'tenant_admin' }, user: {}, loading: false, refreshClaims: vi.fn() });
    mockCallFunction.mockResolvedValueOnce({ creditBalance: 30, lowCreditThreshold: 50 });

    render(<LowCreditBanner />);

    await waitFor(() => {
      expect(screen.getByRole('alert')).toBeInTheDocument();
      expect(screen.getByText(/30 credits/)).toBeInTheDocument();
    });
  });

  it('shows Top up now link', async () => {
    mockUseAuth.mockReturnValue({ claims: { role: 'tenant_admin' }, user: {}, loading: false, refreshClaims: vi.fn() });
    mockCallFunction.mockResolvedValueOnce({ creditBalance: 10, lowCreditThreshold: 50 });

    render(<LowCreditBanner />);

    await waitFor(() => {
      const link = screen.getByText('Top up now');
      expect(link).toHaveAttribute('href', '/tenant/credits');
    });
  });

  it('can be dismissed', async () => {
    mockUseAuth.mockReturnValue({ claims: { role: 'tenant_admin' }, user: {}, loading: false, refreshClaims: vi.fn() });
    mockCallFunction.mockResolvedValueOnce({ creditBalance: 10, lowCreditThreshold: 50 });

    const user = userEvent.setup();
    render(<LowCreditBanner />);

    await waitFor(() => {
      expect(screen.getByRole('alert')).toBeInTheDocument();
    });

    await user.click(screen.getByLabelText('Dismiss low credit warning'));

    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
  });

  it('works for tenant_user role too', async () => {
    mockUseAuth.mockReturnValue({ claims: { role: 'tenant_user' }, user: {}, loading: false, refreshClaims: vi.fn() });
    mockCallFunction.mockResolvedValueOnce({ creditBalance: 20, lowCreditThreshold: 50 });

    render(<LowCreditBanner />);

    await waitFor(() => {
      expect(screen.getByRole('alert')).toBeInTheDocument();
    });
  });
});
