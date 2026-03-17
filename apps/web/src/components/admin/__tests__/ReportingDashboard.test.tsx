// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import { ReportingDashboard } from '../ReportingDashboard';

vi.mock('@/lib/firebase/functions', () => ({
  callFunction: vi.fn(),
}));

import { callFunction } from '@/lib/firebase/functions';
const mockCallFunction = callFunction as ReturnType<typeof vi.fn>;

const mockReportingData = {
  totalTenants: 5,
  totalCreditsInSystem: 2500,
  totalCreditsSpent: 800,
  totalImagesGenerated: 150,
  totalImagesApproved: 120,
  totalImagesRejected: 10,
  totalJobs: 45,
  images1k: 100,
  images2k: 50,
  estimatedAiCost: 8.0,
  creditsRevenue: 400.0,
  profitMargin: 98,
  recentLedgerEntries: [
    {
      tenantId: 't-1',
      tenantName: 'Fashion Co',
      type: 'debit_generation',
      amount: -10,
      description: 'Quick gen',
      createdAt: '2025-01-20T00:00:00Z',
    },
    {
      tenantId: 't-2',
      tenantName: 'Style Inc',
      type: 'topup_admin',
      amount: 500,
      description: 'Admin top-up',
      createdAt: '2025-01-19T00:00:00Z',
    },
  ],
  topTenants: [
    { id: 't-1', name: 'Fashion Co', creditBalance: 1500, totalGenerated: 100, totalApproved: 80 },
    { id: 't-2', name: 'Style Inc', creditBalance: 1000, totalGenerated: 50, totalApproved: 40 },
  ],
};

describe('ReportingDashboard', () => {
  beforeEach(() => mockCallFunction.mockReset());

  it('shows loading state then loaded state', async () => {
    mockCallFunction.mockResolvedValueOnce(mockReportingData);
    render(<ReportingDashboard />);

    // Initially shows loading state before data arrives
    await waitFor(() => {
      expect(screen.getByText('Reporting Dashboard')).toBeInTheDocument();
    });
  });

  it('renders primary stat cards', async () => {
    mockCallFunction.mockResolvedValueOnce(mockReportingData);
    render(<ReportingDashboard />);

    await waitFor(() => {
      expect(screen.getByText('Total Tenants')).toBeInTheDocument();
      expect(screen.getByText('5')).toBeInTheDocument();
      expect(screen.getByText('Credits in System')).toBeInTheDocument();
      expect(screen.getByText('2500')).toBeInTheDocument();
      expect(screen.getByText('Credits Spent')).toBeInTheDocument();
      expect(screen.getByText('800')).toBeInTheDocument();
    });
  });

  it('renders image stat cards with approval rate', async () => {
    mockCallFunction.mockResolvedValueOnce(mockReportingData);
    render(<ReportingDashboard />);

    await waitFor(() => {
      expect(screen.getByText('Images Generated')).toBeInTheDocument();
      expect(screen.getByText('150')).toBeInTheDocument();
      expect(screen.getByText('Images Approved')).toBeInTheDocument();
      expect(screen.getByText('120')).toBeInTheDocument();
      expect(screen.getByText('Approval Rate')).toBeInTheDocument();
      expect(screen.getByText('80%')).toBeInTheDocument(); // 120/150
    });
  });

  it('renders top tenants table', async () => {
    mockCallFunction.mockResolvedValueOnce(mockReportingData);
    render(<ReportingDashboard />);

    await waitFor(() => {
      expect(screen.getByText('Top Tenants by Generation Volume')).toBeInTheDocument();
      // Fashion Co appears in both top tenants and recent ledger
      const allFashionCo = screen.getAllByText('Fashion Co');
      expect(allFashionCo.length).toBeGreaterThanOrEqual(1);
    });
  });

  it('renders recent credit activity', async () => {
    mockCallFunction.mockResolvedValueOnce(mockReportingData);
    render(<ReportingDashboard />);

    await waitFor(() => {
      expect(screen.getByText('Recent Credit Activity')).toBeInTheDocument();
      expect(screen.getByText('Quick gen')).toBeInTheDocument();
      expect(screen.getByText('Admin top-up')).toBeInTheDocument();
    });
  });

  it('renders AI cost vs revenue section', async () => {
    mockCallFunction.mockResolvedValueOnce(mockReportingData);
    render(<ReportingDashboard />);

    await waitFor(() => {
      expect(screen.getByText('AI Cost vs Revenue')).toBeInTheDocument();
      expect(screen.getByText('Estimated AI Cost')).toBeInTheDocument();
      expect(screen.getByText('$8.00')).toBeInTheDocument();
      expect(screen.getByText('Credits Revenue')).toBeInTheDocument();
      expect(screen.getByText('$400.00')).toBeInTheDocument();
      expect(screen.getByText('Profit Margin')).toBeInTheDocument();
      expect(screen.getByText('98%')).toBeInTheDocument();
    });
  });

  it('renders image breakdown by resolution', async () => {
    mockCallFunction.mockResolvedValueOnce(mockReportingData);
    render(<ReportingDashboard />);

    await waitFor(() => {
      expect(screen.getByText('Image Breakdown')).toBeInTheDocument();
      // Check the combined text: "100 at 1k, 50 at 2k"
      expect(screen.getByText(/at 1k/)).toBeInTheDocument();
      expect(screen.getByText(/at 2k/)).toBeInTheDocument();
    });
  });

  it('shows error state', async () => {
    mockCallFunction.mockRejectedValueOnce({ message: 'Unauthorized' });
    render(<ReportingDashboard />);

    await waitFor(() => {
      expect(screen.getByRole('alert')).toHaveTextContent('Unauthorized');
    });
  });
});
