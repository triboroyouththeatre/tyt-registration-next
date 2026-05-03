import { createClient } from '@/lib/supabase/server';
import { createClient as createAdminClient } from '@supabase/supabase-js';

const REGISTRATION_STATUS_PENDING = '448779d0-8e45-47e1-b653-37d8fb16eb20';
const PAYMENT_STATUS_PENDING      = '92d4b30c-799e-43ba-83e1-f7989d95f612';
const AWARD_LEVEL_NO_AWARD        = '386e44d8-0a4d-4462-85f1-adaa8231a287';
const PAYMENT_TYPE_DEPOSIT        = '57347d8e-8b1f-4beb-8bdd-b706fa9bc5a2';
const PAYMENT_TYPE_FULL           = '78cdca58-6a51-4a89-9f61-ff2eb1d62faf';

export async function POST(request) {
  try {
    // Verify the user is authenticated
    const supabase = await createClient();
    const { data: { user }, error: userErr } = await supabase.auth.getUser();
    if (userErr || !user) {
      return Response.json({ error: 'Not authenticated' }, { status: 401 });
    }

    const { data: profile } = await supabase
      .from('profiles').select('family_id').eq('id', user.id).single();
    const familyId = profile?.family_id;
    if (!familyId) {
      return Response.json({ error: 'No family found' }, { status: 400 });
    }

    // Use admin client to bypass RLS for writes
    const admin = createAdminClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL,
      process.env.SUPABASE_SERVICE_ROLE_KEY
    );

    const {
      cartItems, programId, stripePaymentIntentId,
      paymentAmount, totalCharged, maxPayment,
      programData, stripeCustomerId,
      waitlistToken, waitlistParticipantId,
    } = await request.json();

    // ── Validate waitlist token if present ────────────────────────────────────
    // Defense-in-depth: even though the Health page validated this on entry,
    // we re-validate here at write time to prevent tampering.
    let waitlistEntry = null;
    if (waitlistToken) {
      const { data: entry } = await admin
        .from('waitlist')
        .select('id, status, family_id, program_id, participant_id, offer_token')
        .eq('offer_token', waitlistToken)
        .eq('program_id', programId)
        .eq('participant_id', waitlistParticipantId)
        .eq('family_id', familyId)
        .eq('status', 'offered')
        .maybeSingle();

      if (!entry) {
        return Response.json({
          error: 'This waitlist offer is no longer available. The spot may have already been claimed or the offer may have been withdrawn.',
        }, { status: 400 });
      }
      waitlistEntry = entry;
    }

    const isFullPayment = Math.abs(paymentAmount - maxPayment) < 0.01;
    const paymentTypeId = isFullPayment ? PAYMENT_TYPE_FULL : PAYMENT_TYPE_DEPOSIT;

    // 1. Create cart
    const { data: cart, error: cartErr } = await admin
      .from('carts')
      .insert({
        family_id: familyId,
        program_id: programId,
        stripe_payment_intent_id: stripePaymentIntentId,
        total_deposit: paymentAmount,
        status: 'paid',
      })
      .select('id')
      .single();
    if (cartErr) throw new Error('Cart: ' + cartErr.message);

    const createdRegistrations = [];

    for (const item of cartItems) {
      const health     = item.health     || null;
      const agreements = item.agreements || [];

      const perParticipantPaid = paymentAmount / cartItems.length;
      const perParticipantFee  = parseFloat(item.fee);
      const awardLevelId       = health?.award_level_id || AWARD_LEVEL_NO_AWARD;

      // Generate registration number
      const { data: regNum, error: regNumErr } = await admin.rpc('generate_registration_number');
      if (regNumErr) throw new Error('Reg number: ' + regNumErr.message);

      // 2. Insert registration
      const { data: reg, error: regErr } = await admin
        .from('registrations')
        .insert({
          family_id:                  familyId,
          participant_id:             item.participantId,
          cart_id:                    cart.id,
          status_id:                  REGISTRATION_STATUS_PENDING,
          award_level_id:             awardLevelId,
          registration_number:        regNum,
          sig_parent:                 agreements[0]?.agreed_by || '',
          stripe_payment_intent_id:   stripePaymentIntentId,
          amount_paid:                perParticipantPaid,
          total_fee:                  perParticipantFee,
          is_financial_aid_requested: item.financialAid || false,
          registered_at:              new Date().toISOString(),
          updated_at:                 new Date().toISOString(),
        })
        .select('id')
        .single();
      if (regErr) throw new Error('Registration: ' + regErr.message);

      // 3. Insert health record
      if (health) {
        const { error: healthErr } = await admin.from('health_records').insert({
          registration_id:           reg.id,
          academic_flag:             health.academic_flag             || false,
          academic_notes:            health.academic_notes            || '',
          behavioral_flag:           health.behavioral_flag           || false,
          behavioral_notes:          health.behavioral_notes          || '',
          allergies_flag:            health.allergies_flag            || false,
          allergies_notes:           health.allergies_notes           || '',
          epipen:                    health.epipen                    || false,
          asthma:                    health.asthma                    || false,
          concussion_flag:           health.concussion_flag           || false,
          concussion_date:           health.concussion_date           || null,
          concussion_cleared:        health.concussion_cleared        || false,
          concussion_symptoms:       health.concussion_symptoms       || false,
          concussion_symptoms_notes: health.concussion_symptoms_notes || '',
          general_comments:          health.general_comments          || '',
        });
        if (healthErr) throw new Error('Health: ' + healthErr.message);
      }

      // 4. Insert agreements
      // Capture IP and user agent server-side for E-SIGN audit trail
      const ip = request.headers.get('x-forwarded-for')?.split(',')[0]?.trim()
             || request.headers.get('x-real-ip')
             || 'unknown';
      const userAgent = request.headers.get('user-agent') || 'unknown';

      for (const agreement of agreements) {
        const { error: agreeErr } = await admin.from('agreements').insert({
          registration_id:    reg.id,
          family_id:          familyId,
          policy_document_id: agreement.policy_document_id,
          agreed_by:          agreement.agreed_by,
          agreed_at:          agreement.agreed_at,
          ip_address:         ip,
          user_agent:         userAgent,
        });
        if (agreeErr) throw new Error('Agreement: ' + agreeErr.message);
      }

      // 5. Insert payment record
      const { error: paymentErr } = await admin.from('payments').insert({
        registration_id:          reg.id,
        family_id:                familyId,
        stripe_payment_intent_id: stripePaymentIntentId,
        amount:                   totalCharged / cartItems.length,
        status_id:                PAYMENT_STATUS_PENDING,
        type_id:                  paymentTypeId,
        paid_at:                  new Date().toISOString(),
      });
      if (paymentErr) throw new Error('Payment: ' + paymentErr.message);

      createdRegistrations.push({
        registrationId:  reg.id,
        participantName: item.participantName,
        programLabel:    item.programLabel,
        totalFee:        perParticipantFee,
        amountPaid:      perParticipantPaid,
        financialAid:    item.financialAid || false,
        balanceDueDate:  programData?.balance_due_date || null,
      });
    }

    // 6. Mark waitlist entry as accepted (if applicable)
    if (waitlistEntry) {
      const { error: wlErr } = await admin
        .from('waitlist')
        .update({
          status:      'accepted',
          offer_token: null,
        })
        .eq('id', waitlistEntry.id);
      if (wlErr) {
        // Don't fail the whole transaction — log it. The registration is already saved.
        console.error('[save-registration] Waitlist accept failed:', wlErr.message);
      }
    }

    // 7. Auto-invoice for non-FA families with remaining balance
    const nonFARegs = createdRegistrations.filter(
      r => !r.financialAid && (r.totalFee - r.amountPaid) > 0.01
    );
    if (nonFARegs.length > 0 && stripeCustomerId) {
      try {
        await fetch(`${process.env.NEXT_PUBLIC_APP_URL}/api/create-invoice`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ stripeCustomerId, registrations: nonFARegs }),
        });
      } catch (err) {
        console.error('[save-registration] Invoice failed:', err);
      }
    }

    return Response.json({ success: true, registrations: createdRegistrations });

  } catch (err) {
    console.error('[save-registration] error:', err.message);
    return Response.json({ error: err.message }, { status: 500 });
  }
}