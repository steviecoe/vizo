// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ImpersonationBanner } from '../ImpersonationBanner';

// Mock useAuth hook
const mockRefreshClaims = vi.fn();
vi.mock('@/lib/hooks/useAuth', () => ({
  useAuth: vi.fn(),
}));

// Mock callFunction
vi.mock('@/lib/firebase/functions', () => ({
  callFunction: vi.fn(),
}));

// Mock firebase auth
vi.mock('firebase/auth', () => ({
  signInWithCustomToken: vi.fn().mockResolvedValue({}),
}));

vi.mock('@/lib/firebase/client', () => ({
  getClientAuth: vi.fn().mockReturnValue({}),
}));

import { useAuth } from '@/lib/hooks/useAuth';
import { callFunction } from '@/lib/firebase/functions';

const mockUseAuth = useAuth as ReturnType<typeof vi.fn>;
const mockCallFunction = callFunction as ReturnType<typeof vi.fn>;

describe('ImpersonationBanner', () => {
  beforeEach(() => {
    mockRefreshClaims.mockReset();
    mockCallFunction.mockReset();
    // Prevent actual navigation
    delete (window as { location?: unknown }).location;
    Object.defineProperty(window, 'location', { value: { href: '' }, writable: true });
  });

  it('renders nothing when not impersonating', () => {
    mockUseAuth.mockReturnValue({
      claims: { role: 'vg_admin' },
      refreshClaims: mockRefreshClaims,
    });

    const { container } = render(<ImpersonationBanner />);
    expect(container.innerHTML).toBe('');
  });

  it('renders banner when impersonating', () => {
    mockUseAuth.mockReturnValue({
      claims: {
        role: 'vg_admin',
        impersonating: true,
        impersonatedTenantId: 'tenant-42',
      },
      refreshClaims: mockRefreshClaims,
    });

    render(<ImpersonationBanner />);

    expect(screen.getByRole('status', { name: /impersonation active/i })).toBeInTheDocument();
    expect(screen.getByText('tenant-42')).toBeInTheDocument();
  });

  it('shows Exit Impersonation button', () => {
    mockUseAuth.mockReturnValue({
      claims: {
        role: 'vg_admin',
        impersonating: true,
        impersonatedTenantId: 'tenant-42',
      },
      refreshClaims: mockRefreshClaims,
    });

    render(<ImpersonationBanner />);

    expect(
      screen.getByRole('button', { name: /exit impersonation/i }),
    ).toBeInTheDocument();
  });

  it('calls endImpersonation and redirects on exit', async () => {
    const user = userEvent.setup();
    mockUseAuth.mockReturnValue({
      claims: {
        role: 'vg_admin',
        impersonating: true,
        impersonatedTenantId: 'tenant-42',
      },
      refreshClaims: mockRefreshClaims,
    });
    mockCallFunction.mockResolvedValue({ customToken: 'clean-token' });

    render(<ImpersonationBanner />);

    await user.click(screen.getByRole('button', { name: /exit impersonation/i }));

    expect(mockCallFunction).toHaveBeenCalledWith('endImpersonation');
    expect(window.location.href).toBe('/admin/tenants');
  });
});
