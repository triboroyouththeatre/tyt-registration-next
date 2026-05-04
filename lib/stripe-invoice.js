import { stripe } from '@/lib/stripe';

const FEE_RATE = 0.05;

export async function createStripeInvoice({ stripeCustomerId, registrations }) {
  const invoice = await stripe.invoices.create({
    customer: stripeCustomerId,
    collection_method: 'send_invoice',
    days_until_due: 0,
    auto_advance: false,
    metadata: {
      registration_ids: registrations.map(r => r.registrationId).join(','),
    },
  });

  for (const reg of registrations) {
    const balance = reg.totalFee - reg.amountPaid;
    if (balance <= 0) continue;
    const balanceCents = Math.round(balance * 100);
    const feeCents     = Math.round(balance * FEE_RATE * 100);

    await stripe.invoiceItems.create({
      customer: stripeCustomerId,
      invoice:  invoice.id,
      amount:   balanceCents,
      currency: 'usd',
      description: `${reg.programLabel} — ${reg.participantName} (balance due)`,
    });

    await stripe.invoiceItems.create({
      customer: stripeCustomerId,
      invoice:  invoice.id,
      amount:   feeCents,
      currency: 'usd',
      description: 'Processing fee (5%)',
    });
  }

  const balanceDueDate = registrations[0]?.balanceDueDate;
  const dueDateUnix = balanceDueDate
    ? Math.floor(new Date(balanceDueDate + 'T00:00:00').getTime() / 1000)
    : Math.floor(Date.now() / 1000) + 30 * 24 * 60 * 60;

  const finalized = await stripe.invoices.finalizeInvoice(invoice.id, { auto_advance: true });
  await stripe.invoices.update(invoice.id, { due_date: dueDateUnix });
  await stripe.invoices.sendInvoice(invoice.id);

  return { invoiceId: finalized.id, invoiceUrl: finalized.hosted_invoice_url };
}
