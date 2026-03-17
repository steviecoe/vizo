// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import { TenantDashboard } from '../TenantDashboard';

vi.mock('@/lib/firebase/functions', () => ({
  callFunction: vi.fn(),
}));

vi.mock('next/link', () => ({
  __esModule: true,
  default: ({ children, href }: { children: React.ReactNode; href: string }) => (
    <a href={href}>{children}</a>
  ),
}));

import { callFunction } from '@/lib/firebase/functions';

const mockCallFunction = callFunction as ReturnType<typeof vi.fn>;

const mockStats = {
  creditBalance: 1250,
  totalGenerated: 84,
  approvedImages: 62,
  pendingImages: 15,
  rejectedImages: 7,
  totalProducts: 23,
  recentLedger: [],
};

const mockHomepage = {
  hero: {
    imageUrl: 'https://example.com/hero.jpg',
    title: 'Test Hero Title',
    subtitle: 'Test subtitle',
    ctaText: 'Go Studio',
    ctaLink: '/tenant/generate/quick',
  },
  whatsNew: [
    {
      imageUrl: 'https://example.com/news.jpg',
      title: 'New Feature',
      description: 'A new feature description',
      tag: 'Update',
      createdAt: '1 hour ago',
    },
  ],
  trending: [
    {
      imageUrl: 'https://example.com/trending.jpg',
      title: 'Trending Item',
      author: '@designer',
    },
  ],
};

describe('TenantDashboard', () => {
  beforeEach(() => {
    mockCallFunction.mockReset();
  });

  it('renders loading skeleton initially', () => {
    mockCallFunction.mockReturnValue(new Promise(() => {}));
    render(<TenantDashboard />);
    expect(document.querySelectorAll('.animate-pulse').length).toBeGreaterThan(0);
  });

  it('renders dashboard header with stats', async () => {
    mockCallFunction
      .mockResolvedValueOnce(mockStats) // getTenantDashboard
      .mockResolvedValueOnce(mockHomepage); // getHomepageConfig

    render(<TenantDashboard />);

    await waitFor(() => {
      expect(screen.getByText('Dashboard')).toBeInTheDocument();
    });

    expect(screen.getByText('Creative Overview')).toBeInTheDocument();
    expect(screen.getByText('New Project')).toBeInTheDocument();
  });

  it('renders hero section with homepage config', async () => {
    mockCallFunction
      .mockResolvedValueOnce(mockStats)
      .mockResolvedValueOnce(mockHomepage);

    render(<TenantDashboard />);

    await waitFor(() => {
      expect(screen.getByText('Test Hero Title')).toBeInTheDocument();
    });

    expect(screen.getByText('Test subtitle')).toBeInTheDocument();
    expect(screen.getByText('Go Studio')).toBeInTheDocument();
  });

  it('renders whats new section', async () => {
    mockCallFunction
      .mockResolvedValueOnce(mockStats)
      .mockResolvedValueOnce(mockHomepage);

    render(<TenantDashboard />);

    await waitFor(() => {
      expect(screen.getByText("What's New")).toBeInTheDocument();
    });

    expect(screen.getByText('New Feature')).toBeInTheDocument();
    expect(screen.getByText('A new feature description')).toBeInTheDocument();
    expect(screen.getByText('Update')).toBeInTheDocument();
  });

  it('uses default content when homepage config is null', async () => {
    mockCallFunction
      .mockResolvedValueOnce(mockStats)
      .mockRejectedValueOnce(new Error('not found')); // getHomepageConfig fails

    render(<TenantDashboard />);

    await waitFor(() => {
      expect(screen.getByText('Mastering High-Fashion AI Generatives')).toBeInTheDocument();
    });

    // Default whats new content
    expect(screen.getByText('Studio V2.0 Live')).toBeInTheDocument();
  });

  it('renders error state', async () => {
    mockCallFunction.mockRejectedValue({ message: 'DB unavailable' });

    render(<TenantDashboard />);

    await waitFor(() => {
      expect(screen.getByRole('alert')).toHaveTextContent('DB unavailable');
    });
  });
});
