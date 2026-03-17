// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ProductGrid } from '../ProductGrid';
import { makeShopifyProduct } from '@/test/fixtures';

vi.mock('@/lib/firebase/functions', () => ({
  callFunction: vi.fn(),
}));

import { callFunction } from '@/lib/firebase/functions';

const mockCallFunction = callFunction as ReturnType<typeof vi.fn>;

describe('ProductGrid', () => {
  beforeEach(() => {
    mockCallFunction.mockReset();
  });

  it('shows loading skeleton initially', () => {
    mockCallFunction.mockReturnValue(new Promise(() => {})); // never resolves
    render(<ProductGrid />);
    // Skeleton placeholders exist (animate-pulse divs)
    expect(document.querySelectorAll('.animate-pulse').length).toBeGreaterThan(0);
  });

  it('renders products in grid view', async () => {
    const products = [
      { ...makeShopifyProduct(), id: 'p-1' },
      { ...makeShopifyProduct({ title: 'Winter Coat', productType: 'Coat' }), id: 'p-2' },
    ];

    mockCallFunction.mockResolvedValue({ products });

    render(<ProductGrid />);

    await waitFor(() => {
      expect(screen.getByText('Summer Dress')).toBeInTheDocument();
      expect(screen.getByText('Winter Coat')).toBeInTheDocument();
    });

    expect(screen.getByText('2 products synced from Shopify')).toBeInTheDocument();
  });

  it('renders empty state when no products', async () => {
    mockCallFunction.mockResolvedValue({ products: [] });

    render(<ProductGrid />);

    await waitFor(() => {
      expect(screen.getByText('No products synced yet.')).toBeInTheDocument();
    });
  });

  it('filters products by search query', async () => {
    const user = userEvent.setup();
    const products = [
      { ...makeShopifyProduct(), id: 'p-1' },
      { ...makeShopifyProduct({ title: 'Winter Coat', productType: 'Coat' }), id: 'p-2' },
    ];

    mockCallFunction.mockResolvedValue({ products });

    render(<ProductGrid />);

    await waitFor(() => {
      expect(screen.getByText('Summer Dress')).toBeInTheDocument();
    });

    await user.type(screen.getByLabelText(/search products/i), 'coat');

    expect(screen.queryByText('Summer Dress')).not.toBeInTheDocument();
    expect(screen.getByText('Winter Coat')).toBeInTheDocument();
  });

  it('switches between grid and list views', async () => {
    const user = userEvent.setup();
    const products = [{ ...makeShopifyProduct(), id: 'p-1' }];
    mockCallFunction.mockResolvedValue({ products });

    render(<ProductGrid />);

    await waitFor(() => {
      expect(screen.getByText('Summer Dress')).toBeInTheDocument();
    });

    // Switch to list view
    await user.click(screen.getByRole('button', { name: /list/i }));

    // Table headers should appear in list view
    expect(screen.getByText('Product')).toBeInTheDocument();
    expect(screen.getByText('Variants')).toBeInTheDocument();
  });

  it('shows error state', async () => {
    mockCallFunction.mockRejectedValue({ message: 'Network error' });

    render(<ProductGrid />);

    await waitFor(() => {
      expect(screen.getByRole('alert')).toHaveTextContent('Network error');
    });
  });
});
