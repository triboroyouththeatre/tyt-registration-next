import { Resend } from 'resend';
import { createClient } from '@/lib/supabase/server';

const resend = new Resend(process.env.RESEND_API_KEY);

function fmt(amount) {
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(Number(amount) || 0);
}

function fmtDate(str) {
  if (!str) return '';
  return new Date(str + 'T00:00:00').toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' });
}

export async function POST(request) {
  try {
    const supabase = await createClient();

    const { data: { user }, error: userErr } = await supabase.auth.getUser();
    if (userErr || !user) return Response.json({ error: 'Not authenticated' }, { status: 401 });

    const { registrationIds } = await request.json();
    if (!registrationIds?.length) return Response.json({ error: 'No registration IDs provided' }, { status: 400 });

    // Fetch all registrations with full detail
    const { data: registrations, error: regErr } = await supabase
      .from('registrations')
      .select(`
        id, registration_number, amount_paid, total_fee, is_financial_aid_requested,
        registered_at,
        participants(first_name, last_name, yog),
        award_levels(label),
        health_records(
          academic_flag, behavioral_flag, allergies_flag, epipen,
          asthma, concussion_flag, general_comments
        ),
        carts(
          programs:cart_id(label, balance_due_date, sessions(name, seasons(display_name, name)))
        )
      `)
      .in('id', registrationIds);

    if (regErr || !registrations?.length) {
      return Response.json({ error: 'Could not load registrations' }, { status: 400 });
    }

    // Get family email
    const { data: profile } = await supabase.from('profiles').select('family_id').eq('id', user.id).single();
    const { data: family } = await supabase.from('families').select('email').eq('id', profile.family_id).single();

    // Get grade levels for active season
    const { data: gradeLevels } = await supabase
      .from('grade_levels')
      .select('yog, label')
      .eq('seasons.is_active', true);

    function getGrade(yog) {
      return gradeLevels?.find(g => g.yog === yog)?.label || `Class of ${yog}`;
    }

    // Build email HTML
    const regRows = registrations.map(reg => {
      const p = reg.participants;
      const h = reg.health_records?.[0];
      const balance = (reg.total_fee || 0) - (reg.amount_paid || 0);

      return `
        <div style="border:1px solid #e5e7eb;border-radius:8px;padding:20px;margin-bottom:20px;">
          <h3 style="font-family:Georgia,serif;font-size:18px;color:#111;margin:0 0 4px 0;">
            ${p?.first_name} ${p?.last_name}
          </h3>
          <p style="color:#6b7280;font-size:14px;margin:0 0 16px 0;">${getGrade(p?.yog)}</p>
          
          <table style="width:100%;font-size:14px;border-collapse:collapse;">
            <tr><td style="padding:4px 0;color:#6b7280;width:40%;">Registration #</td><td style="padding:4px 0;color:#111;font-weight:600;">${reg.registration_number}</td></tr>
            <tr><td style="padding:4px 0;color:#6b7280;">Award Level</td><td style="padding:4px 0;color:#111;">${reg.award_levels?.label || 'No Award'}</td></tr>
            <tr><td style="padding:4px 0;color:#6b7280;">Amount Paid</td><td style="padding:4px 0;color:#111;">${fmt(reg.amount_paid)}</td></tr>
            ${balance > 0 ? `<tr><td style="padding:4px 0;color:#6b7280;">Balance Due</td><td style="padding:4px 0;color:#b40000;font-weight:600;">${fmt(balance)} + 5% processing fee</td></tr>` : ''}
            ${balance > 0 && reg.carts?.programs?.balance_due_date ? `<tr><td style="padding:4px 0;color:#6b7280;">Balance Due Date</td><td style="padding:4px 0;color:#111;">${fmtDate(reg.carts.programs.balance_due_date)}</td></tr>` : ''}
            ${reg.is_financial_aid_requested ? `<tr><td colspan="2" style="padding:8px 0;color:#b45309;font-size:13px;">⚠ Financial aid application submitted — TYT will review and adjust your balance.</td></tr>` : ''}
          </table>

          ${h ? `
          <div style="margin-top:16px;padding-top:16px;border-top:1px solid #e5e7eb;">
            <p style="font-size:12px;font-weight:600;text-transform:uppercase;letter-spacing:0.05em;color:#9ca3af;margin:0 0 8px 0;">Health Information</p>
            <p style="font-size:13px;color:#6b7280;margin:0;">
              Academic: ${h.academic_flag ? 'Yes' : 'No'} &nbsp;·&nbsp;
              Behavioral: ${h.behavioral_flag ? 'Yes' : 'No'} &nbsp;·&nbsp;
              Allergies: ${h.allergies_flag ? 'Yes' : 'No'}${h.epipen ? ' (EpiPen)' : ''} &nbsp;·&nbsp;
              Asthma: ${h.asthma ? 'Yes' : 'No'} &nbsp;·&nbsp;
              Concussion: ${h.concussion_flag ? 'Yes' : 'No'}
            </p>
            ${h.general_comments ? `<p style="font-size:13px;color:#6b7280;margin:6px 0 0 0;">Notes: ${h.general_comments}</p>` : ''}
          </div>
          ` : ''}
        </div>
      `;
    }).join('');

    const firstReg = registrations[0];
    const programName = firstReg?.carts?.programs?.label || 'the program';
    const seasonName = firstReg?.carts?.programs?.sessions?.seasons?.display_name || '';

    const html = `
      <!DOCTYPE html>
      <html>
      <head><meta charset="utf-8"></head>
      <body style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto;padding:20px;color:#111;background:#fff;">
        
        <div style="text-align:center;padding:24px 0 32px;">
          <h1 style="font-family:Georgia,serif;font-size:28px;color:#b40000;margin:0 0 8px 0;">
            Thank You for Registering!
          </h1>
          <p style="font-size:16px;color:#6b7280;margin:0;">
            ${programName}${seasonName ? ` · ${seasonName} Season` : ''}
          </p>
        </div>

        <p style="font-size:15px;line-height:1.6;color:#374151;">
          Your registration has been received and your deposit payment has been processed. 
          Please review the details below for your records.
        </p>

        ${regRows}

        <div style="background:#fefce8;border:1px solid #fde68a;border-radius:8px;padding:16px;margin:24px 0;">
          <p style="font-size:14px;color:#92400e;margin:0;line-height:1.6;">
            Additional information about ${programName}, including rehearsal schedules and production materials, 
            will be provided via email as it becomes available. Please refer to the Registration Fee Policy 
            for details about balance due dates and refund policies.
          </p>
        </div>

        <p style="font-size:14px;color:#6b7280;line-height:1.6;">
          If you have any questions, please contact us at 
          <a href="mailto:admin@triboroyouththeatre.org" style="color:#b40000;">admin@triboroyouththeatre.org</a>.
        </p>

        <hr style="border:none;border-top:1px solid #e5e7eb;margin:32px 0 16px;">
        <p style="font-size:12px;color:#9ca3af;text-align:center;margin:0;">
          Triboro Youth Theatre &nbsp;·&nbsp; <a href="https://triboroyouththeatre.org" style="color:#9ca3af;">triboroyouththeatre.org</a>
        </p>
      </body>
      </html>
    `;

    const participantNames = registrations
      .map(r => `${r.participants?.first_name} ${r.participants?.last_name}`)
      .join(', ');

    await resend.emails.send({
      from: 'TYT Family Portal <noreply@triboroyouththeatre.org>',
      to: family.email,
      bcc: 'admin@triboroyouththeatre.org',
      subject: `Registration Confirmed — ${programName} (${participantNames})`,
      html,
    });

    return Response.json({ success: true });

  } catch (err) {
    console.error('[send-confirmation] error:', err);
    return Response.json({ error: err.message }, { status: 500 });
  }
}