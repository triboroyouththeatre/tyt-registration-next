import Stripe from 'stripe';
import { createClient } from '@/lib/supabase/server';

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);

export async function POST(request) {
  try {
    const supabase = await createClient();

    // Verify the user is authenticated
    const { data: { user }, error: userError } = await supabase.auth.getUser();
    if (userError || !user) {
      return Response.json({ error: 'Not authenticated' }, { status: 401 });
    }

    const { cartItems, programId } = await request.json();

    if (!cartItems || cartItems.length === 0) {
      return Response.json({ error: 'No items in cart' }, { status: 400 });
    }

    // Calculate total deposit in cents
    const totalDeposit = cartItems.reduce((sum, item) => {
      return sum + Math.round(parseFloat(item.deposit) * 100);
    }, 0);

    if (totalDeposit <= 0) {
      return Response.json({ error: 'Invalid deposit amount' }, { status: 400 });
    }

    // Get family info for Stripe metadata
    const { data: profile } = await supabase
      .from('profiles')
      .select('family_id')
      .eq('id', user.id)
      .single();

    const { data: family } = await supabase
      .from('families')
      .select('email')
      .eq('id', profile.family_id)
      .single();

    // Build description
    const participantNames = cartItems.map(i => i.participantName).join(', ');
    const programLabel = cartItems[0]?.programLabel || 'Registration';
    const description = `${programLabel} deposit — ${participantNames}`;

    // Create Stripe Payment Intent
    const paymentIntent = await stripe.paymentIntents.create({
      amount: totalDeposit,
      currency: 'usd',
      description,
      receipt_email: family?.email || user.email,
      metadata: {
        family_id: profile.family_id,
        program_id: programId,
        participant_ids: cartItems.map(i => i.participantId).join(','),
        participant_count: cartItems.length.toString(),
      },
    });

    return Response.json({
      clientSecret: paymentIntent.client_secret,
      paymentIntentId: paymentIntent.id,
      amount: totalDeposit,
    });

  } catch (err) {
    console.error('[create-payment-intent] error:', err);
    return Response.json({ error: err.message }, { status: 500 });
  }
}