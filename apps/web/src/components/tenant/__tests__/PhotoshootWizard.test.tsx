// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { PhotoshootWizard } from '../PhotoshootWizard';
import { makeArtDirectionModel, makeArtDirectionBackground, makeShopifyProduct } from '@/test/fixtures';

vi.mock('@/lib/firebase/functions', () => ({
  callFunction: vi.fn(),
}));

import { callFunction } from '@/lib/firebase/functions';
const mockCallFunction = callFunction as ReturnType<typeof vi.fn>;

const model1 = { ...makeArtDirectionModel(), id: 'm-1' };
const model2 = { ...makeArtDirectionModel({ name: 'Winter Model', gender: 'male' }), id: 'm-2' };
const bg1 = { ...makeArtDirectionBackground(), id: 'bg-1' };
const bg2 = { ...makeArtDirectionBackground({ name: 'Beach Outdoor', type: 'outdoor' }), id: 'bg-2' };
const product1 = { ...makeShopifyProduct(), id: 'p-1' };

function setupLoadAssets() {
  mockCallFunction
    .mockResolvedValueOnce({ models: [model1, model2] }) // listModels
    .mockResolvedValueOnce({ backgrounds: [bg1, bg2] }) // listBackgrounds
    .mockResolvedValueOnce({ products: [product1] }); // listProducts
}

describe('PhotoshootWizard', () => {
  beforeEach(() => mockCallFunction.mockReset());

  it('loads and displays models, backgrounds, products', async () => {
    setupLoadAssets();
    render(<PhotoshootWizard />);

    await waitFor(() => {
      expect(screen.getByText('Summer Model')).toBeInTheDocument();
      expect(screen.getByText('Winter Model')).toBeInTheDocument();
      expect(screen.getByText('White Studio')).toBeInTheDocument();
      expect(screen.getByText('Beach Outdoor')).toBeInTheDocument();
      expect(screen.getByText('Summer Dress')).toBeInTheDocument();
    });
  });

  it('shows 4-step wizard indicator', async () => {
    setupLoadAssets();
    render(<PhotoshootWizard />);

    await waitFor(() => {
      expect(screen.getByText('Select')).toBeInTheDocument();
      expect(screen.getByText('Configure')).toBeInTheDocument();
      expect(screen.getByText('Schedule')).toBeInTheDocument();
      expect(screen.getByText('Review')).toBeInTheDocument();
    });
  });

  it('validates: requires at least one model and background', async () => {
    setupLoadAssets();
    const user = userEvent.setup();
    render(<PhotoshootWizard />);

    await waitFor(() => {
      expect(screen.getByText('Summer Model')).toBeInTheDocument();
    });

    // Try to proceed without selecting anything
    await user.click(screen.getByRole('button', { name: /next: configure/i }));

    expect(screen.getByText(/select at least one model/i)).toBeInTheDocument();
  });

  it('advances to Configure step after valid selection', async () => {
    setupLoadAssets();
    const user = userEvent.setup();
    render(<PhotoshootWizard />);

    await waitFor(() => {
      expect(screen.getByText('Summer Model')).toBeInTheDocument();
    });

    // Select a model and background
    await user.click(screen.getByText('Summer Model'));
    await user.click(screen.getByText('White Studio'));
    await user.click(screen.getByRole('button', { name: /next: configure/i }));

    expect(screen.getByLabelText(/photoshoot name/i)).toBeInTheDocument();
  });

  it('shows scheduling options with overnight discount', async () => {
    setupLoadAssets();
    const user = userEvent.setup();
    render(<PhotoshootWizard />);

    await waitFor(() => {
      expect(screen.getByText('Summer Model')).toBeInTheDocument();
    });

    await user.click(screen.getByText('Summer Model'));
    await user.click(screen.getByText('White Studio'));
    await user.click(screen.getByRole('button', { name: /next: configure/i }));

    // Fill name and advance
    await user.type(screen.getByLabelText(/photoshoot name/i), 'Spring Shoot');
    await user.click(screen.getByRole('button', { name: /next: schedule/i }));

    expect(screen.getByText(/start immediately/i)).toBeInTheDocument();
    expect(screen.getByText(/schedule overnight/i)).toBeInTheDocument();
    expect(screen.getByText(/discounted rates/i)).toBeInTheDocument();
  });

  it('shows review summary with total images calculation', async () => {
    setupLoadAssets();
    const user = userEvent.setup();
    render(<PhotoshootWizard />);

    await waitFor(() => {
      expect(screen.getByText('Summer Model')).toBeInTheDocument();
    });

    await user.click(screen.getByText('Summer Model'));
    await user.click(screen.getByText('Winter Model'));
    await user.click(screen.getByText('White Studio'));
    await user.click(screen.getByRole('button', { name: /next: configure/i }));

    await user.type(screen.getByLabelText(/photoshoot name/i), 'Big Shoot');
    await user.click(screen.getByRole('button', { name: /next: schedule/i }));
    await user.click(screen.getByRole('button', { name: /next: review/i }));

    expect(screen.getByText('Photoshoot Summary')).toBeInTheDocument();
    expect(screen.getByText('Big Shoot')).toBeInTheDocument();
    // Verify model count appears in the summary (dd element, not step indicator)
    const modelsDt = screen.getByText('Models');
    expect(modelsDt.closest('div')!.querySelector('dd')!.textContent).toBe('2');
  });

  it('submits photoshoot and shows scheduled result', async () => {
    setupLoadAssets();
    const user = userEvent.setup();

    // After asset loading calls, mock createPhotoshoot
    mockCallFunction.mockResolvedValueOnce({
      photoshootId: 'ps-1',
      status: 'scheduled',
      scheduledFor: '2025-02-01T02:00:00.000Z',
      totalImages: 6,
      totalCreditsEstimate: 18,
    });

    render(<PhotoshootWizard />);

    await waitFor(() => {
      expect(screen.getByText('Summer Model')).toBeInTheDocument();
    });

    await user.click(screen.getByText('Summer Model'));
    await user.click(screen.getByText('White Studio'));
    await user.click(screen.getByRole('button', { name: /next: configure/i }));
    await user.type(screen.getByLabelText(/photoshoot name/i), 'Test');
    await user.click(screen.getByRole('button', { name: /next: schedule/i }));
    await user.click(screen.getByRole('button', { name: /next: review/i }));
    await user.click(screen.getByRole('button', { name: /schedule photoshoot/i }));

    await waitFor(() => {
      expect(screen.getByText(/photoshoot scheduled/i)).toBeInTheDocument();
      expect(screen.getByText('18')).toBeInTheDocument(); // credits
    });
  });

  it('shows error state with refund note', async () => {
    setupLoadAssets();
    const user = userEvent.setup();
    mockCallFunction.mockRejectedValueOnce({ message: 'Insufficient credits' });

    render(<PhotoshootWizard />);

    await waitFor(() => {
      expect(screen.getByText('Summer Model')).toBeInTheDocument();
    });

    await user.click(screen.getByText('Summer Model'));
    await user.click(screen.getByText('White Studio'));
    await user.click(screen.getByRole('button', { name: /next: configure/i }));
    await user.type(screen.getByLabelText(/photoshoot name/i), 'Fail');
    await user.click(screen.getByRole('button', { name: /next: schedule/i }));
    // Switch to immediate
    await user.click(screen.getByText(/start immediately/i));
    await user.click(screen.getByRole('button', { name: /next: review/i }));
    await user.click(screen.getByRole('button', { name: /start photoshoot/i }));

    await waitFor(() => {
      expect(screen.getByText(/photoshoot failed/i)).toBeInTheDocument();
      expect(screen.getByText(/insufficient credits/i)).toBeInTheDocument();
      expect(screen.getByText(/automatically refunded/i)).toBeInTheDocument();
    });
  });

  it('supports back navigation', async () => {
    setupLoadAssets();
    const user = userEvent.setup();
    render(<PhotoshootWizard />);

    await waitFor(() => {
      expect(screen.getByText('Summer Model')).toBeInTheDocument();
    });

    await user.click(screen.getByText('Summer Model'));
    await user.click(screen.getByText('White Studio'));
    await user.click(screen.getByRole('button', { name: /next: configure/i }));

    expect(screen.getByLabelText(/photoshoot name/i)).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: /back/i }));

    expect(screen.getByText('Models (required)')).toBeInTheDocument();
  });
});
