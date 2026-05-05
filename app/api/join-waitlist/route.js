import { createClient } from '@/lib/supabase/server';
import { createClient as createAdminClient } from '@supabase/supabase-js';
import { Resend } from 'resend';
import { renderEmail } from '@/lib/email-render';

const resend = new Resend(process.env.RESEND_API_KEY);

const REGISTRATION_STATUS_CANCELLED = '1878c625-8ce3-472c-b6d1-b84fdb04d90b';

export async function POST(request) {
  try {
    // Verify the user is authenticated
    const supabase = await createClient();
    const { data: { user }, error: userErr } = await supabase.auth.getUser();
    if (userErr || !user) {
      return Response.json({ error: 'Not authenticated' }, { status: 401 });
    }

    // Get the user's family
    const { data: profile } = await supabase
      .from('profiles').select('family_id').eq('id', user.id).single();
    const familyId = profile?.family_id;
    if (!familyId) {
      return Response.json({ error: 'No family found' }, { status: 400 });
    }

    const { programId, participantId } = await request.json();
    if (!programId || !participantId) {
      return Response.json({ error: 'Missing programId or participantId' }, { status: 400 });
    }

    // Use admin client for cross-table reads/writes
    const admin = createAdminClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL,
      process.env.SUPABASE_SERVICE_ROLE_KEY
    );

    // Verify the participant belongs to this family
    const { data: participant } = await admin
      .from('participants')
      .select('id, first_name, last_name, nickname, family_id, yog')
      .eq('id', participantId)
      .single();

    if (!participant || participant.family_id !== familyId) {
      return Response.json({ error: 'Participant not found' }, { status: 404 });
    }

    // Fetch program with enrollment limit
    const { data: program } = await admin
      .from('programs')
      .select('id, label, enrollment_limit, yog_min, yog_max, is_active, is_registration_open')
      .eq('id', programId)
      .single();

    if (!program || !program.is_active) {
      return Response.json({ error: 'Program not found' }, { status: 404 });
    }

    if (!program.is_registration_open) {
      return Response.json({ error: 'Registration is not open for this program' }, { status: 400 });
    }

    // Eligibility check
    if (program.yog_min && program.yog_max) {
      if (participant.yog < program.yog_min || participant.yog > program.yog_max) {
        return Response.json({ error: 'Participant is not eligible for this program' }, { status: 400 });
      }
    }

    // Check if program is actually full. Uses carts.program_id — the same
    // approach as the register page enrollment count. registration_programs
    // is unused/empty and must not be queried here.
    const { data: enrolledCarts } = await admin
      .from('registrations')
      .select('cart_id, carts!inner(program_id)')
      .eq('carts.program_id', programId)
      .neq('status_id', REGISTRATION_STATUS_CANCELLED);

    const currentEnrollment = enrolledCarts?.length || 0;
    if (currentEnrollment < program.enrollment_limit) {
      return Response.json({
        error: 'This program still has open spots — please register normally.',
      }, { status: 400 });
    }

    // Check if this participant is already on the waitlist for this program
    const { data: existing } = await admin
      .from('waitlist')
      .select('id, status')
      .eq('program_id', programId)
      .eq('participant_id', participantId)
      .maybeSingle();

    if (existing) {
      if (existing.status === 'waiting' || existing.status === 'offered') {
        return Response.json({
          error: 'This participant is already on the waitlist for this program.',
        }, { status: 400 });
      }
      // If status is 'cancelled' or 'accepted', allow re-joining by reactivating
      const { error: updateErr } = await admin
        .from('waitlist')
        .update({ status: 'waiting', notified_at: null, offer_token: null })
        .eq('id', existing.id);
      if (updateErr) throw new Error('Failed to rejoin waitlist: ' + updateErr.message);
    } else {
      // Insert new waitlist row
      const { error: insertErr } = await admin
        .from('waitlist')
        .insert({
          family_id:      familyId,
          participant_id: participantId,
          program_id:     programId,
          status:         'waiting',
        });
      if (insertErr) throw new Error('Failed to join waitlist: ' + insertErr.message);
    }

    // Send confirmation email
    const { data: family } = await admin.from('families').select('email').eq('id', familyId).single();
    const { data: guardian } = await admin
      .from('contacts')
      .select('first_name, last_name')
      .eq('family_id', familyId)
      .eq('priority', 1)
      .single();

    const participantName = participant.nickname
      ? `${participant.nickname} ${participant.last_name}`
      : `${participant.first_name} ${participant.last_name}`;
    const guardianName = guardian
      ? `${guardian.first_name} ${guardian.last_name}`
      : 'Family';

    const { data: template } = await admin
      .from('email_templates')
      .select('subject, body_html')
      .eq('key', 'waitlist_joined')
      .single();

    if (template && family?.email) {
      const { subject, html } = renderEmail(template, {
        guardian_name:    guardianName,
        participant_name: participantName,
        program_name:     program.label,
      });

      await resend.emails.send({
        from:    'TYT Family Portal <noreply@triboroyouththeatre.org>',
        to:      family.email,
        bcc:     'admin@triboroyouththeatre.org',
        subject,
        html,
      });
    }

    return Response.json({ success: true });

  } catch (err) {
    console.error('[join-waitlist] error:', err);
    return Response.json({ error: err.message }, { status: 500 });
  }
}