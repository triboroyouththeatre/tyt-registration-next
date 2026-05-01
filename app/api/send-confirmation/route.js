import { createClient as createAdminClient } from '@supabase/supabase-js';
import { Resend } from 'resend';
import { renderEmail } from '@/lib/email-render';

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
    const { registrationIds } = await request.json();
    if (!registrationIds?.length) {
      return Response.json({ error: 'No registration IDs provided' }, { status: 400 });
    }

    // Use service role client — this route is called from the post-payment flow
    // and needs to read across tables that may have RLS restrictions for the user.
    const admin = createAdminClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL,
      process.env.SUPABASE_SERVICE_ROLE_KEY
    );

    // Fetch all registrations with full detail
    const { data: registrations, error: regErr } = await admin
      .from('registrations')
      .select(`
        id, registration_number, family_id, participant_id,
        amount_paid, total_fee, is_financial_aid_requested,
        registered_at,
        participants(first_name, last_name, nickname, yog),
        award_levels(label),
        health_records(
          academic_flag, behavioral_flag, allergies_flag, epipen,
          asthma, concussion_flag, general_comments
        ),
        carts(
          program_id,
          programs(label, balance_due_date, sessions(name, seasons(display_name, name)))
        )
      `)
      .in('id', registrationIds);

    if (regErr || !registrations?.length) {
      return Response.json({ error: 'Could not load registrations' }, { status: 400 });
    }

    // All registrations should belong to the same family — pull from first
    const familyId = registrations[0].family_id;

    // Get family email
    const { data: family } = await admin
      .from('families')
      .select('email')
      .eq('id', familyId)
      .single();

    if (!family?.email) {
      return Response.json({ error: 'Family email not found' }, { status: 400 });
    }

    // Get primary guardian name
    const { data: guardian } = await admin
      .from('contacts')
      .select('first_name, last_name')
      .eq('family_id', familyId)
      .eq('priority', 1)
      .single();

    const guardianName = guardian
      ? `${guardian.first_name} ${guardian.last_name}`
      : 'Family';

    // Get grade levels for active season — for displaying participant grade
    const { data: activeSeason } = await admin
      .from('seasons')
      .select('id')
      .eq('is_active', true)
      .single();

    let gradeLevels = [];
    if (activeSeason?.id) {
      const { data: gl } = await admin
        .from('grade_levels')
        .select('yog, label')
        .eq('season_id', activeSeason.id);
      gradeLevels = gl || [];
    }

    function getGrade(yog) {
      return gradeLevels.find(g => g.yog === yog)?.label || (yog ? `Class of ${yog}` : '');
    }

    // Build per-registration HTML cards (Option B — built in route, injected into template)
    const registrationsHtml = registrations.map(reg => {
      const p = reg.participants;
      const h = Array.isArray(reg.health_records) ? reg.health_records[0] : reg.health_records;
      const balance = (parseFloat(reg.total_fee) || 0) - (parseFloat(reg.amount_paid) || 0);
      const showBalance = balance > 0.01;

      const participantName = p?.nickname
        ? `${p.nickname} ${p.last_name}`
        : `${p?.first_name || ''} ${p?.last_name || ''}`;
      const grade = getGrade(p?.yog);
      const programLabel = reg.carts?.programs?.label || '';
      const dueDate = reg.carts?.programs?.balance_due_date;

      // Health flags summary
      const healthFlags = [];
      if (h) {
        if (h.academic_flag) healthFlags.push('Academic');
        if (h.behavioral_flag) healthFlags.push('Behavioral');
        if (h.allergies_flag) healthFlags.push(h.epipen ? 'Allergies (EpiPen)' : 'Allergies');
        if (h.asthma) healthFlags.push('Asthma');
        if (h.concussion_flag) healthFlags.push('Concussion history');
      }
      const healthSummary = healthFlags.length > 0
        ? healthFlags.join(' \u00B7 ')
        : 'No flags noted';

      const balanceRow = showBalance ? `
            <tr>
              <td style="padding:6px 0;color:#6b7280;width:45%;">Balance Due</td>
              <td style="padding:6px 0;color:#b40000;font-weight:600;">${fmt(balance)} + 5% processing fee</td>
            </tr>
            ${dueDate ? `
            <tr>
              <td style="padding:6px 0;color:#6b7280;">Balance Due Date</td>
              <td style="padding:6px 0;color:#111;">${fmtDate(dueDate)}</td>
            </tr>` : ''}
      ` : '';

      const faNote = reg.is_financial_aid_requested ? `
            <tr>
              <td colspan="2" style="padding:10px 0 0;color:#b45309;font-size:13px;">
                \u26A0 Financial aid application submitted \u2014 TYT will review and adjust your balance accordingly.
              </td>
            </tr>` : '';

      return `
        <div style="border:1px solid #e5e7eb;border-radius:8px;padding:20px;margin-bottom:20px;background:#fff;">
          <h3 style="font-family:Georgia,serif;font-size:18px;color:#111;margin:0 0 4px 0;">
            ${participantName}
          </h3>
          ${grade ? `<p style="color:#6b7280;font-size:14px;margin:0 0 16px 0;">${grade}</p>` : ''}
          <p style="font-family:Georgia,serif;font-size:15px;color:#374151;margin:0 0 12px 0;font-style:italic;">
            ${programLabel}
          </p>

          <table style="width:100%;font-size:14px;border-collapse:collapse;">
            <tr>
              <td style="padding:6px 0;color:#6b7280;width:45%;">Registration #</td>
              <td style="padding:6px 0;color:#111;font-weight:600;">${reg.registration_number}</td>
            </tr>
            <tr>
              <td style="padding:6px 0;color:#6b7280;">Award Level</td>
              <td style="padding:6px 0;color:#111;">${reg.award_levels?.label || 'No Award'}</td>
            </tr>
            <tr>
              <td style="padding:6px 0;color:#6b7280;">Amount Paid</td>
              <td style="padding:6px 0;color:#111;">${fmt(reg.amount_paid)}</td>
            </tr>
            ${balanceRow}
            ${faNote}
          </table>

          ${h ? `
          <div style="margin-top:16px;padding-top:16px;border-top:1px solid #e5e7eb;">
            <p style="font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:0.05em;color:#9ca3af;margin:0 0 6px 0;">Health Information</p>
            <p style="font-size:13px;color:#6b7280;margin:0;">${healthSummary}</p>
            ${h.general_comments ? `<p style="font-size:13px;color:#6b7280;margin:6px 0 0 0;font-style:italic;">${h.general_comments}</p>` : ''}
          </div>` : ''}
        </div>
      `;
    }).join('');

    // Pull aggregate values for top-level template variables
    const firstReg = registrations[0];
    const programName = firstReg?.carts?.programs?.label || 'TYT';
    const seasonName = firstReg?.carts?.programs?.sessions?.seasons?.display_name || '';

    // Combined totals across all registrations
    const totalPaid = registrations.reduce((sum, r) => sum + (parseFloat(r.amount_paid) || 0), 0);
    const totalDue  = registrations.reduce((sum, r) => sum + ((parseFloat(r.total_fee) || 0) - (parseFloat(r.amount_paid) || 0)), 0);
    const balanceDueDate = firstReg?.carts?.programs?.balance_due_date;

    // For the subject line — pick first participant if multiple
    const firstParticipant = firstReg?.participants;
    const firstParticipantName = firstParticipant?.nickname
      ? `${firstParticipant.nickname} ${firstParticipant.last_name}`
      : `${firstParticipant?.first_name || ''} ${firstParticipant?.last_name || ''}`;
    const subjectParticipantName = registrations.length > 1
      ? `${firstParticipantName} + ${registrations.length - 1} more`
      : firstParticipantName;

    // Fetch the registration_confirmation template
    const { data: template, error: tplErr } = await admin
      .from('email_templates')
      .select('subject, body_html')
      .eq('key', 'registration_confirmation')
      .single();

    if (tplErr || !template) {
      return Response.json({ error: 'Email template not found' }, { status: 500 });
    }

    // Render the template with all variables
    const vars = {
      guardian_name:       guardianName,
      participant_name:    subjectParticipantName,
      program_name:        programName,
      season_name:         seasonName,
      registration_number: registrations.length === 1 ? firstReg.registration_number : '',
      amount_paid:         fmt(totalPaid),
      balance_due:         totalDue > 0.01 ? fmt(totalDue) : '',
      balance_due_date:    balanceDueDate ? fmtDate(balanceDueDate) : '',
      registrations_html:  registrationsHtml,
    };

    const { subject, html } = renderEmail(template, vars);

    // Wrap in a basic HTML shell for proper email rendering
    const wrappedHtml = `<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="font-family:Arial,Helvetica,sans-serif;max-width:600px;margin:0 auto;padding:20px;color:#111;background:#fff;">
${html}
<hr style="border:none;border-top:1px solid #e5e7eb;margin:32px 0 16px;">
<p style="font-size:12px;color:#9ca3af;text-align:center;margin:0;">
Triboro Youth Theatre \u00B7 <a href="https://triboroyouththeatre.org" style="color:#9ca3af;">triboroyouththeatre.org</a>
</p>
</body>
</html>`;

    await resend.emails.send({
      from:    'TYT Family Portal <noreply@triboroyouththeatre.org>',
      to:      family.email,
      bcc:     'admin@triboroyouththeatre.org',
      subject,
      html:    wrappedHtml,
    });

    return Response.json({ success: true });

  } catch (err) {
    console.error('[send-confirmation] error:', err);
    return Response.json({ error: err.message }, { status: 500 });
  }
}