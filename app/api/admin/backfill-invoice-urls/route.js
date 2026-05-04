import { createClient as createAdminClient } from '@supabase/supabase-js';
import { stripe } from '@/lib/stripe';

const admin = createAdminClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

export async function POST(request) {
  const { secret } = await request.json();
  if (secret !== process.env.CRON_SECRET) {
    return Response.json({ error: 'Forbidden' }, { status: 403 });
  }

  const { data: regs, error } = await admin
    .from('registrations')
    .select('id, stripe_invoice_id')
    .not('stripe_invoice_id', 'is', null)
    .is('stripe_invoice_url', null);

  if (error) return Response.json({ error: error.message }, { status: 500 });
  if (!regs?.length) return Response.json({ updated: 0, message: 'Nothing to backfill' });

  let updated = 0;
  const errors = [];

  for (const reg of regs) {
    try {
      const invoice = await stripe.invoices.retrieve(reg.stripe_invoice_id);
      if (invoice.hosted_invoice_url) {
        await admin
          .from('registrations')
          .update({ stripe_invoice_url: invoice.hosted_invoice_url })
          .eq('id', reg.id);
        updated++;
      }
    } catch (err) {
      errors.push({ id: reg.id, invoiceId: reg.stripe_invoice_id, error: err.message });
    }
  }

  return Response.json({ updated, errors });
}
