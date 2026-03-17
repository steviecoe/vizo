// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { HomepageEditor } from '../HomepageEditor';
import { makeHomepageConfig } from '@/test/fixtures';

vi.mock('@/lib/firebase/functions', () => ({
  callFunction: vi.fn(),
}));

import { callFunction } from '@/lib/firebase/functions';
const mockCallFunction = callFunction as ReturnType<typeof vi.fn>;

describe('HomepageEditor', () => {
  beforeEach(() => mockCallFunction.mockReset());

  it('loads and shows hero editor by default', async () => {
    mockCallFunction.mockResolvedValueOnce(makeHomepageConfig());
    render(<HomepageEditor />);

    await waitFor(() => {
      expect(screen.getByLabelText('Title')).toBeInTheDocument();
    });

    expect(screen.getByLabelText('Title')).toHaveValue('Welcome to Vizo');
    expect(screen.getByLabelText(/subtitle/i)).toHaveValue('AI-powered fashion photography');
  });

  it('shows tab navigation for Hero, Whats New, Trending', async () => {
    mockCallFunction.mockResolvedValueOnce(makeHomepageConfig());
    render(<HomepageEditor />);

    await waitFor(() => {
      expect(screen.getByText('Hero')).toBeInTheDocument();
      expect(screen.getByText("What's New")).toBeInTheDocument();
      expect(screen.getByText('Trending')).toBeInTheDocument();
    });
  });

  it('switches to Whats New tab and shows Add Card button', async () => {
    mockCallFunction.mockResolvedValueOnce(makeHomepageConfig());
    const user = userEvent.setup();
    render(<HomepageEditor />);

    await waitFor(() => {
      expect(screen.getByText("What's New")).toBeInTheDocument();
    });

    await user.click(screen.getByText("What's New"));
    expect(screen.getByText('+ Add Card')).toBeInTheDocument();
  });

  it('adds and removes a whats new card', async () => {
    mockCallFunction.mockResolvedValueOnce(makeHomepageConfig());
    const user = userEvent.setup();
    render(<HomepageEditor />);

    await waitFor(() => {
      expect(screen.getByText("What's New")).toBeInTheDocument();
    });

    await user.click(screen.getByText("What's New"));
    await user.click(screen.getByText('+ Add Card'));

    expect(screen.getByText('Card 1')).toBeInTheDocument();

    await user.click(screen.getByText('Remove'));

    expect(screen.queryByText('Card 1')).not.toBeInTheDocument();
  });

  it('saves changes and shows success', async () => {
    mockCallFunction
      .mockResolvedValueOnce(makeHomepageConfig()) // getHomepageConfig
      .mockResolvedValueOnce({ success: true }); // updateHomepageConfig

    const user = userEvent.setup();
    render(<HomepageEditor />);

    await waitFor(() => {
      expect(screen.getByLabelText('Title')).toBeInTheDocument();
    });

    await user.clear(screen.getByLabelText('Title'));
    await user.type(screen.getByLabelText('Title'), 'New Title');
    await user.click(screen.getByRole('button', { name: /save changes/i }));

    await waitFor(() => {
      expect(screen.getByRole('status')).toHaveTextContent('Changes saved');
    });
  });

  it('shows error on save failure', async () => {
    mockCallFunction
      .mockResolvedValueOnce(makeHomepageConfig())
      .mockRejectedValueOnce({ message: 'Permission denied' });

    const user = userEvent.setup();
    render(<HomepageEditor />);

    await waitFor(() => {
      expect(screen.getByLabelText('Title')).toBeInTheDocument();
    });

    await user.click(screen.getByRole('button', { name: /save changes/i }));

    await waitFor(() => {
      expect(screen.getByRole('alert')).toHaveTextContent('Permission denied');
    });
  });

  it('switches to Trending tab', async () => {
    mockCallFunction.mockResolvedValueOnce(makeHomepageConfig());
    const user = userEvent.setup();
    render(<HomepageEditor />);

    await waitFor(() => {
      expect(screen.getByText('Trending')).toBeInTheDocument();
    });

    await user.click(screen.getByText('Trending'));
    expect(screen.getByText('+ Add Trending')).toBeInTheDocument();
  });
});
