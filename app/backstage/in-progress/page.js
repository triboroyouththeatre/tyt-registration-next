import { createClient } from '@/lib/supabase/server';
import { redirect } from 'next/navigation';
import Link from 'next/link';

const STEP_LABELS = {
  1: 'Health',
  2: 'Agreements',
  3: 'Review',
  4: 'Payment',
};

function fmtDateTime(str) {
  if (!str) return '—';
  const d = new Date(str);
  return d.toLocaleDateString('en-US', {
    month: 'short', day: 'numeric', year: 'numeric',
    hour: 'numeric', minute: '2-digit',
  });
}

function relativeTime(str) {
  if (!str) return '';
  const ms = Date.now() - new Date(str).getTime();
  const minutes = Math.floor(ms / 60000);
  if (minutes < 1)    return 'just now';
  if (minutes < 60)   return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24)     return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}

export default async function InProgressRegistrations() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  const { data: profile } = await supabase
    .from('profiles').select('role').eq('id', user.id).single();
  if (profile?.role !== 'admin') redirect('/dashboard');

  // RLS allows admins to read all drafts. Pull with the related metadata
  // we need to display — family contact, participant, program.
  const { data: drafts } = await supabase
    .from('registration_drafts')
    .select(`
      id, current_step, updated_at, created_at,
      family_id, program_id, participant_id,
      participants(first_name, last_name),
      programs(label, sessions(name, seasons(display_name, name))),
      families(
        contacts(priority, first_name, last_name, email, phone)
      )
    `)
    .order('updated_at', { ascending: false });

  const rows = (drafts || []).map(d => {
    // Pick the primary contact (priority 1) if available
    const contacts = d.families?.contacts || [];
    const primary = contacts.find(c => c.priority === 1) || contacts[0] || null;
    const seasonDisplay = d.programs?.sessions?.seasons?.display_name
                       || d.programs?.sessions?.seasons?.name
                       || '';
    return {
      id: d.id,
      participantName: d.participants
        ? `${d.participants.first_name} ${d.participants.last_name}`
        : 'Unknown',
      programLabel: d.programs?.label || 'Unknown program',
      seasonDisplay,
      currentStep: d.current_step,
      stepLabel: STEP_LABELS[d.current_step] || `Step ${d.current_step}`,
      updatedAt: d.updated_at,
      createdAt: d.created_at,
      contactName: primary
        ? `${primary.first_name} ${primary.last_name}`
        : '—',
      contactEmail: primary?.email || '',
      contactPhone: primary?.phone || '',
    };
  });

  const tableStyle = {
    width: '100%', background: '#fff', borderRadius: '8px',
    overflow: 'hidden', boxShadow: '0 1px 3px rgba(0,0,0,0.06)',
    borderCollapse: 'collapse',
  };
  const thStyle = {
    fontFamily: 'var(--font-display)', fontSize: '0.7rem', fontWeight: 700,
    letterSpacing: '0.08em', textTransform: 'uppercase', color: '#6b7280',
    textAlign: 'left', padding: '0.75rem 1rem',
    borderBottom: '1px solid #e5e7eb', background: '#f9fafb',
  };
  const tdStyle = {
    fontFamily: 'var(--font-body)', fontSize: '0.875rem', color: '#111',
    padding: '0.875rem 1rem', borderBottom: '1px solid #f3f4f6',
    verticalAlign: 'top',
  };

  return (
    <div>
      <div style={{ marginBottom: '1.5rem' }}>
        <h1 style={{
          fontFamily: 'var(--font-display)', fontSize: '1.6rem', fontWeight: 800,
          letterSpacing: '0.04em', textTransform: 'uppercase', color: '#111',
          marginBottom: '0.25rem',
        }}>
          In-Progress Registrations
        </h1>
        <p style={{ fontFamily: 'var(--font-body)', fontSize: '0.875rem', color: '#6b7280' }}>
          Families who started registering but haven&rsquo;t completed payment.
          Drafts are auto-deleted after 30 days of inactivity.
        </p>
      </div>

      {rows.length === 0 ? (
        <div style={{
          background: '#fff', borderRadius: '8px', padding: '3rem',
          textAlign: 'center', boxShadow: '0 1px 3px rgba(0,0,0,0.06)',
        }}>
          <p style={{
            fontFamily: 'var(--font-display)', fontSize: '1rem', fontWeight: 700,
            letterSpacing: '0.05em', textTransform: 'uppercase', color: '#6b7280',
          }}>
            No registrations in progress.
          </p>
        </div>
      ) : (
        <table style={tableStyle}>
          <thead>
            <tr>
              <th style={thStyle}>Participant</th>
              <th style={thStyle}>Program</th>
              <th style={thStyle}>Stuck on</th>
              <th style={thStyle}>Last activity</th>
              <th style={thStyle}>Primary Contact</th>
            </tr>
          </thead>
          <tbody>
            {rows.map(r => (
              <tr key={r.id}>
                <td style={tdStyle}>
                  <div style={{ fontWeight: 600 }}>{r.participantName}</div>
                </td>
                <td style={tdStyle}>
                  <div>{r.programLabel}</div>
                  {r.seasonDisplay && (
                    <div style={{ fontSize: '0.75rem', color: '#6b7280' }}>
                      {r.seasonDisplay}
                    </div>
                  )}
                </td>
                <td style={tdStyle}>
                  <span style={{
                    display: 'inline-block',
                    padding: '0.15rem 0.6rem', borderRadius: '3px',
                    background: r.currentStep === 4 ? '#fef3c7' : '#dbeafe',
                    color:      r.currentStep === 4 ? '#92400e' : '#1e40af',
                    fontFamily: 'var(--font-display)',
                    fontSize: '0.7rem', fontWeight: 700,
                    letterSpacing: '0.06em', textTransform: 'uppercase',
                  }}>
                    {r.stepLabel}
                  </span>
                </td>
                <td style={tdStyle}>
                  <div>{relativeTime(r.updatedAt)}</div>
                  <div style={{ fontSize: '0.75rem', color: '#6b7280' }}>
                    {fmtDateTime(r.updatedAt)}
                  </div>
                </td>
                <td style={tdStyle}>
                  <div>{r.contactName}</div>
                  {r.contactEmail && (
                    <div style={{ fontSize: '0.8rem' }}>
                      <a href={`mailto:${r.contactEmail}`} style={{ color: '#b40000' }}>
                        {r.contactEmail}
                      </a>
                    </div>
                  )}
                  {r.contactPhone && (
                    <div style={{ fontSize: '0.8rem', color: '#6b7280' }}>
                      {r.contactPhone}
                    </div>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}