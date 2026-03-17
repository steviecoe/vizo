'use client';

import { useReducer, useEffect, useState } from 'react';
import { loadStripe } from '@stripe/stripe-js';
import { Elements, PaymentElement, useStripe, useElements } from '@stripe/react-stripe-js';
import { callFunction } from '@/lib/firebase/functions';

// ─── Stripe setup ──────────────────────────────────────────

const stripePromise = loadStripe(process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY || '');

// ─── Types ────────────────────────────────────────────────

type PageStatus = 'loading' | 'idle' | 'creating_intent' | 'payment_active' | 'success' | 'error';

interface BillingInfo {
  creditBalance: number;
  pricePerCredit: number;
  lowCreditThreshold: number;
  recentPayments: Array<{
    id: string;
    creditsGranted: number;
    amount: number;
    status: string;
    createdAt: string;
  }>;
}

interface PaymentState {
  status: PageStatus;
  billingInfo: BillingInfo | null;
  creditAmount: number;
  clientSecret: string | null;
  paymentIntentId: string | null;
  serverError: string | null;
}

type PaymentAction =
  | { type: 'SET_LOADED'; billingInfo: BillingInfo }
  | { type: 'SET_ERROR'; error: string }
  | { type: 'SET_CREDIT_AMOUNT'; amount: number }
  | { type: 'SET_CREATING_INTENT' }
  | { type: 'SET_PAYMENT_ACTIVE'; clientSecret: string; paymentIntentId: string }
  | { type: 'SET_SUCCESS' }
  | { type: 'RESET' };

const initialState: PaymentState = {
  status: 'loading',
  billingInfo: null,
  creditAmount: 100,
  clientSecret: null,
  paymentIntentId: null,
  serverError: null,
};

function reducer(state: PaymentState, action: PaymentAction): PaymentState {
  switch (action.type) {
    case 'SET_LOADED':
      return { ...state, status: 'idle', billingInfo: action.billingInfo, serverError: null };
    case 'SET_ERROR':
      return { ...state, status: 'error', serverError: action.error };
    case 'SET_CREDIT_AMOUNT':
      return { ...state, creditAmount: action.amount };
    case 'SET_CREATING_INTENT':
      return { ...state, status: 'creating_intent', serverError: null };
    case 'SET_PAYMENT_ACTIVE':
      return { ...state, status: 'payment_active', clientSecret: action.clientSecret, paymentIntentId: action.paymentIntentId };
    case 'SET_SUCCESS':
      return { ...state, status: 'success', clientSecret: null, paymentIntentId: null };
    case 'RESET':
      return { ...state, status: 'idle', clientSecret: null, paymentIntentId: null, serverError: null };
    default:
      return state;
  }
}

// ─── Helpers ──────────────────────────────────────────────

function formatCurrency(cents: number): string {
  return `$${(cents / 100).toFixed(2)}`;
}

function formatPaymentStatus(status: string): { label: string; color: string } {
  switch (status) {
    case 'succeeded':
      return { label: 'Succeeded', color: 'text-stone-950 bg-green-50' };
    case 'pending':
      return { label: 'Pending', color: 'text-stone-950 bg-yellow-50' };
    case 'failed':
      return { label: 'Failed', color: 'text-stone-950 bg-red-50' };
    default:
      return { label: status, color: 'text-stone-700 bg-stone-50' };
  }
}

// ─── Preset amounts ──────────────────────────────────────

const PRESET_AMOUNTS = [50, 100, 250, 500, 1000];

// ─── Stripe Checkout Form ─────────────────────────────────

function CheckoutForm({
  creditAmount,
  onSuccess,
  onCancel,
  onError,
}: {
  creditAmount: number;
  onSuccess: () => void;
  onCancel: () => void;
  onError: (error: string) => void;
}) {
  const stripe = useStripe();
  const elements = useElements();
  const [isProcessing, setIsProcessing] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!stripe || !elements) return;

    setIsProcessing(true);

    const { error } = await stripe.confirmPayment({
      elements,
      confirmParams: {
        return_url: window.location.href,
      },
      redirect: 'if_required',
    });

    if (error) {
      onError(error.message || 'Payment failed');
      setIsProcessing(false);
    } else {
      onSuccess();
    }
  }

  return (
    <div className="rounded-lg border border-brand-200 bg-brand-50 p-6">
      <h2 className="text-lg font-semibold font-display text-brand-900">Complete Payment</h2>
      <p className="mt-1 text-sm text-brand-700">
        Enter your payment details below to purchase {creditAmount} credits.
      </p>
      <form onSubmit={handleSubmit} className="mt-4">
        <div className="rounded-md border border-stone-200 bg-white p-4">
          <PaymentElement />
        </div>
        <div className="mt-4 flex gap-3">
          <button
            type="button"
            onClick={onCancel}
            disabled={isProcessing}
            className="rounded-md border border-stone-300 px-4 py-2 text-sm font-medium text-stone-700 hover:bg-stone-50 disabled:opacity-50"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={isProcessing || !stripe || !elements}
            className="rounded-md bg-green-600 px-6 py-2 text-sm font-medium text-white hover:bg-green-700 disabled:opacity-50"
          >
            {isProcessing ? 'Processing...' : 'Pay Now'}
          </button>
        </div>
      </form>
    </div>
  );
}

// ─── Component ────────────────────────────────────────────

export function CreditPurchase() {
  const [state, dispatch] = useReducer(reducer, initialState);
  const { status, billingInfo, creditAmount, serverError } = state;

  useEffect(() => {
    async function load() {
      try {
        const info = await callFunction<BillingInfo>('getBillingInfo');
        dispatch({ type: 'SET_LOADED', billingInfo: info });
      } catch (err: unknown) {
        const error = err as { message?: string };
        dispatch({ type: 'SET_ERROR', error: error.message || 'Failed to load billing info' });
      }
    }
    load();
  }, []);

  async function handlePurchase() {
    if (creditAmount < 10) return;
    dispatch({ type: 'SET_CREATING_INTENT' });

    try {
      const result = await callFunction<{
        clientSecret: string;
        paymentIntentId: string;
        amountCents: number;
      }>('purchaseCredits', { creditAmount });
      dispatch({
        type: 'SET_PAYMENT_ACTIVE',
        clientSecret: result.clientSecret,
        paymentIntentId: result.paymentIntentId,
      });
    } catch (err: unknown) {
      const error = err as { message?: string };
      dispatch({ type: 'SET_ERROR', error: error.message || 'Failed to create payment' });
    }
  }

  if (status === 'loading') {
    return (
      <div className="space-y-6">
        <div className="h-8 w-64 animate-pulse rounded bg-stone-200" />
        <div className="h-48 animate-pulse rounded-lg bg-stone-200" />
        <div className="h-64 animate-pulse rounded-lg bg-stone-200" />
      </div>
    );
  }

  if (status === 'error' && !billingInfo) {
    return (
      <div className="rounded-md border border-red-200 bg-red-50 p-6" role="alert">
        <h2 className="font-semibold font-display text-red-800">Failed to load billing</h2>
        <p className="mt-1 text-sm text-red-700">{serverError}</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold font-display text-stone-900">Credits & Billing</h1>
        <p className="mt-1 text-sm text-stone-500">
          Purchase credits to generate AI fashion photography.
        </p>
      </div>

      {!process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY && (
        <div className="rounded-md border border-amber-200 bg-amber-50 px-4 py-3">
          <p className="text-xs text-amber-800">
            Stripe integration is not configured. Credit purchases require <code className="rounded bg-amber-100 px-1">NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY</code>, <code className="rounded bg-amber-100 px-1">STRIPE_SECRET_KEY</code>, and <code className="rounded bg-amber-100 px-1">STRIPE_WEBHOOK_SECRET</code> to be set. Credits can still be added via Admin Top-up.
          </p>
        </div>
      )}

      {/* Current Balance */}
      {billingInfo && (
        <div className="rounded-lg border border-stone-200 bg-stone-50 p-6">
          <div className="flex items-center justify-between">
            <div>
              <dt className="text-sm font-medium text-stone-500">Current Balance</dt>
              <dd className={`mt-1 text-3xl font-bold ${
                billingInfo.creditBalance <= billingInfo.lowCreditThreshold
                  ? 'text-red-600'
                  : 'text-brand-700'
              }`}>
                {billingInfo.creditBalance.toLocaleString()} credits
              </dd>
            </div>
            <div className="text-right">
              <dt className="text-sm font-medium text-stone-500">Price per Credit</dt>
              <dd className="mt-1 text-lg font-semibold text-stone-900">
                ${billingInfo.pricePerCredit.toFixed(2)}
              </dd>
            </div>
          </div>
          {billingInfo.creditBalance <= billingInfo.lowCreditThreshold && (
            <div className="mt-3 rounded-md bg-amber-50 p-3 text-sm text-amber-800" role="status">
              Your credit balance is low. Top up to continue generating images.
            </div>
          )}
        </div>
      )}

      {/* Purchase Form */}
      {status !== 'success' && status !== 'payment_active' && (
        <div className="rounded-lg border border-stone-200 bg-stone-50 p-6">
          <h2 className="text-lg font-semibold font-display text-stone-900">Purchase Credits</h2>

          {/* Preset amounts */}
          <div className="mt-4">
            <label className="block text-sm font-medium text-stone-700">Quick Select</label>
            <div className="mt-2 flex flex-wrap gap-2">
              {PRESET_AMOUNTS.map((amount) => (
                <button
                  key={amount}
                  onClick={() => dispatch({ type: 'SET_CREDIT_AMOUNT', amount })}
                  className={`rounded-full border px-4 py-2 text-sm font-medium transition-colors ${
                    creditAmount === amount
                      ? 'border-brand-500 bg-brand-50 text-brand-700'
                      : 'border-stone-300 text-stone-600 hover:border-stone-400'
                  }`}
                >
                  {amount} credits
                </button>
              ))}
            </div>
          </div>

          {/* Custom amount */}
          <div className="mt-4">
            <label htmlFor="credit-amount" className="block text-sm font-medium text-stone-700">
              Custom Amount
            </label>
            <input
              id="credit-amount"
              type="number"
              min={10}
              max={100000}
              value={creditAmount}
              onChange={(e) => dispatch({
                type: 'SET_CREDIT_AMOUNT',
                amount: Math.max(0, parseInt(e.target.value, 10) || 0),
              })}
              className="mt-1 block w-40 rounded-md border border-stone-300 px-3 py-2 text-sm"
            />
          </div>

          {/* Cost preview */}
          {billingInfo && creditAmount >= 10 && (
            <div className="mt-4 rounded-md bg-stone-50 p-4">
              <div className="flex justify-between text-sm">
                <span className="text-stone-600">{creditAmount} credits × ${billingInfo.pricePerCredit.toFixed(2)}</span>
                <span className="font-semibold text-stone-900" data-testid="total-cost">
                  ${(creditAmount * billingInfo.pricePerCredit).toFixed(2)}
                </span>
              </div>
            </div>
          )}

          {serverError && (
            <div className="mt-4 rounded-md border border-red-200 bg-red-50 p-3 text-sm text-red-700" role="alert">
              {serverError}
            </div>
          )}

          <button
            onClick={handlePurchase}
            disabled={creditAmount < 10 || status === 'creating_intent'}
            className="mt-6 rounded-full bg-brand-600 px-6 py-2.5 text-sm font-medium text-white hover:bg-brand-700 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {status === 'creating_intent' ? 'Preparing payment...' : `Purchase ${creditAmount} Credits`}
          </button>
        </div>
      )}

      {/* Stripe Payment Element */}
      {status === 'payment_active' && state.clientSecret && (
        <Elements
          stripe={stripePromise}
          options={{
            clientSecret: state.clientSecret,
            appearance: {
              theme: 'stripe',
              variables: {
                colorPrimary: '#4f46e5',
                borderRadius: '8px',
              },
            },
          }}
        >
          <CheckoutForm
            creditAmount={creditAmount}
            onSuccess={() => dispatch({ type: 'SET_SUCCESS' })}
            onCancel={() => dispatch({ type: 'RESET' })}
            onError={(error) => dispatch({ type: 'SET_ERROR', error })}
          />
        </Elements>
      )}

      {/* Success state */}
      {status === 'success' && (
        <div className="rounded-lg border border-green-200 bg-green-50 p-6" role="status">
          <h2 className="text-lg font-semibold font-display text-green-900">Payment Successful</h2>
          <p className="mt-2 text-sm text-green-700">
            {creditAmount} credits have been added to your account. They will appear in your balance shortly.
          </p>
          <button
            onClick={() => {
              dispatch({ type: 'RESET' });
              // Reload billing info
              callFunction<BillingInfo>('getBillingInfo').then((info) => {
                dispatch({ type: 'SET_LOADED', billingInfo: info });
              });
            }}
            className="mt-4 rounded-full bg-brand-600 px-6 py-2 text-sm font-medium text-white hover:bg-brand-700"
          >
            Done
          </button>
        </div>
      )}

      {/* Payment History */}
      {billingInfo && billingInfo.recentPayments.length > 0 && (
        <div>
          <h2 className="text-lg font-semibold font-display text-stone-900">Payment History</h2>
          <div className="mt-3 overflow-hidden rounded-lg border border-stone-200">
            <table className="min-w-full divide-y divide-stone-200">
              <thead className="bg-stone-50">
                <tr>
                  <th scope="col" className="px-4 py-3 text-left text-xs font-medium uppercase text-stone-500">Date</th>
                  <th scope="col" className="px-4 py-3 text-left text-xs font-medium uppercase text-stone-500">Credits</th>
                  <th scope="col" className="px-4 py-3 text-left text-xs font-medium uppercase text-stone-500">Amount</th>
                  <th scope="col" className="px-4 py-3 text-left text-xs font-medium uppercase text-stone-500">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-stone-200 bg-stone-50">
                {billingInfo.recentPayments.map((payment) => {
                  const statusInfo = formatPaymentStatus(payment.status);
                  return (
                    <tr key={payment.id} className="hover:bg-stone-50">
                      <td className="whitespace-nowrap px-4 py-3 text-sm text-stone-600">
                        {new Date(payment.createdAt).toLocaleDateString()}
                      </td>
                      <td className="px-4 py-3 text-sm font-medium text-stone-900">
                        {payment.creditsGranted.toLocaleString()}
                      </td>
                      <td className="px-4 py-3 text-sm text-stone-600">
                        {formatCurrency(payment.amount)}
                      </td>
                      <td className="px-4 py-3">
                        <span className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium ${statusInfo.color}`}>
                          {statusInfo.label}
                        </span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
