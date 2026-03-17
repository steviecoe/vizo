// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { BackgroundLibrary } from '../BackgroundLibrary';
import { makeArtDirectionBackground } from '@/test/fixtures';

vi.mock('@/lib/firebase/functions', () => ({
  callFunction: vi.fn(),
}));

import { callFunction } from '@/lib/firebase/functions';
const mockCallFunction = callFunction as ReturnType<typeof vi.fn>;

describe('BackgroundLibrary', () => {
  beforeEach(() => mockCallFunction.mockReset());

  it('renders backgrounds from server', async () => {
    const backgrounds = [
      { ...makeArtDirectionBackground(), id: 'bg-1' },
      { ...makeArtDirectionBackground({ name: 'Beach Sunset', type: 'outdoor' }), id: 'bg-2' },
    ];
    mockCallFunction.mockResolvedValue({ backgrounds });

    render(<BackgroundLibrary />);

    await waitFor(() => {
      expect(screen.getByText('White Studio')).toBeInTheDocument();
      expect(screen.getByText('Beach Sunset')).toBeInTheDocument();
    });
  });

  it('shows empty state', async () => {
    mockCallFunction.mockResolvedValue({ backgrounds: [] });

    render(<BackgroundLibrary />);

    await waitFor(() => {
      expect(screen.getByText('No backgrounds defined yet.')).toBeInTheDocument();
    });
  });

  it('opens create form with type selector', async () => {
    const user = userEvent.setup();
    mockCallFunction.mockResolvedValue({ backgrounds: [] });

    render(<BackgroundLibrary />);

    await waitFor(() => {
      expect(screen.getByRole('button', { name: /add background/i })).toBeInTheDocument();
    });

    await user.click(screen.getByRole('button', { name: /add background/i }));

    expect(screen.getByRole('heading', { name: /create background/i })).toBeInTheDocument();
    expect(screen.getByLabelText(/name/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/type/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/description/i)).toBeInTheDocument();

    // Type selector options
    expect(screen.getByText('Studio')).toBeInTheDocument();
    expect(screen.getByText('Outdoor')).toBeInTheDocument();
    expect(screen.getByText('Campaign')).toBeInTheDocument();
    expect(screen.getByText('Custom')).toBeInTheDocument();
  });

  it('validates form on empty submit', async () => {
    const user = userEvent.setup();
    mockCallFunction.mockResolvedValue({ backgrounds: [] });

    render(<BackgroundLibrary />);

    await waitFor(() => {
      expect(screen.getByRole('button', { name: /add background/i })).toBeInTheDocument();
    });

    await user.click(screen.getByRole('button', { name: /add background/i }));
    await user.click(screen.getByRole('button', { name: /create background/i }));

    const alerts = screen.getAllByRole('alert');
    expect(alerts.length).toBeGreaterThan(0);
  });

  it('shows type badge on cards', async () => {
    mockCallFunction.mockResolvedValue({
      backgrounds: [{ ...makeArtDirectionBackground({ type: 'outdoor' }), id: 'bg-1' }],
    });

    render(<BackgroundLibrary />);

    await waitFor(() => {
      expect(screen.getByText('outdoor')).toBeInTheDocument();
    });
  });
});
