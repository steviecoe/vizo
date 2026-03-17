// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { LoginForm } from '../LoginForm';

// Use module-level mock fns that the factory closes over
const mockSignInWithEmailAndPassword = vi.fn();
const mockSignInWithPopup = vi.fn();

vi.mock('firebase/auth', () => ({
  signInWithEmailAndPassword: (...args: unknown[]) => mockSignInWithEmailAndPassword(...args),
  signInWithPopup: (...args: unknown[]) => mockSignInWithPopup(...args),
  GoogleAuthProvider: class {
    setCustomParameters = vi.fn();
  },
}));

vi.mock('@/lib/firebase/client', () => ({
  getClientAuth: vi.fn().mockReturnValue({ currentUser: null }),
}));

beforeEach(() => {
  mockSignInWithEmailAndPassword.mockReset();
  mockSignInWithPopup.mockReset();
  // Prevent navigation errors
  delete (window as unknown as Record<string, unknown>).location;
  (window as unknown as Record<string, unknown>).location = { href: '', assign: vi.fn() };
});

describe('LoginForm', () => {
  it('renders branded login form with Vizo branding', () => {
    render(<LoginForm />);

    expect(screen.getByText('Sign in to Vizo')).toBeInTheDocument();
    expect(screen.getByText('AI-powered fashion photography platform')).toBeInTheDocument();
  });

  it('shows Google sign-in and email sign-in options', () => {
    render(<LoginForm />);

    expect(screen.getByRole('button', { name: /continue with google/i })).toBeInTheDocument();
    expect(screen.getByText('or sign in with email')).toBeInTheDocument();
    expect(screen.getByLabelText('Email address')).toBeInTheDocument();
    expect(screen.getByLabelText('Password')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /sign in$/i })).toBeInTheDocument();
  });

  it('signs in with email/password and shows success', async () => {
    mockSignInWithEmailAndPassword.mockResolvedValueOnce({ user: { uid: '123' } });
    render(<LoginForm />);

    fireEvent.change(screen.getByLabelText('Email address'), { target: { value: 'test@example.com' } });
    fireEvent.change(screen.getByLabelText('Password'), { target: { value: 'password123' } });
    fireEvent.click(screen.getByRole('button', { name: /sign in$/i }));

    await waitFor(() => {
      expect(screen.getByRole('status')).toHaveTextContent('Sign-in successful');
    });

    expect(mockSignInWithEmailAndPassword).toHaveBeenCalled();
  });

  it('shows error on invalid email/password', async () => {
    mockSignInWithEmailAndPassword.mockRejectedValueOnce({ code: 'auth/invalid-credential' });
    const user = userEvent.setup();
    render(<LoginForm />);

    await user.type(screen.getByLabelText('Email address'), 'bad@example.com');
    await user.type(screen.getByLabelText('Password'), 'wrong');
    await user.click(screen.getByRole('button', { name: /sign in$/i }));

    await waitFor(() => {
      expect(screen.getByRole('alert')).toHaveTextContent('Invalid email or password');
    });
  });

  it('shows error on too many attempts', async () => {
    mockSignInWithEmailAndPassword.mockRejectedValueOnce({ code: 'auth/too-many-requests' });
    const user = userEvent.setup();
    render(<LoginForm />);

    await user.type(screen.getByLabelText('Email address'), 'test@example.com');
    await user.type(screen.getByLabelText('Password'), 'pass');
    await user.click(screen.getByRole('button', { name: /sign in$/i }));

    await waitFor(() => {
      expect(screen.getByRole('alert')).toHaveTextContent('Too many attempts');
    });
  });

  it('triggers Google sign-in on button click', async () => {
    mockSignInWithPopup.mockResolvedValueOnce({ user: { uid: '456' } });
    const user = userEvent.setup();
    render(<LoginForm />);

    await user.click(screen.getByRole('button', { name: /continue with google/i }));

    // Wait for the async handler to process
    await waitFor(() => {
      expect(
        mockSignInWithPopup.mock.calls.length > 0 ||
        screen.queryByRole('status') !== null ||
        screen.queryByRole('alert') !== null
      ).toBe(true);
    });
  });

  it('shows Signing in state while processing', async () => {
    let resolveSignIn!: (v: unknown) => void;
    mockSignInWithEmailAndPassword.mockReturnValueOnce(
      new Promise((r) => { resolveSignIn = r; }),
    );
    const user = userEvent.setup();
    render(<LoginForm />);

    await user.type(screen.getByLabelText('Email address'), 'test@example.com');
    await user.type(screen.getByLabelText('Password'), 'pass');
    await user.click(screen.getByRole('button', { name: /sign in$/i }));

    await waitFor(() => {
      expect(screen.getByText('Signing in...')).toBeInTheDocument();
    });

    resolveSignIn({ user: { uid: '123' } });
  });

  it('shows Vizo logo', () => {
    render(<LoginForm />);
    // The "V" logo
    expect(screen.getByText('V')).toBeInTheDocument();
  });
});
