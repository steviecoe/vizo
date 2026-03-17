import Stripe from 'stripe';
import { getSecret } from './secret-manager';

let stripeClient: Stripe | null = null;

/**
 * Returns a lazily-initialized Stripe SDK client.
 * The secret key is stored in Google Cloud Secret Manager — NEVER in Firestore.
 */
export async function getStripe(): Promise<Stripe> {
  if (!stripeClient) {
    const secretKey = await getSecret('stripe-secret-key');
    stripeClient = new Stripe(secretKey, { apiVersion: '2025-02-24.acacia' });
  }
  return stripeClient;
}

/**
 * Retrieves the Stripe webhook signing secret from Secret Manager.
 */
export async function getWebhookSecret(): Promise<string> {
  return getSecret('stripe-webhook-secret');
}

/**
 * Creates a Stripe Payment Intent for a credit top-up.
 *
 * The `metadata` carries tenant context so the webhook can reconcile:
 *   - tenantId: which tenant is purchasing
 *   - uid: which user initiated
 *   - creditAmount: how many credits to grant on success
 */
export async function createPaymentIntent(
  amountCents: number,
  currency: string,
  tenantId: string,
  uid: string,
  creditAmount: number,
): Promise<{ clientSecret: string; paymentIntentId: string }> {
  const stripe = await getStripe();

  const pi = await stripe.paymentIntents.create({
    amount: amountCents,
    currency,
    metadata: {
      tenantId,
      uid,
      creditAmount: String(creditAmount),
    },
    automatic_payment_methods: { enabled: true },
  });

  return {
    clientSecret: pi.client_secret!,
    paymentIntentId: pi.id,
  };
}

/**
 * Creates and finalizes a Stripe Invoice for a completed credit purchase.
 * The invoice is automatically emailed to the customer.
 */
export async function createInvoiceForPayment(
  tenantId: string,
  creditAmount: number,
  amountCents: number,
  customerEmail?: string,
): Promise<{ invoiceId: string; invoiceUrl: string | null }> {
  const stripe = await getStripe();

  // Create or retrieve Stripe customer
  const customers = await stripe.customers.search({
    query: `metadata["tenantId"]:"${tenantId}"`,
    limit: 1,
  });

  let customerId: string;
  if (customers.data.length > 0) {
    customerId = customers.data[0].id;
  } else {
    const customer = await stripe.customers.create({
      metadata: { tenantId },
      email: customerEmail,
    });
    customerId = customer.id;
  }

  // Create invoice with line item
  const invoice = await stripe.invoices.create({
    customer: customerId,
    auto_advance: true,
    collection_method: 'charge_automatically',
    metadata: { tenantId, creditAmount: String(creditAmount) },
  });

  await stripe.invoiceItems.create({
    customer: customerId,
    invoice: invoice.id,
    amount: amountCents,
    currency: 'usd',
    description: `Vizo Credits: ${creditAmount} credits`,
  });

  // Finalize and mark as paid (payment already collected via PI)
  const finalized = await stripe.invoices.finalizeInvoice(invoice.id);
  await stripe.invoices.pay(invoice.id, { paid_out_of_band: true });

  return {
    invoiceId: finalized.id,
    invoiceUrl: finalized.hosted_invoice_url ?? null,
  };
}

/**
 * Constructs and verifies a Stripe webhook event from raw body + signature.
 */
export function constructWebhookEvent(
  rawBody: Buffer,
  signature: string,
  webhookSecret: string,
): Stripe.Event {
  const stripe = new Stripe('unused', { apiVersion: '2025-02-24.acacia' });
  return stripe.webhooks.constructEvent(rawBody, signature, webhookSecret);
}
