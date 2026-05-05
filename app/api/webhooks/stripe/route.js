import { createClient } from '@supabase/supabase-js';
import Stripe from 'stripe';
import {
  REGISTRATION_STATUS_ACTIVE,
  PAYMENT_STATUS_PAID,
  PAYMENT_STATUS_OVERDUE,
} from '@/lib/constants';

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);

const admin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

export async function POST(request) {
  const body      = await request.text();
  const signature = request.headers.get('stripe-signature');

  let event;
  try {
    event = stripe.webhooks.constructEvent(body, signature, process.env.STRIPE_WEBHOOK_SECRET);
  } catch (err) {
    console.error('[webhook] Signature verification failed:', err.message);
    return Response.json({ error: 'Invalid signature' }, { status: 400 });
  }

  console.log(`[webhook] Received event: ${event.type}`);

  try {
    switch (event.type) {

      // ── Deposit or full payment succeeded ─────────────────────────────────
      case 'payment_intent.succeeded': {
        const pi = event.data.object;
        const paymentIntentId = pi.id;

        // Update payment record to Paid
        const { error: payErr } = await admin
          .from('payments')
          .update({ status_id: PAYMENT_STATUS_PAID })
          .eq('stripe_payment_intent_id', paymentIntentId);

        if (payErr) console.error('[webhook] Payment update failed:', payErr.message);

        // Update registration status to Active
        const { error: regErr } = await admin
          .from('registrations')
          .update({
            status_id:  REGISTRATION_STATUS_ACTIVE,
            updated_at: new Date().toISOString(),
          })
          .eq('stripe_payment_intent_id', paymentIntentId);

        if (regErr) console.error('[webhook] Registration update failed:', regErr.message);

        console.log(`[webhook] payment_intent.succeeded processed: ${paymentIntentId}`);
        break;
      }

      // ── Balance invoice paid ───────────────────────────────────────────────
      case 'invoice.paid': {
        const invoice   = event.data.object;
        const invoiceId = invoice.id;
        const customerId = invoice.customer;

        // Find payment record by invoice ID
        const { data: payment, error: findErr } = await admin
          .from('payments')
          .select('id, registration_id')
          .eq('stripe_invoice_id', invoiceId)
          .single();

        if (findErr || !payment) {
          // Invoice may not have a matching payment record yet — insert one
          // Look up family by Stripe customer ID
          const { data: family } = await admin
            .from('families')
            .select('id')
            .eq('stripe_customer_id', customerId)
            .single();

          if (family) {
            // Find the registration linked to this invoice
            const { data: reg } = await admin
              .from('registrations')
              .select('id')
              .eq('stripe_invoice_id', invoiceId)
              .single();

            if (reg) {
              await admin.from('payments').update({ status_id: PAYMENT_STATUS_PAID })
                .eq('registration_id', reg.id);
            }
          }
        } else {
          // Update existing payment record
          await admin
            .from('payments')
            .update({ status_id: PAYMENT_STATUS_PAID })
            .eq('id', payment.id);
        }

        console.log(`[webhook] invoice.paid processed: ${invoiceId}`);
        break;
      }

      // ── Balance invoice payment failed ────────────────────────────────────
      case 'invoice.payment_failed': {
        const invoice    = event.data.object;
        const invoiceId  = invoice.id;
        const customerId = invoice.customer;

        // Mark payment as overdue
        const { error: overdueErr } = await admin
          .from('payments')
          .update({ status_id: PAYMENT_STATUS_OVERDUE })
          .eq('stripe_invoice_id', invoiceId);

        if (overdueErr) console.error('[webhook] Overdue update failed:', overdueErr.message);

        // Get family email to notify admin
        const { data: family } = await admin
          .from('families')
          .select('email')
          .eq('stripe_customer_id', customerId)
          .single();

        console.log(`[webhook] invoice.payment_failed — customer: ${customerId}, family: ${family?.email}, invoice: ${invoiceId}`);
        break;
      }

      // ── Payment intent failed ─────────────────────────────────────────────
      case 'payment_intent.payment_failed': {
        const pi = event.data.object;
        console.log(`[webhook] payment_intent.payment_failed: ${pi.id}`);
        break;
      }

      default:
        console.log(`[webhook] Unhandled event type: ${event.type}`);
    }
  } catch (err) {
    console.error('[webhook] Handler error:', err.message);
    return Response.json({ error: err.message }, { status: 500 });
  }

  return Response.json({ received: true });
}