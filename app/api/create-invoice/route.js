import Stripe from 'stripe';
import { createClient } from '@/lib/supabase/server';

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);
const FEE_RATE = 0.05;

export async function POST(request) {
  try {
    const supabase = await createClient();

    const { data: { user }, error: userError } = await supabase.auth.getUser();
    if (userError || !user) {
      return Response.json({ error: 'Not authenticated' }, { status: 401 });
    }

    const {
      stripeCustomerId,
      registrations, // array of { registrationId, participantName, programLabel, totalFee, amountPaid, balanceDueDate }
    } = await request.json();

    if (!stripeCustomerId || !registrations?.length) {
      return Response.json({ error: 'Missing invoice data' }, { status: 400 });
    }

    // Create one invoice covering all registrations in the cart
    const invoice = await stripe.invoices.create({
      customer: stripeCustomerId,
      collection_method: 'send_invoice',
      days_until_due: 0, // We'll set due date explicitly
      auto_advance: false, // Don't auto-finalize yet — we'll finalize after adding items
      metadata: {
        registration_ids: registrations.map(r => r.registrationId).join(','),
      },
    });

    // Add a line item per registration for the balance
    for (const reg of registrations) {
      const balance = reg.totalFee - reg.amountPaid;
      if (balance <= 0) continue;

      const balanceCents = Math.round(balance * 100);
      const feeCents = Math.round(balance * FEE_RATE * 100);

      // Balance line item
      await stripe.invoiceItems.create({
        customer: stripeCustomerId,
        invoice: invoice.id,
        amount: balanceCents,
        currency: 'usd',
        description: `${reg.programLabel} — ${reg.participantName} (balance due)`,
      });

      // Fee line item
      await stripe.invoiceItems.create({
        customer: stripeCustomerId,
        invoice: invoice.id,
        amount: feeCents,
        currency: 'usd',
        description: `Processing fee (5%)`,
      });
    }

    // Set due date from program balance_due_date
    const balanceDueDate = registrations[0]?.balanceDueDate;
    const dueDateUnix = balanceDueDate
      ? Math.floor(new Date(balanceDueDate + 'T00:00:00').getTime() / 1000)
      : Math.floor(Date.now() / 1000) + 30 * 24 * 60 * 60; // fallback: 30 days

    // Finalize and send the invoice
    await stripe.invoices.finalizeInvoice(invoice.id, {
      auto_advance: true,
    });

    await stripe.invoices.update(invoice.id, {
      due_date: dueDateUnix,
    });

    await stripe.invoices.sendInvoice(invoice.id);

    // Save invoice ID to each registration record
    for (const reg of registrations) {
      await supabase
        .from('registrations')
        .update({ stripe_invoice_id: invoice.id })
        .eq('id', reg.registrationId);
    }

    return Response.json({ invoiceId: invoice.id });

  } catch (err) {
    console.error('[create-invoice] error:', err);
    return Response.json({ error: err.message }, { status: 500 });
  }
}