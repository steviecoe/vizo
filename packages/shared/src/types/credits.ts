export type LedgerEntryType =
  | 'topup_stripe'
  | 'topup_admin'
  | 'topup_shopify'
  | 'debit_generation'
  | 'debit_photoshoot'
  | 'debit_video'
  | 'refund_generation_failure';

export interface CreditLedgerEntry {
  id: string;
  type: LedgerEntryType;
  amount: number;
  balanceAfter: number;
  description: string;
  referenceId: string | null;
  createdAt: string;
  createdBy: string;
}

export interface StripePayment {
  id: string;
  stripePaymentIntentId: string;
  amount: number;
  creditsGranted: number;
  status: 'pending' | 'succeeded' | 'failed';
  createdAt: string;
  createdBy: string;
}

export interface CreditCosts {
  quickGen1k: number;
  quickGen2k: number;
  shopifyGen1k: number;
  shopifyGen2k: number;
  photoshoot1k: number;
  photoshoot2k: number;
  modelGeneration: number;
  backgroundGeneration: number;
  videoGeneration: number;
}
