// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import { CmsManager } from '../CmsManager';

vi.mock('@/lib/firebase/functions', () => ({
  callFunction: vi.fn(),
}));

import { callFunction } from '@/lib/firebase/functions';

const mockCallFunction = callFunction as ReturnType<typeof vi.fn>;

const mockArticles = [
  {
    id: 'article-1',
    title: 'Getting Started',
    slug: 'getting-started',
    body: 'Welcome guide content.',
    category: 'tutorial',
    status: 'published',
    coverImageUrl: null,
    tags: ['onboarding'],
    publishedAt: '2025-06-01T10:00:00Z',
    createdAt: '2025-06-01T09:00:00Z',
    createdBy: 'admin-uid-1',
    updatedAt: '2025-06-01T10:00:00Z',
    updatedBy: 'admin-uid-1',
  },
  {
    id: 'article-2',
    title: 'Draft Article',
    slug: 'draft-article',
    body: 'Work in progress content.',
    category: 'news',
    status: 'draft',
    coverImageUrl: null,
    tags: [],
    publishedAt: null,
    createdAt: '2025-06-02T09:00:00Z',
    createdBy: 'admin-uid-1',
    updatedAt: '2025-06-02T09:00:00Z',
    updatedBy: 'admin-uid-1',
  },
];

describe('CmsManager', () => {
  beforeEach(() => {
    mockCallFunction.mockReset();
  });

  it('renders loading skeleton initially', () => {
    mockCallFunction.mockReturnValue(new Promise(() => {}));
    render(<CmsManager />);
    expect(document.querySelectorAll('.animate-pulse').length).toBeGreaterThan(0);
  });

  it('renders article list after loading', async () => {
    mockCallFunction.mockResolvedValue({ articles: mockArticles });

    render(<CmsManager />);

    await waitFor(() => {
      expect(screen.getByText('Content Management')).toBeInTheDocument();
    });

    expect(screen.getByText('Getting Started')).toBeInTheDocument();
    expect(screen.getByText('Draft Article')).toBeInTheDocument();
    expect(screen.getByText('New Article')).toBeInTheDocument();
  });

  it('displays article status badges', async () => {
    mockCallFunction.mockResolvedValue({ articles: mockArticles });

    render(<CmsManager />);

    await waitFor(() => {
      expect(screen.getByText('published')).toBeInTheDocument();
    });

    expect(screen.getByText('draft')).toBeInTheDocument();
  });

  it('opens new article editor', async () => {
    mockCallFunction.mockResolvedValue({ articles: mockArticles });

    render(<CmsManager />);

    await waitFor(() => {
      expect(screen.getByText('New Article')).toBeInTheDocument();
    });

    fireEvent.click(screen.getByText('New Article'));

    await waitFor(() => {
      expect(screen.getByText('New Article', { selector: 'h1' })).toBeInTheDocument();
    });

    expect(screen.getByLabelText('Title')).toBeInTheDocument();
    expect(screen.getByLabelText('Slug')).toBeInTheDocument();
    expect(screen.getByLabelText('Body')).toBeInTheDocument();
    expect(screen.getByLabelText('Category')).toBeInTheDocument();
    expect(screen.getByLabelText('Status')).toBeInTheDocument();
    expect(screen.getByText('Save Article')).toBeInTheDocument();
    expect(screen.getByText('Cancel')).toBeInTheDocument();
  });

  it('opens edit editor for existing article', async () => {
    mockCallFunction.mockResolvedValue({ articles: mockArticles });

    render(<CmsManager />);

    await waitFor(() => {
      expect(screen.getByText('Getting Started')).toBeInTheDocument();
    });

    // Click Edit on the first article
    const editButtons = screen.getAllByText('Edit');
    fireEvent.click(editButtons[0]);

    await waitFor(() => {
      expect(screen.getByText('Edit Article')).toBeInTheDocument();
    });

    const titleInput = screen.getByLabelText('Title') as HTMLInputElement;
    expect(titleInput.value).toBe('Getting Started');
  });

  it('cancels editing and returns to list', async () => {
    mockCallFunction.mockResolvedValue({ articles: mockArticles });

    render(<CmsManager />);

    await waitFor(() => {
      expect(screen.getByText('New Article')).toBeInTheDocument();
    });

    fireEvent.click(screen.getByText('New Article'));

    await waitFor(() => {
      expect(screen.getByText('Cancel')).toBeInTheDocument();
    });

    fireEvent.click(screen.getByText('Cancel'));

    await waitFor(() => {
      expect(screen.getByText('Content Management')).toBeInTheDocument();
    });
  });

  it('saves new article via createArticle', async () => {
    const savedArticle = {
      id: 'article-3',
      title: 'New Tutorial',
      slug: 'new-tutorial',
      body: 'Tutorial content',
      category: 'tutorial',
      status: 'draft',
      coverImageUrl: null,
      tags: [],
      publishedAt: null,
      createdAt: '2025-06-03T00:00:00Z',
      createdBy: 'admin-uid-1',
      updatedAt: '2025-06-03T00:00:00Z',
      updatedBy: 'admin-uid-1',
    };

    mockCallFunction
      .mockResolvedValueOnce({ articles: [] }) // initial load
      .mockResolvedValueOnce(savedArticle); // createArticle

    render(<CmsManager />);

    await waitFor(() => {
      expect(screen.getByText('New Article')).toBeInTheDocument();
    });

    fireEvent.click(screen.getByText('New Article'));

    await waitFor(() => {
      expect(screen.getByLabelText('Title')).toBeInTheDocument();
    });

    fireEvent.change(screen.getByLabelText('Title'), { target: { value: 'New Tutorial' } });
    fireEvent.change(screen.getByLabelText('Slug'), { target: { value: 'new-tutorial' } });
    fireEvent.change(screen.getByLabelText('Body'), { target: { value: 'Tutorial content' } });

    fireEvent.click(screen.getByText('Save Article'));

    await waitFor(() => {
      expect(screen.getByText('Content Management')).toBeInTheDocument();
    });

    expect(mockCallFunction).toHaveBeenCalledWith('createArticle', expect.objectContaining({
      title: 'New Tutorial',
      slug: 'new-tutorial',
      body: 'Tutorial content',
    }));
  });

  it('deletes article', async () => {
    mockCallFunction
      .mockResolvedValueOnce({ articles: mockArticles }) // initial load
      .mockResolvedValueOnce({ success: true }); // deleteArticle

    render(<CmsManager />);

    await waitFor(() => {
      expect(screen.getByText('Getting Started')).toBeInTheDocument();
    });

    const deleteButtons = screen.getAllByText('Delete');
    fireEvent.click(deleteButtons[0]);

    await waitFor(() => {
      expect(screen.queryByText('Getting Started')).not.toBeInTheDocument();
    });

    expect(mockCallFunction).toHaveBeenCalledWith('deleteArticle', { articleId: 'article-1' });
  });

  it('shows empty state when no articles', async () => {
    mockCallFunction.mockResolvedValue({ articles: [] });

    render(<CmsManager />);

    await waitFor(() => {
      expect(screen.getByText('No articles yet. Create your first article.')).toBeInTheDocument();
    });
  });

  it('renders error state on load failure', async () => {
    mockCallFunction.mockRejectedValue({ message: 'Permission denied' });

    render(<CmsManager />);

    await waitFor(() => {
      expect(screen.getByRole('alert')).toHaveTextContent('Permission denied');
    });
  });
});
