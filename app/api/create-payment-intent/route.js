import { stripe } from '@/lib/stripe';
import { createClient } from '@/lib/supabase/server';
const FEE_RATE = 0.05;

export async function POST(request) {
  try {
    const supabase = await createClient();

    // Verify authentication
    const { data: { user }, error: userError } = await supabase.auth.getUser();
    if (userError || !user) {
      return Response.json({ error: 'Not authenticated' }, { status: 401 });
    }

    const { cartItems, programId, paymentAmount } = await request.json();

    if (!cartItems || cartItems.length === 0) {
      return Response.json({ error: 'No items in cart' }, { status: 400 });
    }
    if (!paymentAmount || paymentAmount <= 0) {
      return Response.json({ error: 'Invalid payment amount' }, { status: 400 });
    }

    // Get family record
    const { data: profile } = await supabase
      .from('profiles')
      .select('family_id')
      .eq('id', user.id)
      .single();

    const { data: family } = await supabase
      .from('families')
      .select('id, email, stripe_customer_id')
      .eq('id', profile.family_id)
      .single();

    // Get primary contact name for Stripe customer
    const { data: primaryContact } = await supabase
      .from('contacts')
      .select('first_name, last_name')
      .eq('family_id', profile.family_id)
      .eq('priority', 1)
      .single();

    const customerName = primaryContact
      ? `${primaryContact.first_name} ${primaryContact.last_name}`
      : family.email;

    // ── Stripe Customer: find or create ──────────────────────────────────────

    let stripeCustomerId = family.stripe_customer_id;

    if (!stripeCustomerId) {
      // Search Stripe by email first to avoid duplicates
      const existing = await stripe.customers.search({
        query: `email:"${family.email}"`,
        limit: 1,
      });

      if (existing.data.length > 0) {
        // Customer already exists in Stripe
        stripeCustomerId = existing.data[0].id;
      } else {
        // Create new Stripe customer
        const newCustomer = await stripe.customers.create({
          name: customerName,
          email: family.email,
          metadata: {
            family_id: family.id,
          },
        });
        stripeCustomerId = newCustomer.id;
      }

      // Save Stripe customer ID back to database
      await supabase
        .from('families')
        .update({ stripe_customer_id: stripeCustomerId })
        .eq('id', family.id);
    }

    // ── Calculate amounts ─────────────────────────────────────────────────────

    const feeAmount = paymentAmount * FEE_RATE;
    const totalCharged = paymentAmount + feeAmount;
    const totalChargedCents = Math.round(totalCharged * 100);

    const participantNames = cartItems.map(i => i.participantName).join(', ');
    const programLabel = cartItems[0]?.programLabel || 'Registration';
    const description = `${programLabel} deposit — ${participantNames}`;

    // ── Create Payment Intent ─────────────────────────────────────────────────

    const paymentIntent = await stripe.paymentIntents.create({
      amount: totalChargedCents,
      currency: 'usd',
      customer: stripeCustomerId,
      description,
      receipt_email: family.email,
      metadata: {
        family_id: family.id,
        program_id: programId,
        participant_ids: cartItems.map(i => i.participantId).join(','),
        payment_amount: paymentAmount.toString(),
        fee_amount: feeAmount.toFixed(2),
        participant_count: cartItems.length.toString(),
      },
    });

    return Response.json({
      clientSecret: paymentIntent.client_secret,
      paymentIntentId: paymentIntent.id,
      stripeCustomerId,
      totalCharged,
      feeAmount,
    });

  } catch (err) {
    console.error('[create-payment-intent] error:', err);
    return Response.json({ error: err.message }, { status: 500 });
  }
}