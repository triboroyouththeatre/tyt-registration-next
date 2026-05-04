import { createClient } from '@supabase/supabase-js';
import { Resend } from 'resend';
import { getFamilyRecipients } from '@/lib/email-recipients';

const resend = new Resend(process.env.RESEND_API_KEY);

const admin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

function fmt(amount) {
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(Number(amount) || 0);
}

function fmtDate(str) {
  if (!str) return '—';
  return new Date(str + 'T00:00:00').toLocaleDateString('en-US', {
    month: 'long', day: 'numeric', year: 'numeric',
  });
}

function daysUntil(dateStr) {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const due = new Date(dateStr + 'T00:00:00');
  return Math.round((due - today) / (1000 * 60 * 60 * 24));
}

export async function GET(request) {
  // Verify request is from Vercel cron
  const authHeader = request.headers.get('authorization');
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return Response.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    // Find all registrations with outstanding balances, not FA, with a due date
    const { data: registrations, error: regErr } = await admin
      .from('registrations')
      .select(`
        id, registration_number, amount_paid, total_fee, family_id,
        participants(first_name, last_name, nickname),
        carts!inner(
          programs:programs!inner(label, balance_due_date,
            sessions!inner(name, seasons!inner(display_name, name))
          )
        )
      `)
      .eq('is_financial_aid_requested', false)
      .gt('total_fee', 0);

    if (regErr) throw new Error('Query failed: ' + regErr.message);

    // Filter to those with a balance and an upcoming due date (1, 7, or 14 days)
    const REMINDER_DAYS = [14, 7, 1];
    const toRemind = [];

    for (const reg of (registrations || [])) {
      const balance = (reg.total_fee || 0) - (reg.amount_paid || 0);
      if (balance <= 0.01) continue;

      const dueDate = reg.carts?.programs?.balance_due_date;
      if (!dueDate) continue;

      const days = daysUntil(dueDate);
      if (!REMINDER_DAYS.includes(days)) continue;

      toRemind.push({ reg, balance, days, dueDate });
    }

    if (toRemind.length === 0) {
      return Response.json({ success: true, sent: 0, message: 'No reminders to send today.' });
    }

    // Group by family_id so one family with multiple registrations
    // gets a single email digest. Then look up the recipient list for
    // each family — primary + secondary contacts.
    const byFamily = {};
    for (const item of toRemind) {
      const fid = item.reg.family_id;
      if (!fid) continue;
      if (!byFamily[fid]) byFamily[fid] = [];
      byFamily[fid].push(item);
    }

    let sent = 0;
    const digestLines = [];

    for (const [familyId, items] of Object.entries(byFamily)) {
      const recipients = await getFamilyRecipients(admin, familyId);
      if (recipients.length === 0) continue;

      const days = items[0].days;
      const urgency = days === 1 ? 'FINAL REMINDER — Due Tomorrow' :
                      days === 7 ? 'Balance Due in 7 Days' :
                                   'Balance Due in 14 Days';

      const regRows = items.map(({ reg, balance, dueDate }) => {
        const p = reg.participants;
        const name = p?.nickname ? `${p.nickname} ${p.last_name}` : `${p?.first_name} ${p?.last_name}`;
        const program = reg.carts?.programs?.label || '—';
        const season = reg.carts?.programs?.sessions?.seasons?.display_name ||
                       reg.carts?.programs?.sessions?.seasons?.name || '';

        return `
          <div style="border:1px solid #e5e7eb;border-radius:8px;padding:16px;margin-bottom:12px;">
            <p style="font-family:Georgia,serif;font-size:16px;font-weight:bold;color:#111;margin:0 0 4px 0;">${name}</p>
            <p style="font-size:13px;color:#6b7280;margin:0 0 12px 0;">${program}${season ? ` · ${season} Season` : ''} · #${reg.registration_number}</p>
            <table style="width:100%;font-size:14px;border-collapse:collapse;">
              <tr>
                <td style="padding:3px 0;color:#6b7280;width:50%;">Balance Due</td>
                <td style="padding:3px 0;color:#b40000;font-weight:700;">${fmt(balance)} + 5% processing fee</td>
              </tr>
              <tr>
                <td style="padding:3px 0;color:#6b7280;">Due Date</td>
                <td style="padding:3px 0;color:#111;">${fmtDate(dueDate)}</td>
              </tr>
            </table>
          </div>
        `;
      }).join('');

      const borderColor = days === 1 ? '#b40000' : days === 7 ? '#d97706' : '#e0bf5c';
      const bannerBg    = days === 1 ? '#fff5f5' : days === 7 ? '#fffbeb' : '#fefce8';

      const html = `
        <!DOCTYPE html>
        <html>
        <head><meta charset="utf-8"></head>
        <body style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto;padding:20px;color:#111;background:#fff;">

          <div style="text-align:center;padding:16px 0 24px;">
            <h1 style="font-family:Georgia,serif;font-size:24px;color:#b40000;margin:0 0 4px 0;">
              Triboro Youth Theatre
            </h1>
            <p style="font-size:14px;color:#6b7280;margin:0;">Registration Balance Reminder</p>
          </div>

          <div style="background:${bannerBg};border:2px solid ${borderColor};border-radius:8px;padding:16px;margin-bottom:24px;text-align:center;">
            <p style="font-size:18px;font-weight:bold;color:${borderColor};margin:0;">${urgency}</p>
          </div>

          <p style="font-size:15px;line-height:1.6;color:#374151;">
            This is a reminder that a balance is due for the following registration${items.length > 1 ? 's' : ''}. 
            Please log in to your family portal to submit payment.
          </p>

          ${regRows}

          <div style="background:#f9fafb;border:1px solid #e5e7eb;border-radius:8px;padding:16px;margin:24px 0;text-align:center;">
            <a href="https://tyt-registration-next.vercel.app/dashboard/payments" 
               style="display:inline-block;background:#b40000;color:#fff;text-decoration:none;padding:12px 32px;border-radius:6px;font-weight:bold;font-size:15px;">
              Pay Now
            </a>
          </div>

          <p style="font-size:13px;color:#6b7280;line-height:1.6;">
            Balances not paid by the due date may result in cancellation of registration. 
            If you have any questions, please contact us at 
            <a href="mailto:admin@triboroyouththeatre.org" style="color:#b40000;">admin@triboroyouththeatre.org</a>.
          </p>

          <hr style="border:none;border-top:1px solid #e5e7eb;margin:24px 0 16px;">
          <p style="font-size:12px;color:#9ca3af;text-align:center;margin:0;">
            Triboro Youth Theatre · <a href="https://triboroyouththeatre.org" style="color:#9ca3af;">triboroyouththeatre.org</a>
          </p>
        </body>
        </html>
      `;

      await resend.emails.send({
        from: 'TYT Family Portal <noreply@triboroyouththeatre.org>',
        to: recipients,
        subject: `${urgency} — TYT Registration Balance`,
        html,
      });

      sent++;
      digestLines.push(`${recipients.join(', ')} — ${items.map(i => `${i.reg.registration_number} (${fmt(i.balance)} due ${fmtDate(i.dueDate)}, ${i.days}d)`).join(', ')}`);
    }

    // Send daily digest to admin
    const digestHtml = `
      <!DOCTYPE html>
      <html>
      <head><meta charset="utf-8"></head>
      <body style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto;padding:20px;color:#111;">
        <h2 style="font-family:Georgia,serif;color:#b40000;">Balance Reminder Digest</h2>
        <p style="color:#6b7280;font-size:14px;">
          ${new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' })}
        </p>
        <p><strong>${sent}</strong> reminder email${sent !== 1 ? 's' : ''} sent today.</p>
        ${digestLines.length > 0 ? `
          <table style="width:100%;border-collapse:collapse;font-size:13px;margin-top:16px;">
            <tr style="background:#f3f4f6;">
              <th style="padding:8px;text-align:left;border:1px solid #e5e7eb;">Family Email</th>
              <th style="padding:8px;text-align:left;border:1px solid #e5e7eb;">Details</th>
            </tr>
            ${digestLines.map(line => {
              const [email, details] = line.split(' — ');
              return `
                <tr>
                  <td style="padding:8px;border:1px solid #e5e7eb;">${email}</td>
                  <td style="padding:8px;border:1px solid #e5e7eb;">${details}</td>
                </tr>
              `;
            }).join('')}
          </table>
        ` : '<p style="color:#6b7280;">No reminders were sent today.</p>'}
      </body>
      </html>
    `;

    await resend.emails.send({
      from: 'TYT Family Portal <noreply@triboroyouththeatre.org>',
      to: 'admin@triboroyouththeatre.org',
      subject: `Balance Reminder Digest — ${sent} sent — ${new Date().toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}`,
      html: digestHtml,
    });

    return Response.json({ success: true, sent, reminders: digestLines });

  } catch (err) {
    console.error('[balance-reminders] error:', err.message);
    return Response.json({ error: err.message }, { status: 500 });
  }
}