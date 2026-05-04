import { createClient } from '@/lib/supabase/server';
import { createClient as createAdminClient } from '@supabase/supabase-js';
import { Resend } from 'resend';
import { getFamilyRecipients } from '@/lib/email-recipients';
import { randomUUID } from 'crypto';

const resend = new Resend(process.env.RESEND_API_KEY);

export async function POST(request) {
  try {
    // Admin-only route
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return Response.json({ error: 'Not authenticated' }, { status: 401 });

    const { data: profile } = await supabase
      .from('profiles').select('role').eq('id', user.id).single();
    if (profile?.role !== 'admin') {
      return Response.json({ error: 'Not authorized' }, { status: 403 });
    }

    const admin = createAdminClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL,
      process.env.SUPABASE_SERVICE_ROLE_KEY
    );

    const { waitlistId, action } = await request.json();
    if (!waitlistId || !action) {
      return Response.json({ error: 'Missing waitlistId or action' }, { status: 400 });
    }

    const { data: entry } = await admin
      .from('waitlist')
      .select(`
        id, status, family_id, participant_id, program_id,
        participants(first_name, last_name, nickname),
        programs(label, sessions(seasons(display_name, name)))
      `)
      .eq('id', waitlistId)
      .single();

    if (!entry) return Response.json({ error: 'Waitlist entry not found' }, { status: 404 });

    // ── offer ─────────────────────────────────────────────────────────────────
    if (action === 'offer') {
      if (entry.status !== 'waiting') {
        return Response.json({ error: 'Can only offer a spot to a "waiting" entry' }, { status: 400 });
      }

      const token = randomUUID();
      const offerLink = `${process.env.NEXT_PUBLIC_APP_URL}/register/${entry.program_id}?participant=${entry.participant_id}&waitlist_token=${token}`;

      await admin.from('waitlist').update({
        status:      'offered',
        offer_token: token,
        notified_at: new Date().toISOString(),
      }).eq('id', waitlistId);

      const recipients = await getFamilyRecipients(admin, entry.family_id);
      const { data: guardian } = await admin
        .from('contacts').select('first_name, last_name')
        .eq('family_id', entry.family_id).eq('priority', 1).single();

      const p = entry.participants;
      const participantName = p?.nickname
        ? `${p.nickname} ${p.last_name}`
        : `${p?.first_name} ${p?.last_name}`;
      const guardianName  = guardian ? `${guardian.first_name} ${guardian.last_name}` : 'Family';
      const programName   = entry.programs?.label || 'Program';
      const seasonName    = entry.programs?.sessions?.seasons?.display_name
                         || entry.programs?.sessions?.seasons?.name || '';

      if (recipients.length > 0) {
        await resend.emails.send({
          from:    'TYT Family Portal <noreply@triboroyouththeatre.org>',
          to:      recipients,
          bcc:     'admin@triboroyouththeatre.org',
          subject: `A spot is available — ${programName}${seasonName ? ` · ${seasonName}` : ''}`,
          html: `<!DOCTYPE html>
<html>
<head><meta charset="utf-8"></head>
<body style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto;padding:20px;color:#111;background:#fff;">
  <div style="text-align:center;padding:16px 0 24px;">
    <h1 style="font-family:Georgia,serif;font-size:24px;color:#b40000;margin:0 0 4px 0;">Triboro Youth Theatre</h1>
    <p style="font-size:14px;color:#6b7280;margin:0;">Waitlist Offer</p>
  </div>
  <div style="background:#fefce8;border:2px solid #e0bf5c;border-radius:8px;padding:16px;margin-bottom:24px;text-align:center;">
    <p style="font-size:18px;font-weight:bold;color:#92400e;margin:0;">A spot is available for ${participantName}!</p>
  </div>
  <p style="font-size:15px;line-height:1.6;color:#374151;">
    Dear ${guardianName},<br><br>
    A spot has opened up in <strong>${programName}</strong>${seasonName ? ` (${seasonName} Season)` : ''}.
    You are invited to complete registration for <strong>${participantName}</strong>.
  </p>
  <p style="font-size:14px;color:#6b7280;line-height:1.6;">
    This offer is time-sensitive — please register as soon as possible. If the spot is not claimed,
    it may be offered to the next family on the waitlist.
  </p>
  <div style="background:#f9fafb;border:1px solid #e5e7eb;border-radius:8px;padding:16px;margin:24px 0;text-align:center;">
    <a href="${offerLink}"
       style="display:inline-block;background:#b40000;color:#fff;text-decoration:none;padding:12px 32px;border-radius:6px;font-weight:bold;font-size:15px;">
      Register Now
    </a>
  </div>
  <p style="font-size:13px;color:#6b7280;line-height:1.6;">
    Questions? Contact us at
    <a href="mailto:admin@triboroyouththeatre.org" style="color:#b40000;">admin@triboroyouththeatre.org</a>.
  </p>
  <hr style="border:none;border-top:1px solid #e5e7eb;margin:24px 0 16px;">
  <p style="font-size:12px;color:#9ca3af;text-align:center;margin:0;">
    Triboro Youth Theatre &middot;
    <a href="https://triboroyouththeatre.org" style="color:#9ca3af;">triboroyouththeatre.org</a>
  </p>
</body>
</html>`,
        });
      }

      return Response.json({ success: true });
    }

    // ── withdraw ──────────────────────────────────────────────────────────────
    if (action === 'withdraw') {
      if (entry.status !== 'offered') {
        return Response.json({ error: 'Can only withdraw an active offer' }, { status: 400 });
      }
      await admin.from('waitlist').update({
        status:      'waiting',
        offer_token: null,
        notified_at: null,
      }).eq('id', waitlistId);
      return Response.json({ success: true });
    }

    // ── cancel ────────────────────────────────────────────────────────────────
    if (action === 'cancel') {
      await admin.from('waitlist').update({
        status:      'cancelled',
        offer_token: null,
      }).eq('id', waitlistId);
      return Response.json({ success: true });
    }

    return Response.json({ error: 'Unknown action' }, { status: 400 });

  } catch (err) {
    console.error('[waitlist-action] error:', err.message);
    return Response.json({ error: err.message }, { status: 500 });
  }
}
