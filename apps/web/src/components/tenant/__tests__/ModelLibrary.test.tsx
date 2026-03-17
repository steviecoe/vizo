// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ModelLibrary } from '../ModelLibrary';
import { makeArtDirectionModel } from '@/test/fixtures';

vi.mock('@/lib/firebase/functions', () => ({
  callFunction: vi.fn(),
}));

import { callFunction } from '@/lib/firebase/functions';
const mockCallFunction = callFunction as ReturnType<typeof vi.fn>;

describe('ModelLibrary', () => {
  beforeEach(() => mockCallFunction.mockReset());

  it('renders models from server', async () => {
    const models = [
      { ...makeArtDirectionModel(), id: 'm-1' },
      { ...makeArtDirectionModel({ name: 'Winter Model', gender: 'male' }), id: 'm-2' },
    ];
    mockCallFunction.mockResolvedValue({ models });

    render(<ModelLibrary />);

    await waitFor(() => {
      expect(screen.getByText('Summer Model')).toBeInTheDocument();
      expect(screen.getByText('Winter Model')).toBeInTheDocument();
    });
  });

  it('shows empty state when no models', async () => {
    mockCallFunction.mockResolvedValue({ models: [] });

    render(<ModelLibrary />);

    await waitFor(() => {
      expect(screen.getByText('No models defined yet.')).toBeInTheDocument();
    });
  });

  it('shows Add Model button', async () => {
    mockCallFunction.mockResolvedValue({ models: [] });

    render(<ModelLibrary />);

    await waitFor(() => {
      expect(screen.getByRole('button', { name: /add model/i })).toBeInTheDocument();
    });
  });

  it('opens create form when Add Model clicked', async () => {
    const user = userEvent.setup();
    mockCallFunction.mockResolvedValue({ models: [] });

    render(<ModelLibrary />);

    await waitFor(() => {
      expect(screen.getByRole('button', { name: /add model/i })).toBeInTheDocument();
    });

    await user.click(screen.getByRole('button', { name: /add model/i }));

    expect(screen.getByRole('heading', { name: /create model/i })).toBeInTheDocument();
    expect(screen.getByLabelText(/name/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/gender/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/skin colour/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/clothing size/i)).toBeInTheDocument();
  });

  it('validates form and shows errors', async () => {
    const user = userEvent.setup();
    mockCallFunction.mockResolvedValue({ models: [] });

    render(<ModelLibrary />);

    await waitFor(() => {
      expect(screen.getByRole('button', { name: /add model/i })).toBeInTheDocument();
    });

    await user.click(screen.getByRole('button', { name: /add model/i }));
    await user.click(screen.getByRole('button', { name: /create model/i }));

    const alerts = screen.getAllByRole('alert');
    expect(alerts.length).toBeGreaterThan(0);
  });

  it('renders clothing size options from UK 8 to 18', async () => {
    const user = userEvent.setup();
    mockCallFunction.mockResolvedValue({ models: [] });

    render(<ModelLibrary />);

    await waitFor(() => {
      expect(screen.getByRole('button', { name: /add model/i })).toBeInTheDocument();
    });

    await user.click(screen.getByRole('button', { name: /add model/i }));

    const sizeSelect = screen.getByLabelText(/clothing size/i);
    expect(sizeSelect).toBeInTheDocument();
    expect(screen.getByText('UK 8')).toBeInTheDocument();
    expect(screen.getByText('UK 18')).toBeInTheDocument();
  });

  it('shows model details on card', async () => {
    const model = {
      ...makeArtDirectionModel({
        skinColour: 'dark',
        hairColour: 'black',
        clothingSize: 16,
      }),
      id: 'm-1',
    };
    mockCallFunction.mockResolvedValue({ models: [model] });

    render(<ModelLibrary />);

    await waitFor(() => {
      expect(screen.getByText('dark')).toBeInTheDocument();
      expect(screen.getByText('black')).toBeInTheDocument();
      expect(screen.getByText('UK 16')).toBeInTheDocument();
    });
  });
});
