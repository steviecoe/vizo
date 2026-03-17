// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import { SupportEmbed } from '../SupportEmbed';

vi.mock('@/lib/firebase/functions', () => ({
  callFunction: vi.fn(),
}));

import { callFunction } from '@/lib/firebase/functions';
const mockCallFunction = callFunction as ReturnType<typeof vi.fn>;

describe('SupportEmbed', () => {
  beforeEach(() => mockCallFunction.mockReset());

  it('shows loading then loaded state with iframe', async () => {
    mockCallFunction.mockResolvedValueOnce({
      zendeskUrl: 'https://vizogroup.zendesk.com',
    });
    render(<SupportEmbed />);

    await waitFor(() => {
      expect(screen.getByText('Support')).toBeInTheDocument();
      expect(screen.getByTitle('Zendesk Support')).toBeInTheDocument();
    });
  });

  it('renders iframe with correct src', async () => {
    mockCallFunction.mockResolvedValueOnce({
      zendeskUrl: 'https://vizogroup.zendesk.com',
    });
    render(<SupportEmbed />);

    await waitFor(() => {
      const iframe = screen.getByTitle('Zendesk Support');
      expect(iframe).toHaveAttribute('src', 'https://vizogroup.zendesk.com');
    });
  });

  it('shows not-configured state when no URL', async () => {
    mockCallFunction.mockResolvedValueOnce({ zendeskUrl: '' });
    render(<SupportEmbed />);

    await waitFor(() => {
      expect(screen.getByText('Support is not yet configured.')).toBeInTheDocument();
    });
  });

  it('shows error state', async () => {
    mockCallFunction.mockRejectedValueOnce({ message: 'Forbidden' });
    render(<SupportEmbed />);

    await waitFor(() => {
      expect(screen.getByRole('alert')).toHaveTextContent('Forbidden');
    });
  });
});
