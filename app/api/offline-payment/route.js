import { createClient } from '@/lib/supabase/server';
import { createClient as createAdminClient } from '@supabase/supabase-js';
import { stripe } from '@/lib/stripe';
import { Resend } from 'resend';
import { renderEmail } from '@/lib/email-render';
import { getFamilyRecipients } from '@/lib/email-recipients';

const resend = new Resend(process.env.RESEND_API_KEY);

const PAYMENT_STATUS_PAID = '7009f776-f127-4f74-8c48-0efec65316a8';

// Payment type IDs
const PAYMENT_TYPE_MAP = {
  'Check':                    '62d9687d-6f19-474e-abca-d10564f27910',
  'Cash':                     'e69c6893-4757-4d51-a46b-b9c6a8365f07',
  'Scholarship':              '3ed62714-fa8b-4ef5-80b5-cffb9e5d634c',
  'Financial Aid Adjustment': '0fc65a2d-4354-405a-a469-470780cb2747',
  'Offline Balance':          '81a6b767-1e52-42f6-a546-4019ca8fe9de',
};

function fmt(amount) {
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(Number(amount) || 0);
}

function fmtDate(str) {
  if (!str) return '\u2014';
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

    const { registrationId, amount, method, referenceNumber, receivedDate, notes } = await request.json();

    if (!registrationId || !amount || !method) {
      return Response.json({ error: 'Missing required fields' }, { status: 400 });
    }

    const paymentAmount = parseFloat(amount);
    if (isNaN(paymentAmount) || paymentAmount <= 0) {
      return Response.json({ error: 'Invalid amount' }, { status: 400 });
    }

    // Fetch the registration with all needed data
    const { data: reg } = await admin
      .from('registrations')
      .select(`
        id, registration_number, family_id, participant_id,
        amount_paid, total_fee, stripe_invoice_id,
        participants(first_name, last_name, nickname),
        carts(programs(label, balance_due_date, sessions(seasons(display_name, name))))
      `)
      .eq('id', registrationId)
      .single();

    if (!reg) return Response.json({ error: 'Registration not found' }, { status: 404 });

    // Fetch email recipients (primary + secondary contacts)
    const recipients = await getFamilyRecipients(admin, reg.family_id);

    // Fetch primary guardian name
    const { data: guardian } = await admin
      .from('contacts')
      .select('first_name, last_name')
      .eq('family_id', reg.family_id)
      .eq('priority', 1)
      .single();

    const currentPaid  = parseFloat(reg.amount_paid) || 0;
    const totalFee     = parseFloat(reg.total_fee)   || 0;
    const newAmountPaid = currentPaid + paymentAmount;
    const newBalance    = Math.max(0, totalFee - newAmountPaid);
    const isFullyPaid   = newBalance < 0.01;

    const typeId = PAYMENT_TYPE_MAP[method] || PAYMENT_TYPE_MAP['Offline Balance'];

    // 1. Insert payment record
    const { error: payErr } = await admin.from('payments').insert({
      registration_id:   registrationId,
      family_id:         reg.family_id,
      amount:            paymentAmount,
      status_id:         PAYMENT_STATUS_PAID,
      type_id:           typeId,
      payment_method:    method,
      reference_number:  referenceNumber || null,
      notes:             notes || null,
      recorded_by:       user.email,
      paid_at:           receivedDate ? new Date(receivedDate + 'T12:00:00').toISOString() : new Date().toISOString(),
    });
    if (payErr) throw new Error('Payment insert: ' + payErr.message);

    // 2. Update registration amount_paid
    const { error: regErr } = await admin
      .from('registrations')
      .update({ amount_paid: newAmountPaid, updated_at: new Date().toISOString() })
      .eq('id', registrationId);
    if (regErr) throw new Error('Registration update: ' + regErr.message);

    // 3. Handle Stripe invoice
    let stripeAction = 'none';
    if (reg.stripe_invoice_id) {
      try {
        const invoice = await stripe.invoices.retrieve(reg.stripe_invoice_id);

        if (invoice.status === 'open') {
          if (isFullyPaid) {
            // Void the invoice — no Stripe payment needed
            await stripe.invoices.voidInvoice(reg.stripe_invoice_id);
            stripeAction = 'voided';
            // Clear invoice fields so the Pay Balance button disappears
            await admin.from('registrations').update({
              stripe_invoice_id:  null,
              stripe_invoice_url: null,
            }).eq('id', registrationId);
          } else {
            // Partial payment — void old invoice and create new one for remaining balance
            await stripe.invoices.voidInvoice(reg.stripe_invoice_id);

            // Get Stripe customer ID
            const { data: fam } = await admin.from('families').select('stripe_customer_id').eq('id', reg.family_id).single();
            if (fam?.stripe_customer_id && newBalance > 0) {
              const progLabel       = reg.carts?.programs?.label || 'Program Balance';
              const balanceDueDate  = reg.carts?.programs?.balance_due_date || null;
              const participantName = reg.participants?.nickname
                ? `${reg.participants.nickname} ${reg.participants.last_name}`
                : `${reg.participants?.first_name} ${reg.participants?.last_name}`;

              const dueDateUnix = balanceDueDate
                ? Math.floor(new Date(balanceDueDate + 'T00:00:00').getTime() / 1000)
                : Math.floor(Date.now() / 1000) + 30 * 24 * 60 * 60;

              // Create new invoice for remaining balance (no processing fee for offline)
              const newInvoice = await stripe.invoices.create({
                customer:          fam.stripe_customer_id,
                auto_advance:      false,
                collection_method: 'send_invoice',
                description:       `Remaining balance \u2014 ${progLabel} (${participantName})`,
              });

              await stripe.invoiceItems.create({
                customer:    fam.stripe_customer_id,
                invoice:     newInvoice.id,
                amount:      Math.round(newBalance * 100),
                currency:    'usd',
                description: `Remaining balance \u2014 ${progLabel} (${participantName})`,
              });

              // Set due date before finalizing
              await stripe.invoices.update(newInvoice.id, { due_date: dueDateUnix });

              const finalized = await stripe.invoices.finalizeInvoice(newInvoice.id, { auto_advance: false });
              await stripe.invoices.sendInvoice(newInvoice.id);

              // Save new invoice ID and URL so the Pay Balance button stays current
              await admin.from('registrations').update({
                stripe_invoice_id:  newInvoice.id,
                stripe_invoice_url: finalized.hosted_invoice_url,
              }).eq('id', registrationId);
              stripeAction = 'updated';
            }
          }
        }
      } catch (stripeErr) {
        console.error('[offline-payment] Stripe error:', stripeErr.message);
        // Don't fail the whole transaction if Stripe fails
        stripeAction = 'error: ' + stripeErr.message;
      }
    }

    // 4. Send receipt email
    const participantName = reg.participants?.nickname
      ? `${reg.participants.nickname} ${reg.participants.last_name}`
      : `${reg.participants?.first_name} ${reg.participants?.last_name}`;
    const guardianName = guardian ? `${guardian.first_name} ${guardian.last_name}` : 'Family';
    const progLabel    = reg.carts?.programs?.label || 'Program';
    const dueDate      = reg.carts?.programs?.balance_due_date;

    // Fetch email template
    const { data: template } = await admin
      .from('email_templates')
      .select('subject, body_html')
      .eq('key', 'offline_payment')
      .single();

    if (template && recipients.length > 0) {
      const vars = {
        guardian_name:       guardianName,
        participant_name:    participantName,
        program_name:        progLabel,
        registration_number: reg.registration_number,
        amount_paid:         fmt(paymentAmount),
        payment_method:      method,
        balance_remaining:   newBalance > 0.01 ? fmt(newBalance) : '',
        balance_due_date:    dueDate ? fmtDate(dueDate) : '',
      };

      const { subject, html } = renderEmail(template, vars);

      await resend.emails.send({
        from:    'TYT Family Portal <noreply@triboroyouththeatre.org>',
        to:      recipients,
        subject,
        html,
      });
    }

    return Response.json({
      success: true,
      newAmountPaid,
      newBalance,
      isFullyPaid,
      stripeAction,
    });

  } catch (err) {
    console.error('[offline-payment] error:', err.message);
    return Response.json({ error: err.message }, { status: 500 });
  }
}