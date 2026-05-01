import { createClient } from '@/lib/supabase/server';
import { createClient as createAdminClient } from '@supabase/supabase-js';
import { Resend } from 'resend';
import { renderEmail } from '@/lib/email-render';
import crypto from 'node:crypto';

const resend = new Resend(process.env.RESEND_API_KEY);

const VALID_ACTIONS = ['offer', 'withdraw', 'cancel'];

export async function POST(request) {
  try {
    // Verify admin
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return Response.json({ error: 'Not authenticated' }, { status: 401 });
    const { data: profile } = await supabase.from('profiles').select('role').eq('id', user.id).single();
    if (profile?.role !== 'admin') return Response.json({ error: 'Not authorized' }, { status: 403 });

    const { waitlistId, action } = await request.json();
    if (!waitlistId || !action) {
      return Response.json({ error: 'Missing waitlistId or action' }, { status: 400 });
    }
    if (!VALID_ACTIONS.includes(action)) {
      return Response.json({ error: 'Unknown action' }, { status: 400 });
    }

    const admin = createAdminClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL,
      process.env.SUPABASE_SERVICE_ROLE_KEY
    );

    // Fetch the waitlist entry with related data
    const { data: entry } = await admin
      .from('waitlist')
      .select(`
        id, status, family_id, participant_id, program_id, offer_token,
        participants(first_name, last_name, nickname),
        families(email),
        programs(id, label)
      `)
      .eq('id', waitlistId)
      .single();

    if (!entry) return Response.json({ error: 'Waitlist entry not found' }, { status: 404 });

    if (action === 'offer') {
      if (entry.status !== 'waiting') {
        return Response.json({ error: `Cannot offer a spot to an entry with status "${entry.status}".` }, { status: 400 });
      }

      // Generate a one-time offer token
      const token = crypto.randomUUID();

      const { error: updateErr } = await admin
        .from('waitlist')
        .update({
          status:       'offered',
          offer_token:  token,
          notified_at:  new Date().toISOString(),
        })
        .eq('id', waitlistId);
      if (updateErr) throw new Error('Update failed: ' + updateErr.message);

      // Send the offer email
      await sendOfferEmail(admin, entry, token);

      return Response.json({ success: true, token });
    }

    if (action === 'withdraw') {
      if (entry.status !== 'offered') {
        return Response.json({ error: `Cannot withdraw an entry with status "${entry.status}".` }, { status: 400 });
      }

      // Silent revert to waiting — no email per spec
      const { error: updateErr } = await admin
        .from('waitlist')
        .update({
          status:       'waiting',
          offer_token:  null,
          notified_at:  null,
        })
        .eq('id', waitlistId);
      if (updateErr) throw new Error('Update failed: ' + updateErr.message);

      return Response.json({ success: true });
    }

    if (action === 'cancel') {
      if (entry.status === 'accepted') {
        return Response.json({ error: 'Cannot cancel an entry that has already been accepted.' }, { status: 400 });
      }
      if (entry.status === 'cancelled') {
        return Response.json({ error: 'Entry is already cancelled.' }, { status: 400 });
      }

      const { error: updateErr } = await admin
        .from('waitlist')
        .update({
          status:       'cancelled',
          offer_token:  null,
          notified_at:  null,
        })
        .eq('id', waitlistId);
      if (updateErr) throw new Error('Update failed: ' + updateErr.message);

      return Response.json({ success: true });
    }

    // Unreachable
    return Response.json({ error: 'Unknown action' }, { status: 400 });

  } catch (err) {
    console.error('[waitlist-action] error:', err);
    return Response.json({ error: err.message }, { status: 500 });
  }
}

async function sendOfferEmail(admin, entry, token) {
  if (!entry.families?.email) return;

  // Get primary guardian for greeting
  const { data: guardian } = await admin
    .from('contacts')
    .select('first_name, last_name')
    .eq('family_id', entry.family_id)
    .eq('priority', 1)
    .single();

  const guardianName = guardian
    ? `${guardian.first_name} ${guardian.last_name}`
    : 'Family';

  const p = entry.participants;
  const participantName = p?.nickname
    ? `${p.nickname} ${p.last_name}`
    : `${p?.first_name || ''} ${p?.last_name || ''}`;

  const programName = entry.programs?.label || 'Program';

  // Build the registration link with token
  const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://tyt-registration-next.vercel.app';
  const registrationLink = `${baseUrl}/register/${entry.program_id}?waitlist_token=${token}&participant=${entry.participant_id}`;

  // Fetch the email template
  const { data: template } = await admin
    .from('email_templates')
    .select('subject, body_html')
    .eq('key', 'waitlist_offer')
    .single();

  if (!template) {
    console.error('[waitlist-action] waitlist_offer email template not found');
    return;
  }

  const { subject, html } = renderEmail(template, {
    guardian_name:     guardianName,
    participant_name:  participantName,
    program_name:      programName,
    registration_link: registrationLink,
  });

  await resend.emails.send({
    from:    'TYT Family Portal <noreply@triboroyouththeatre.org>',
    to:      entry.families.email,
    bcc:     'admin@triboroyouththeatre.org',
    subject,
    html,
  });
}