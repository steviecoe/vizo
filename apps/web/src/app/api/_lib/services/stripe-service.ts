import Stripe from 'stripe';
import { getSecret } from './secret-manager';

let stripeClient: Stripe | null = null;

export async function getStripe(): Promise<Stripe> {
  if (!stripeClient) {
    const secretKey = await getSecret('stripe-secret-key');
    stripeClient = new Stripe(secretKey, { apiVersion: '2025-02-24.acacia' });
  }
  return stripeClient;
}

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

export async function createInvoiceForPayment(
  tenantId: string,
  creditAmount: number,
  amountCents: number,
  customerEmail?: string,
): Promise<{ invoiceId: string; invoiceUrl: string | null }> {
  const stripe = await getStripe();

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

  const finalized = await stripe.invoices.finalizeInvoice(invoice.id);
  await stripe.invoices.pay(invoice.id, { paid_out_of_band: true });

  return {
    invoiceId: finalized.id,
    invoiceUrl: finalized.hosted_invoice_url ?? null,
  };
}
