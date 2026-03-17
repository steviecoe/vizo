// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QuickGenWizard } from '../QuickGenWizard';
import { makeArtDirectionModel, makeArtDirectionBackground, makeShopifyProduct } from '@/test/fixtures';

vi.mock('@/lib/firebase/functions', () => ({
  callFunction: vi.fn(),
}));

import { callFunction } from '@/lib/firebase/functions';
const mockCallFunction = callFunction as ReturnType<typeof vi.fn>;

function setupAssets() {
  const models = [{ ...makeArtDirectionModel(), id: 'm-1' }];
  const backgrounds = [{ ...makeArtDirectionBackground(), id: 'bg-1' }];
  const products = [{ ...makeShopifyProduct(), id: 'p-1' }];

  mockCallFunction
    .mockResolvedValueOnce({ models })
    .mockResolvedValueOnce({ backgrounds })
    .mockResolvedValueOnce({ products });

  return { models, backgrounds, products };
}

describe('QuickGenWizard', () => {
  beforeEach(() => mockCallFunction.mockReset());

  it('loads assets and renders studio layout', async () => {
    setupAssets();
    render(<QuickGenWizard />);

    await waitFor(() => {
      expect(screen.getByText('AI Generation Studio')).toBeInTheDocument();
    });

    // Shows product selection section
    expect(screen.getByText('1. Product Selection')).toBeInTheDocument();
    // Shows product name in the list
    expect(screen.getByText('Summer Dress')).toBeInTheDocument();
    // Shows model persona section
    expect(screen.getByText('2. Model Persona')).toBeInTheDocument();
    expect(screen.getByText('Summer Model')).toBeInTheDocument();
    // Shows environment section
    expect(screen.getByText('3. Environment')).toBeInTheDocument();
    expect(screen.getByText('White Studio')).toBeInTheDocument();
  });

  it('generate button is disabled when no product selected', async () => {
    setupAssets();
    render(<QuickGenWizard />);

    await waitFor(() => {
      expect(screen.getByText('Summer Dress')).toBeInTheDocument();
    });

    const generateBtn = screen.getByRole('button', { name: /generate/i });
    expect(generateBtn).toBeDisabled();
  });

  it('generate button enables after selecting a product', async () => {
    const user = userEvent.setup();
    setupAssets();
    render(<QuickGenWizard />);

    await waitFor(() => {
      expect(screen.getByText('Summer Dress')).toBeInTheDocument();
    });

    await user.click(screen.getByText('Summer Dress'));

    const generateBtn = screen.getByRole('button', { name: /generate/i });
    expect(generateBtn).toBeEnabled();
  });

  it('shows technical settings (resolution, aspect ratio, variants)', async () => {
    setupAssets();
    render(<QuickGenWizard />);

    await waitFor(() => {
      expect(screen.getByText('AI Generation Studio')).toBeInTheDocument();
    });

    expect(screen.getAllByText('Resolution').length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText('Aspect Ratio').length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText('Variants').length).toBeGreaterThanOrEqual(1);
    expect(screen.getByText('1K')).toBeInTheDocument();
    expect(screen.getByText('2K')).toBeInTheDocument();
  });

  it('shows creative direction textarea', async () => {
    setupAssets();
    render(<QuickGenWizard />);

    await waitFor(() => {
      expect(screen.getByText('4. Creative Direction')).toBeInTheDocument();
    });

    expect(screen.getByPlaceholderText(/describe the mood/i)).toBeInTheDocument();
  });

  it('shows generation status panel with empty state', async () => {
    setupAssets();
    render(<QuickGenWizard />);

    await waitFor(() => {
      expect(screen.getByText('Generation Status')).toBeInTheDocument();
    });

    expect(screen.getByText('No generations yet')).toBeInTheDocument();
  });

  it('shows success result with credits info', async () => {
    const user = userEvent.setup();
    setupAssets();
    render(<QuickGenWizard />);

    await waitFor(() => {
      expect(screen.getByText('Summer Dress')).toBeInTheDocument();
    });

    // Select a product
    await user.click(screen.getByText('Summer Dress'));

    // Mock the quickGenerate call
    mockCallFunction.mockResolvedValueOnce({
      jobId: 'job-12345678',
      status: 'completed',
      completedImages: 1,
      failedImages: 0,
      creditsCost: 5,
      creditsRefunded: 0,
    });

    await user.click(screen.getByRole('button', { name: /generate/i }));

    await waitFor(() => {
      expect(screen.getByText('Complete')).toBeInTheDocument();
      expect(screen.getByText('Images Generated')).toBeInTheDocument();
    });
  });

  it('shows error with refund note on failure', async () => {
    const user = userEvent.setup();
    setupAssets();
    render(<QuickGenWizard />);

    await waitFor(() => {
      expect(screen.getByText('Summer Dress')).toBeInTheDocument();
    });

    await user.click(screen.getByText('Summer Dress'));

    mockCallFunction.mockRejectedValueOnce({ message: 'Insufficient credits' });

    await user.click(screen.getByRole('button', { name: /generate/i }));

    await waitFor(() => {
      expect(screen.getByText('Generation Failed')).toBeInTheDocument();
      expect(screen.getByText(/insufficient credits/i)).toBeInTheDocument();
      expect(screen.getByText(/automatically refunded/i)).toBeInTheDocument();
    });
  });
});
