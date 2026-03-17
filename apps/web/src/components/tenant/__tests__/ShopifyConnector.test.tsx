// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ShopifyConnector } from '../ShopifyConnector';

vi.mock('@/lib/firebase/functions', () => ({
  callFunction: vi.fn(),
}));

import { callFunction } from '@/lib/firebase/functions';

const mockCallFunction = callFunction as ReturnType<typeof vi.fn>;

describe('ShopifyConnector', () => {
  beforeEach(() => {
    mockCallFunction.mockReset();
  });

  describe('disconnected state', () => {
    beforeEach(() => {
      // getTenantShopifyConfig returns no connection
      mockCallFunction.mockResolvedValueOnce({
        shopify: { storeDomain: null, connectedAt: null, lastSyncAt: null },
      });
    });

    it('renders the connection form', async () => {
      render(<ShopifyConnector />);

      await waitFor(() => {
        expect(screen.getByText('Connect Your Store')).toBeInTheDocument();
      });

      expect(screen.getByLabelText(/store domain/i)).toBeInTheDocument();
      expect(screen.getByLabelText(/admin api access token/i)).toBeInTheDocument();
    });

    it('shows the API key field as a password input', async () => {
      render(<ShopifyConnector />);

      await waitFor(() => {
        expect(screen.getByLabelText(/admin api access token/i)).toBeInTheDocument();
      });

      const input = screen.getByLabelText(/admin api access token/i);
      expect(input).toHaveAttribute('type', 'password');
      expect(input).toHaveAttribute('autocomplete', 'off');
    });

    it('shows Secret Manager disclosure', async () => {
      render(<ShopifyConnector />);

      await waitFor(() => {
        const matches = screen.getAllByText(/secret manager/i);
        expect(matches.length).toBeGreaterThan(0);
      });
    });

    it('validates input before connecting', async () => {
      const user = userEvent.setup();
      render(<ShopifyConnector />);

      await waitFor(() => {
        expect(screen.getByText('Connect Your Store')).toBeInTheDocument();
      });

      await user.click(screen.getByRole('button', { name: /connect store/i }));

      const alerts = screen.getAllByRole('alert');
      expect(alerts.length).toBeGreaterThan(0);
    });

    it('calls connectShopify on valid submit', async () => {
      const user = userEvent.setup();
      // 1st call: load config, 2nd call: connectShopify
      mockCallFunction
        .mockResolvedValueOnce({
          shopify: { storeDomain: null, connectedAt: null, lastSyncAt: null },
        })
        .mockResolvedValueOnce({ success: true, storeDomain: 'test.myshopify.com' });

      render(<ShopifyConnector />);

      await waitFor(() => {
        expect(screen.getByLabelText(/store domain/i)).toBeInTheDocument();
      });

      await user.type(screen.getByLabelText(/store domain/i), 'test.myshopify.com');
      await user.type(screen.getByLabelText(/admin api access token/i), 'shpat_abc');
      await user.click(screen.getByRole('button', { name: /connect store/i }));

      await waitFor(() => {
        expect(screen.getByText('Store Connected')).toBeInTheDocument();
      });

      expect(mockCallFunction).toHaveBeenCalledWith('connectShopify', {
        storeDomain: 'test.myshopify.com',
        adminApiKey: 'shpat_abc',
      });
    });

    it('shows server error on connection failure', async () => {
      const user = userEvent.setup();
      // beforeEach already mocked the initial load; only add the rejection for connectShopify
      mockCallFunction.mockRejectedValueOnce({ message: 'Invalid Shopify API credentials' });

      render(<ShopifyConnector />);

      await waitFor(() => {
        expect(screen.getByLabelText(/store domain/i)).toBeInTheDocument();
      });

      await user.type(screen.getByLabelText(/store domain/i), 'bad.myshopify.com');
      await user.type(screen.getByLabelText(/admin api access token/i), 'shpat_bad');
      await user.click(screen.getByRole('button', { name: /connect store/i }));

      await waitFor(() => {
        expect(screen.getByRole('alert')).toHaveTextContent(
          /invalid shopify api credentials/i,
        );
      });
    });
  });

  describe('connected state', () => {
    beforeEach(() => {
      mockCallFunction.mockResolvedValueOnce({
        shopify: {
          storeDomain: 'my-store.myshopify.com',
          connectedAt: '2025-01-01T00:00:00Z',
          lastSyncAt: null,
        },
      });
    });

    it('renders connected status with store domain', async () => {
      render(<ShopifyConnector />);

      await waitFor(() => {
        expect(screen.getByText('Store Connected')).toBeInTheDocument();
      });

      expect(screen.getByText('my-store.myshopify.com')).toBeInTheDocument();
    });

    it('has Sync Products and Disconnect buttons', async () => {
      render(<ShopifyConnector />);

      await waitFor(() => {
        expect(
          screen.getByRole('button', { name: /sync products/i }),
        ).toBeInTheDocument();
        expect(
          screen.getByRole('button', { name: /disconnect/i }),
        ).toBeInTheDocument();
      });
    });

    it('shows sync result after successful sync', async () => {
      const user = userEvent.setup();
      mockCallFunction.mockResolvedValueOnce({
        success: true,
        synced: 15,
        archived: 2,
      });

      render(<ShopifyConnector />);

      await waitFor(() => {
        expect(screen.getByRole('button', { name: /sync products/i })).toBeInTheDocument();
      });

      await user.click(screen.getByRole('button', { name: /sync products/i }));

      await waitFor(() => {
        expect(screen.getByRole('status')).toHaveTextContent('15 products synced');
        expect(screen.getByRole('status')).toHaveTextContent('2 archived');
      });
    });
  });
});
