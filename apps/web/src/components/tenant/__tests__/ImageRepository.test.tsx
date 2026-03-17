// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ImageRepository } from '../ImageRepository';
import { makeGeneratedImage } from '@/test/fixtures';

vi.mock('@/lib/firebase/functions', () => ({
  callFunction: vi.fn(),
}));

import { callFunction } from '@/lib/firebase/functions';

const mockCallFunction = callFunction as ReturnType<typeof vi.fn>;

function makeImages() {
  return [
    { ...makeGeneratedImage({ status: 'waiting_approval' }), id: 'img-1' },
    { ...makeGeneratedImage({ status: 'approved' }), id: 'img-2' },
    { ...makeGeneratedImage({ status: 'rejected' }), id: 'img-3' },
    { ...makeGeneratedImage({ status: 'waiting_approval' }), id: 'img-4' },
  ];
}

describe('ImageRepository', () => {
  beforeEach(() => {
    mockCallFunction.mockReset();
  });

  it('renders images with status badges', async () => {
    mockCallFunction.mockResolvedValue({ images: makeImages() });

    render(<ImageRepository />);

    await waitFor(() => {
      expect(screen.getByText('Image Repository')).toBeInTheDocument();
    });

    // Check filter tab counts
    expect(screen.getByRole('tab', { name: /all \(4\)/i })).toBeInTheDocument();
    expect(screen.getByRole('tab', { name: /waiting \(2\)/i })).toBeInTheDocument();
    expect(screen.getByRole('tab', { name: /approved \(1\)/i })).toBeInTheDocument();
    expect(screen.getByRole('tab', { name: /rejected \(1\)/i })).toBeInTheDocument();
  });

  it('renders empty state', async () => {
    mockCallFunction.mockResolvedValue({ images: [] });

    render(<ImageRepository />);

    await waitFor(() => {
      expect(screen.getByText('No generated images yet.')).toBeInTheDocument();
    });
  });

  it('selects images and shows bulk action bar', async () => {
    const user = userEvent.setup();
    mockCallFunction.mockResolvedValue({ images: makeImages() });

    render(<ImageRepository />);

    await waitFor(() => {
      expect(screen.getByText('Image Repository')).toBeInTheDocument();
    });

    // Select first image
    const checkboxes = screen.getAllByRole('checkbox');
    // First checkbox is "select all", image checkboxes follow
    await user.click(checkboxes[1]); // img-1

    expect(screen.getByText('1 selected')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /approve/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /reject/i })).toBeInTheDocument();
  });

  it('calls updateImageStatus on bulk approve', async () => {
    const user = userEvent.setup();
    mockCallFunction
      .mockResolvedValueOnce({ images: makeImages() })
      .mockResolvedValueOnce({ success: true, updated: 1 });

    render(<ImageRepository />);

    await waitFor(() => {
      expect(screen.getByText('Image Repository')).toBeInTheDocument();
    });

    const checkboxes = screen.getAllByRole('checkbox');
    await user.click(checkboxes[1]); // select img-1
    await user.click(screen.getByRole('button', { name: /approve/i }));

    expect(mockCallFunction).toHaveBeenCalledWith('updateImageStatus', {
      imageIds: ['img-1'],
      status: 'approved',
    });
  });

  it('shows enabled Download button that calls bulkDownloadImages', async () => {
    const user = userEvent.setup();
    mockCallFunction
      .mockResolvedValueOnce({ images: makeImages() })
      .mockResolvedValueOnce({ downloadUrl: 'https://example.com/download.zip', imageCount: 1 });

    render(<ImageRepository />);

    await waitFor(() => {
      expect(screen.getByText('Image Repository')).toBeInTheDocument();
    });

    const checkboxes = screen.getAllByRole('checkbox');
    await user.click(checkboxes[1]);

    const downloadBtn = screen.getByRole('button', { name: /download/i });
    expect(downloadBtn).not.toBeDisabled();

    await user.click(downloadBtn);

    expect(mockCallFunction).toHaveBeenCalledWith('bulkDownloadImages', {
      imageIds: ['img-1'],
    });
  });

  it('shows Regenerate button for approved/rejected images only', async () => {
    mockCallFunction.mockResolvedValue({ images: makeImages() });

    render(<ImageRepository />);

    await waitFor(() => {
      expect(screen.getByText('Image Repository')).toBeInTheDocument();
    });

    // Should find Regenerate buttons for approved (img-2) and rejected (img-3)
    const regenButtons = screen.getAllByRole('button', { name: /regenerate/i });
    expect(regenButtons).toHaveLength(2);
  });

  it('calls regenerateImage on Regenerate button click', async () => {
    const user = userEvent.setup();
    mockCallFunction
      .mockResolvedValueOnce({ images: makeImages() })
      .mockResolvedValueOnce({
        newImageId: 'new-img-1',
        jobId: 'regen-job-1',
        creditsCost: 5,
        status: 'completed',
      });

    render(<ImageRepository />);

    await waitFor(() => {
      expect(screen.getByText('Image Repository')).toBeInTheDocument();
    });

    const regenButtons = screen.getAllByRole('button', { name: /regenerate/i });
    await user.click(regenButtons[0]);

    expect(mockCallFunction).toHaveBeenCalledWith('regenerateImage', {
      imageId: expect.any(String),
    });
  });

  it('shows error when regeneration fails', async () => {
    const user = userEvent.setup();
    mockCallFunction
      .mockResolvedValueOnce({ images: makeImages() })
      .mockRejectedValueOnce({ message: 'Insufficient credits' });

    render(<ImageRepository />);

    await waitFor(() => {
      expect(screen.getByText('Image Repository')).toBeInTheDocument();
    });

    const regenButtons = screen.getAllByRole('button', { name: /regenerate/i });
    await user.click(regenButtons[0]);

    await waitFor(() => {
      expect(screen.getByRole('alert')).toHaveTextContent('Insufficient credits');
    });
  });

  it('select all toggles all visible images', async () => {
    const user = userEvent.setup();
    mockCallFunction.mockResolvedValue({ images: makeImages() });

    render(<ImageRepository />);

    await waitFor(() => {
      expect(screen.getByText('Image Repository')).toBeInTheDocument();
    });

    // Click "Select all"
    const selectAll = screen.getByLabelText(/select all/i);
    await user.click(selectAll);

    expect(screen.getByText('4 selected')).toBeInTheDocument();
  });
});
