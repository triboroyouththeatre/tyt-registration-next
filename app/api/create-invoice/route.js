import { createClient } from '@/lib/supabase/server';
import { createStripeInvoice } from '@/lib/stripe-invoice';

export async function POST(request) {
  try {
    const supabase = await createClient();
    const { data: { user }, error: userError } = await supabase.auth.getUser();
    if (userError || !user) {
      return Response.json({ error: 'Not authenticated' }, { status: 401 });
    }

    const { data: profile } = await supabase
      .from('profiles').select('family_id, role').eq('id', user.id).single();

    const { stripeCustomerId, registrations } = await request.json();
    if (!stripeCustomerId || !registrations?.length) {
      return Response.json({ error: 'Missing invoice data' }, { status: 400 });
    }

    // Verify all registrations belong to the calling user's family (admins bypass)
    if (profile?.role !== 'admin') {
      const { data: regs } = await supabase
        .from('registrations')
        .select('id, family_id')
        .in('id', registrations.map(r => r.registrationId));

      if (!regs || regs.some(r => r.family_id !== profile.family_id)) {
        return Response.json({ error: 'Not authorized' }, { status: 403 });
      }
    }

    const invoiceId = await createStripeInvoice({ stripeCustomerId, registrations });

    await supabase
      .from('registrations')
      .update({ stripe_invoice_id: invoiceId })
      .in('id', registrations.map(r => r.registrationId));

    return Response.json({ invoiceId });

  } catch (err) {
    console.error('[create-invoice] error:', err);
    return Response.json({ error: err.message }, { status: 500 });
  }
}
