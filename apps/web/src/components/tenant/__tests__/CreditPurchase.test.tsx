// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { CreditPurchase } from '../CreditPurchase';

vi.mock('@/lib/firebase/functions', () => ({
  callFunction: vi.fn(),
}));

const mockConfirmPayment = vi.fn();

vi.mock('@stripe/react-stripe-js', () => ({
  Elements: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  PaymentElement: () => <div data-testid="stripe-payment-element">PaymentElement</div>,
  useStripe: () => ({ confirmPayment: mockConfirmPayment }),
  useElements: () => ({}),
}));

vi.mock('@stripe/stripe-js', () => ({
  loadStripe: () => Promise.resolve({}),
}));

import { callFunction } from '@/lib/firebase/functions';
const mockCallFunction = callFunction as ReturnType<typeof vi.fn>;

const mockBillingInfo = {
  creditBalance: 1000,
  pricePerCredit: 0.5,
  lowCreditThreshold: 50,
  recentPayments: [
    {
      id: 'pay-1',
      creditsGranted: 200,
      amount: 10000,
      status: 'succeeded',
      createdAt: '2025-01-20T00:00:00Z',
    },
    {
      id: 'pay-2',
      creditsGranted: 100,
      amount: 5000,
      status: 'pending',
      createdAt: '2025-01-19T00:00:00Z',
    },
  ],
};

describe('CreditPurchase', () => {
  beforeEach(() => {
    mockCallFunction.mockReset();
    mockConfirmPayment.mockReset();
  });

  it('shows loading then loaded state', async () => {
    mockCallFunction.mockResolvedValueOnce(mockBillingInfo);
    render(<CreditPurchase />);

    await waitFor(() => {
      expect(screen.getByText('Credits & Billing')).toBeInTheDocument();
    });
  });

  it('renders current balance and price per credit', async () => {
    mockCallFunction.mockResolvedValueOnce(mockBillingInfo);
    render(<CreditPurchase />);

    await waitFor(() => {
      expect(screen.getByText('1,000 credits')).toBeInTheDocument();
      expect(screen.getByText('$0.50')).toBeInTheDocument();
    });
  });

  it('shows preset credit amounts', async () => {
    mockCallFunction.mockResolvedValueOnce(mockBillingInfo);
    render(<CreditPurchase />);

    await waitFor(() => {
      expect(screen.getByText('50 credits')).toBeInTheDocument();
      expect(screen.getByText('100 credits')).toBeInTheDocument();
      expect(screen.getByText('250 credits')).toBeInTheDocument();
      expect(screen.getByText('500 credits')).toBeInTheDocument();
      expect(screen.getByText('1000 credits')).toBeInTheDocument();
    });
  });

  it('updates cost preview when selecting preset', async () => {
    mockCallFunction.mockResolvedValueOnce(mockBillingInfo);
    const user = userEvent.setup();
    render(<CreditPurchase />);

    await waitFor(() => {
      expect(screen.getByText('250 credits')).toBeInTheDocument();
    });

    await user.click(screen.getByText('250 credits'));

    expect(screen.getByTestId('total-cost')).toHaveTextContent('$125.00');
  });

  it('creates payment intent and shows payment element', async () => {
    mockCallFunction
      .mockResolvedValueOnce(mockBillingInfo) // getBillingInfo
      .mockResolvedValueOnce({
        clientSecret: 'pi_secret_test',
        paymentIntentId: 'pi_test_123',
        amountCents: 5000,
      }); // purchaseCredits

    const user = userEvent.setup();
    render(<CreditPurchase />);

    await waitFor(() => {
      expect(screen.getByText('Purchase Credits')).toBeInTheDocument();
    });

    await user.click(screen.getByRole('button', { name: /purchase 100 credits/i }));

    await waitFor(() => {
      expect(screen.getByTestId('stripe-payment-element')).toBeInTheDocument();
      expect(screen.getByText('Complete Payment')).toBeInTheDocument();
    });
  });

  it('shows success state after payment confirmation', async () => {
    mockCallFunction
      .mockResolvedValueOnce(mockBillingInfo)
      .mockResolvedValueOnce({ clientSecret: 'pi_secret', paymentIntentId: 'pi_1' });
    mockConfirmPayment.mockResolvedValueOnce({ error: null });

    const user = userEvent.setup();
    render(<CreditPurchase />);

    await waitFor(() => {
      expect(screen.getByText('Purchase Credits')).toBeInTheDocument();
    });

    await user.click(screen.getByRole('button', { name: /purchase 100 credits/i }));

    await waitFor(() => {
      expect(screen.getByText('Complete Payment')).toBeInTheDocument();
    });

    await user.click(screen.getByRole('button', { name: /pay now/i }));

    await waitFor(() => {
      expect(screen.getByRole('status')).toHaveTextContent('Payment Successful');
    });
  });

  it('shows payment history table', async () => {
    mockCallFunction.mockResolvedValueOnce(mockBillingInfo);
    render(<CreditPurchase />);

    await waitFor(() => {
      expect(screen.getByText('Payment History')).toBeInTheDocument();
      expect(screen.getByText('Succeeded')).toBeInTheDocument();
      expect(screen.getByText('Pending')).toBeInTheDocument();
    });
  });

  it('shows low balance warning when below threshold', async () => {
    mockCallFunction.mockResolvedValueOnce({
      ...mockBillingInfo,
      creditBalance: 30,
    });
    render(<CreditPurchase />);

    await waitFor(() => {
      expect(screen.getByRole('status')).toHaveTextContent('credit balance is low');
    });
  });

  it('shows error state', async () => {
    mockCallFunction.mockRejectedValueOnce({ message: 'Unauthorized' });
    render(<CreditPurchase />);

    await waitFor(() => {
      expect(screen.getByRole('alert')).toHaveTextContent('Unauthorized');
    });
  });

  it('allows cancelling payment', async () => {
    mockCallFunction
      .mockResolvedValueOnce(mockBillingInfo)
      .mockResolvedValueOnce({ clientSecret: 'pi_secret', paymentIntentId: 'pi_1' });

    const user = userEvent.setup();
    render(<CreditPurchase />);

    await waitFor(() => {
      expect(screen.getByText('Purchase Credits')).toBeInTheDocument();
    });

    await user.click(screen.getByRole('button', { name: /purchase 100 credits/i }));

    await waitFor(() => {
      expect(screen.getByText('Complete Payment')).toBeInTheDocument();
    });

    await user.click(screen.getByRole('button', { name: /cancel/i }));

    expect(screen.getByText('Purchase Credits')).toBeInTheDocument();
  });
});
