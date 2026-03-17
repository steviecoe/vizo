// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import { ContentHub } from '../ContentHub';

vi.mock('@/lib/firebase/functions', () => ({
  callFunction: vi.fn(),
}));

import { callFunction } from '@/lib/firebase/functions';

const mockCallFunction = callFunction as ReturnType<typeof vi.fn>;

const mockArticles = [
  {
    id: 'article-1',
    title: 'Getting Started Guide',
    slug: 'getting-started',
    body: 'This is a comprehensive guide to help you get started with the platform.',
    category: 'tutorial',
    status: 'published',
    coverImageUrl: null,
    tags: ['onboarding', 'basics'],
    publishedAt: '2025-06-01T10:00:00Z',
    createdAt: '2025-06-01T09:00:00Z',
    createdBy: 'admin-uid-1',
    updatedAt: '2025-06-01T10:00:00Z',
    updatedBy: 'admin-uid-1',
  },
  {
    id: 'article-2',
    title: 'Platform Update v2.1',
    slug: 'platform-update-v2-1',
    body: 'We have released new features including video generation.',
    category: 'news',
    status: 'published',
    coverImageUrl: null,
    tags: ['release'],
    publishedAt: '2025-06-02T12:00:00Z',
    createdAt: '2025-06-02T11:00:00Z',
    createdBy: 'admin-uid-1',
    updatedAt: '2025-06-02T12:00:00Z',
    updatedBy: 'admin-uid-1',
  },
];

describe('ContentHub', () => {
  beforeEach(() => {
    mockCallFunction.mockReset();
  });

  it('renders loading skeleton initially', () => {
    mockCallFunction.mockReturnValue(new Promise(() => {}));
    render(<ContentHub />);
    expect(document.querySelectorAll('.animate-pulse').length).toBeGreaterThan(0);
  });

  it('renders articles after loading', async () => {
    mockCallFunction.mockResolvedValue({ articles: mockArticles });

    render(<ContentHub />);

    await waitFor(() => {
      expect(screen.getByText('Help & Resources')).toBeInTheDocument();
    });

    expect(screen.getByText('Getting Started Guide')).toBeInTheDocument();
    expect(screen.getByText('Platform Update v2.1')).toBeInTheDocument();
  });

  it('renders category tabs', async () => {
    mockCallFunction.mockResolvedValue({ articles: mockArticles });

    render(<ContentHub />);

    await waitFor(() => {
      expect(screen.getByText('All')).toBeInTheDocument();
    });

    expect(screen.getByText('Tutorials')).toBeInTheDocument();
    expect(screen.getByText('Guides')).toBeInTheDocument();
    expect(screen.getByText('News')).toBeInTheDocument();
    expect(screen.getByText('Updates')).toBeInTheDocument();
    expect(screen.getByText('FAQ')).toBeInTheDocument();
  });

  it('filters articles by category', async () => {
    mockCallFunction.mockResolvedValue({ articles: mockArticles });

    render(<ContentHub />);

    await waitFor(() => {
      expect(screen.getByText('Getting Started Guide')).toBeInTheDocument();
    });

    // Click on Tutorials tab to filter
    fireEvent.click(screen.getByText('Tutorials'));

    // Should show tutorial article
    expect(screen.getByText('Getting Started Guide')).toBeInTheDocument();
    // Should not show news article
    expect(screen.queryByText('Platform Update v2.1')).not.toBeInTheDocument();
  });

  it('shows empty state when no articles match category', async () => {
    mockCallFunction.mockResolvedValue({ articles: mockArticles });

    render(<ContentHub />);

    await waitFor(() => {
      expect(screen.getByText('Help & Resources')).toBeInTheDocument();
    });

    // Click FAQ - no articles in this category
    fireEvent.click(screen.getByText('FAQ'));

    expect(screen.getByText('No articles available in this category.')).toBeInTheDocument();
  });

  it('opens article reader when clicking an article', async () => {
    mockCallFunction.mockResolvedValue({ articles: mockArticles });

    render(<ContentHub />);

    await waitFor(() => {
      expect(screen.getByText('Getting Started Guide')).toBeInTheDocument();
    });

    // Click the first article
    fireEvent.click(screen.getByText('Getting Started Guide'));

    // Should show article in reader mode
    await waitFor(() => {
      expect(screen.getByText('\u2190 Back to articles')).toBeInTheDocument();
    });

    expect(
      screen.getByText('This is a comprehensive guide to help you get started with the platform.'),
    ).toBeInTheDocument();
  });

  it('navigates back to list from reader', async () => {
    mockCallFunction.mockResolvedValue({ articles: mockArticles });

    render(<ContentHub />);

    await waitFor(() => {
      expect(screen.getByText('Getting Started Guide')).toBeInTheDocument();
    });

    fireEvent.click(screen.getByText('Getting Started Guide'));

    await waitFor(() => {
      expect(screen.getByText('\u2190 Back to articles')).toBeInTheDocument();
    });

    fireEvent.click(screen.getByText('\u2190 Back to articles'));

    await waitFor(() => {
      expect(screen.getByText('Help & Resources')).toBeInTheDocument();
    });
  });

  it('renders error state', async () => {
    mockCallFunction.mockRejectedValue({ message: 'DB unavailable' });

    render(<ContentHub />);

    await waitFor(() => {
      expect(screen.getByRole('alert')).toHaveTextContent('DB unavailable');
    });
  });
});
