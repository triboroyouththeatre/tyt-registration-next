import { createClient as createAdminClient } from '@supabase/supabase-js';
import { stripe } from '@/lib/stripe';
import { createStripeInvoice } from '@/lib/stripe-invoice';

const admin = createAdminClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

export async function POST(request) {
  const { secret } = await request.json();
  if (secret !== process.env.CRON_SECRET) {
    return Response.json({ error: 'Forbidden' }, { status: 403 });
  }

  let urlsBackfilled = 0;
  let invoicesCreated = 0;
  const errors = [];

  // Case 1: Has invoice ID but no URL — just fetch the URL from Stripe
  const { data: missingUrl } = await admin
    .from('registrations')
    .select('id, stripe_invoice_id')
    .not('stripe_invoice_id', 'is', null)
    .is('stripe_invoice_url', null);

  for (const reg of missingUrl || []) {
    try {
      const invoice = await stripe.invoices.retrieve(reg.stripe_invoice_id);
      if (invoice.hosted_invoice_url) {
        await admin
          .from('registrations')
          .update({ stripe_invoice_url: invoice.hosted_invoice_url })
          .eq('id', reg.id);
        urlsBackfilled++;
      }
    } catch (err) {
      errors.push({ id: reg.id, step: 'fetch-url', error: err.message });
    }
  }

  // Case 2: Has a balance but no invoice at all — create one now
  const { data: missingInvoice } = await admin
    .from('registrations')
    .select(`
      id, family_id, amount_paid, total_fee,
      is_financial_aid_requested,
      participants(first_name, last_name, nickname),
      carts(programs(label, balance_due_date)),
      families(stripe_customer_id)
    `)
    .is('stripe_invoice_id', null)
    .eq('is_financial_aid_requested', false);

  for (const reg of missingInvoice || []) {
    const balance = (reg.total_fee || 0) - (reg.amount_paid || 0);
    if (balance <= 0.01) continue;

    const stripeCustomerId = reg.families?.stripe_customer_id;
    if (!stripeCustomerId) continue;

    const p = reg.participants;
    const participantName = p?.nickname
      ? `${p.nickname} ${p.last_name}`
      : `${p?.first_name} ${p?.last_name}`;

    try {
      const { invoiceId, invoiceUrl } = await createStripeInvoice({
        stripeCustomerId,
        registrations: [{
          registrationId:  reg.id,
          participantName,
          programLabel:    reg.carts?.programs?.label || 'Program',
          totalFee:        reg.total_fee,
          amountPaid:      reg.amount_paid,
          balanceDueDate:  reg.carts?.programs?.balance_due_date || null,
        }],
      });

      await admin
        .from('registrations')
        .update({ stripe_invoice_id: invoiceId, stripe_invoice_url: invoiceUrl })
        .eq('id', reg.id);

      invoicesCreated++;
    } catch (err) {
      errors.push({ id: reg.id, step: 'create-invoice', error: err.message });
    }
  }

  return Response.json({ urlsBackfilled, invoicesCreated, errors });
}
