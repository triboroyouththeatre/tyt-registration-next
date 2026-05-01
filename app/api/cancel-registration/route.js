import { createClient } from '@/lib/supabase/server';
import { createClient as createAdminClient } from '@supabase/supabase-js';
import Stripe from 'stripe';
import { Resend } from 'resend';

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);
const resend  = new Resend(process.env.RESEND_API_KEY);

const REGISTRATION_STATUS_CANCELLED = '1878c625-8ce3-472c-b6d1-b84fdb04d90b';
const PAYMENT_STATUS_PAID           = '7009f776-f127-4f74-8c48-0efec65316a8';
const PAYMENT_TYPE_REFUND           = '4f51031a-e6ec-464a-9aaa-77279bd09ec9';

function fmt(amount) {
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(Number(amount) || 0);
}

function fmtDate(str) {
  if (!str) return '—';
  return new Date(str + 'T00:00:00').toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' });
}

export async function POST(request) {
  try {
    // Verify admin
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return Response.json({ error: 'Not authenticated' }, { status: 401 });
    const { data: profile } = await supabase.from('profiles').select('role').eq('id', user.id).single();
    if (profile?.role !== 'admin') return Response.json({ error: 'Not authorized' }, { status: 403 });

    const admin = createAdminClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL,
      process.env.SUPABASE_SERVICE_ROLE_KEY
    );

    const { registrationId, refundAmount, releaseSpot } = await request.json();

    if (!registrationId) return Response.json({ error: 'Missing registrationId' }, { status: 400 });

    // Fetch registration with all needed data
    const { data: reg } = await admin
      .from('registrations')
      .select(`
        id, registration_number, family_id, participant_id,
        amount_paid, total_fee, stripe_payment_intent_id, stripe_invoice_id,
        cart_id,
        participants(first_name, last_name, nickname),
        carts(program_id, programs(label, balance_due_date, sessions(seasons(display_name, name))))
      `)
      .eq('id', registrationId)
      .single();

    if (!reg) return Response.json({ error: 'Registration not found' }, { status: 404 });

    const { data: family } = await admin.from('families').select('email').eq('id', reg.family_id).single();
    const { data: guardian } = await admin.from('contacts').select('first_name, last_name').eq('family_id', reg.family_id).eq('priority', 1).single();

    const refundAmt = parseFloat(refundAmount) || 0;
    const stripeResults = {};

    // 1. Issue Stripe refund if there's a payment intent and refund amount > 0
    if (reg.stripe_payment_intent_id && refundAmt > 0) {
      try {
        // Get the charge from the payment intent
        const pi = await stripe.paymentIntents.retrieve(reg.stripe_payment_intent_id);
        const chargeId = pi.latest_charge;

        if (chargeId) {
          const refund = await stripe.refunds.create({
            charge: chargeId,
            amount: Math.round(refundAmt * 100), // Convert to cents
          });
          stripeResults.refund = refund.id;
          stripeResults.refundStatus = refund.status;
        }
      } catch (err) {
        console.error('[cancel] Stripe refund error:', err.message);
        stripeResults.refundError = err.message;
      }
    }

    // 2. Void outstanding Stripe invoice if exists
    if (reg.stripe_invoice_id) {
      try {
        const invoice = await stripe.invoices.retrieve(reg.stripe_invoice_id);
        if (invoice.status === 'open') {
          await stripe.invoices.voidInvoice(reg.stripe_invoice_id);
          stripeResults.invoiceVoided = true;
        }
      } catch (err) {
        console.error('[cancel] Stripe invoice void error:', err.message);
        stripeResults.invoiceError = err.message;
      }
    }

    // 3. Update registration status to Cancelled
    await admin
      .from('registrations')
      .update({
        status_id:         REGISTRATION_STATUS_CANCELLED,
        stripe_invoice_id: null,
        updated_at:        new Date().toISOString(),
      })
      .eq('id', registrationId);

    // 4. Insert refund payment record if refund was issued
    if (refundAmt > 0) {
      await admin.from('payments').insert({
        registration_id:  registrationId,
        family_id:        reg.family_id,
        amount:           -refundAmt, // Negative to indicate refund
        status_id:        PAYMENT_STATUS_PAID,
        type_id:          PAYMENT_TYPE_REFUND,
        payment_method:   'Stripe Refund',
        notes:            `Refund issued on cancellation. Stripe refund: ${stripeResults.refund || 'N/A'}`,
        paid_at:          new Date().toISOString(),
      });
    }

    // 5. Release spot if requested (just let enrollment count drop naturally)
    // Enrollment counts are derived from active registrations so changing
    // status to Cancelled automatically reduces the count — no extra action needed.

    // 6. Send cancellation email
    const participantName = reg.participants?.nickname
      ? `${reg.participants.nickname} ${reg.participants.last_name}`
      : `${reg.participants?.first_name} ${reg.participants?.last_name}`;
    const guardianName = guardian ? `${guardian.first_name} ${guardian.last_name}` : 'Family';
    const progLabel    = reg.carts?.programs?.label || 'Program';

    const { data: template } = await admin
      .from('email_templates')
      .select('subject, body_html')
      .eq('key', 'cancellation')
      .single();

    if (template && family?.email) {
      const vars = {
        '{{guardian_name}}':       guardianName,
        '{{participant_name}}':    participantName,
        '{{program_name}}':        progLabel,
        '{{registration_number}}': reg.registration_number,
        '{{amount_refunded}}':     refundAmt > 0 ? fmt(refundAmt) : '$0.00 (no refund issued)',
      };
      let subject  = template.subject;
      let bodyHtml = template.body_html;
      for (const [k, v] of Object.entries(vars)) {
        subject  = subject.replaceAll(k, v);
        bodyHtml = bodyHtml.replaceAll(k, v);
      }
      await resend.emails.send({
        from:    'TYT Family Portal <noreply@triboroyouththeatre.org>',
        to:      family.email,
        subject,
        html:    bodyHtml,
      });
    }

    return Response.json({
      success:    true,
      stripeResults,
      refundAmt,
    });

  } catch (err) {
    console.error('[cancel-registration] error:', err.message);
    return Response.json({ error: err.message }, { status: 500 });
  }
}