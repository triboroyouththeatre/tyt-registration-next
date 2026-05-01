import { createClient } from '@/lib/supabase/server';
import { redirect } from 'next/navigation';
import Link from 'next/link';
import WaitlistManager from '@/components/backstage/WaitlistManager';

function fmt(amount) {
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(Number(amount) || 0);
}

function fmtDate(str) {
  if (!str) return '—';
  return new Date(str + 'T00:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

function fmtDateTime(str) {
  if (!str) return '—';
  return new Date(str).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric', hour: 'numeric', minute: '2-digit' });
}

function StatusBadge({ label, color = '#6b7280', bg = '#f9fafb' }) {
  return (
    <span style={{
      fontFamily: 'var(--font-display)', fontSize: '0.65rem', fontWeight: 600,
      letterSpacing: '0.06em', textTransform: 'uppercase',
      color, background: bg,
      border: `1px solid ${color}30`,
      borderRadius: '3px', padding: '0.2rem 0.5rem',
      whiteSpace: 'nowrap',
    }}>
      {label}
    </span>
  );
}

function RegStatusBadge({ label }) {
  const colors = {
    'Active':    { color: '#16a34a', bg: '#f0fdf4' },
    'Pending':   { color: '#d97706', bg: '#fffbeb' },
    'Cancelled': { color: '#b40000', bg: '#fff5f5' },
    'Withdrawn': { color: '#6b7280', bg: '#f9fafb' },
  };
  const c = colors[label] || { color: '#6b7280', bg: '#f9fafb' };
  return <StatusBadge label={label || '—'} color={c.color} bg={c.bg} />;
}

const sectionStyle = {
  background: '#fff',
  border: '1px solid #e5e7eb',
  borderRadius: '8px',
  marginBottom: '1.25rem',
  overflow: 'hidden',
};

const sectionHeaderStyle = {
  padding: '0.875rem 1.25rem',
  borderBottom: '1px solid #e5e7eb',
  background: '#fafafa',
  display: 'flex',
  justifyContent: 'space-between',
  alignItems: 'center',
};

const sectionTitleStyle = {
  fontFamily: 'var(--font-display)',
  fontSize: '0.75rem',
  fontWeight: 700,
  letterSpacing: '0.1em',
  textTransform: 'uppercase',
  color: '#111',
  margin: 0,
};

const thStyle = {
  padding: '0.625rem 1rem',
  fontFamily: 'var(--font-display)',
  fontSize: '0.65rem',
  fontWeight: 600,
  letterSpacing: '0.1em',
  textTransform: 'uppercase',
  color: '#6b7280',
  background: '#f9fafb',
  borderBottom: '1px solid #e5e7eb',
  textAlign: 'left',
  whiteSpace: 'nowrap',
};

const tdStyle = {
  padding: '0.75rem 1rem',
  fontFamily: 'var(--font-body)',
  fontSize: '0.85rem',
  color: '#374151',
};

export default async function ProgramDetailPage({ params }) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/login');
  const { data: profile } = await supabase.from('profiles').select('role').eq('id', user.id).single();
  if (profile?.role !== 'admin') redirect('/dashboard');

  const { id } = await params;

  // Fetch program with session/season
  const { data: program } = await supabase
    .from('programs')
    .select(`
      id, label, key, fee, deposit_amount, balance_due_date,
      enrollment_limit, yog_min, yog_max, schedule, description,
      is_active, is_registration_open,
      registration_opens_at, registration_closes_at,
      sessions(id, name, seasons(id, name, display_name, is_active)),
      program_types(label)
    `)
    .eq('id', id)
    .single();

  if (!program) redirect('/backstage/programs');

  // Fetch registrations for this program (joined via cart)
  const { data: registrations } = await supabase
    .from('registrations')
    .select(`
      id, registration_number, registered_at,
      amount_paid, total_fee,
      participants(id, first_name, last_name, nickname, yog),
      registration_statuses(label),
      carts!inner(program_id)
    `)
    .eq('carts.program_id', id)
    .order('registered_at', { ascending: false });

  // Fetch all waitlist entries for this program (waiting + offered + cancelled)
  const { data: waitlistEntries } = await supabase
    .from('waitlist')
    .select(`
      id, status, offer_token, notified_at, created_at,
      family_id,
      participants(id, first_name, last_name, nickname, yog),
      families(email)
    `)
    .eq('program_id', id)
    .order('created_at', { ascending: true });

  // Compute enrollment stats
  const activeRegs = (registrations || []).filter(r => r.registration_statuses?.label !== 'Cancelled');
  const cancelledRegs = (registrations || []).filter(r => r.registration_statuses?.label === 'Cancelled');

  const enrolled = activeRegs.length;
  const limit = program.enrollment_limit || 0;
  const isFull = limit > 0 && enrolled >= limit;
  const pct = limit > 0 ? Math.round((enrolled / limit) * 100) : 0;

  const totalRevenue = activeRegs.reduce((sum, r) => sum + (parseFloat(r.amount_paid) || 0), 0);
  const totalOutstanding = activeRegs.reduce((sum, r) => sum + Math.max(0, (parseFloat(r.total_fee) || 0) - (parseFloat(r.amount_paid) || 0)), 0);

  const waiting = (waitlistEntries || []).filter(w => w.status === 'waiting');
  const offered = (waitlistEntries || []).filter(w => w.status === 'offered');

  // Status badge for header
  const now = new Date();
  const opensAt = program.registration_opens_at ? new Date(program.registration_opens_at) : null;
  let statusLabel, statusColor, statusBg;
  if (isFull) {
    statusLabel = 'Full — Waitlist'; statusColor = '#7c3aed'; statusBg = '#f5f3ff';
  } else if (program.is_registration_open) {
    statusLabel = 'Registration Open'; statusColor = '#16a34a'; statusBg = '#f0fdf4';
  } else if (opensAt && opensAt > now) {
    statusLabel = `Opens ${fmtDateTime(program.registration_opens_at)}`; statusColor = '#d97706'; statusBg = '#fffbeb';
  } else {
    statusLabel = 'Closed'; statusColor = '#b40000'; statusBg = '#fff5f5';
  }

  const seasonDisplay = program.sessions?.seasons?.display_name || program.sessions?.seasons?.name;

  return (
    <div>
      {/* Breadcrumb */}
      <div style={{ marginBottom: '0.75rem' }}>
        <Link href="/backstage/programs" style={{ fontFamily: 'var(--font-display)', fontSize: '0.7rem', fontWeight: 600, letterSpacing: '0.08em', textTransform: 'uppercase', color: '#6b7280', textDecoration: 'none' }}>
          ← Programs
        </Link>
      </div>

      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '1rem', flexWrap: 'wrap', marginBottom: '1.25rem' }}>
        <div>
          <h1 style={{ fontFamily: 'var(--font-display)', fontSize: '1.75rem', fontWeight: 800, letterSpacing: '0.04em', textTransform: 'uppercase', color: '#111', margin: 0, marginBottom: '0.25rem' }}>
            {program.label}
          </h1>
          <p style={{ fontFamily: 'var(--font-body)', fontSize: '0.875rem', color: '#6b7280', margin: 0 }}>
            {seasonDisplay} Season · {program.sessions?.name} Session
            {program.program_types?.label ? ` · ${program.program_types.label}` : ''}
          </p>
        </div>
        <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
          <StatusBadge label={statusLabel} color={statusColor} bg={statusBg} />
          <Link href={`/backstage/programs/${program.id}/edit`} style={{
            fontFamily: 'var(--font-display)', fontSize: '0.7rem', fontWeight: 700,
            letterSpacing: '0.08em', textTransform: 'uppercase',
            color: '#374151', textDecoration: 'none',
            border: '1px solid #d1d5db', borderRadius: '6px',
            padding: '0.4rem 1rem', background: '#fff',
          }}>
            Edit Settings
          </Link>
        </div>
      </div>

      {/* Stats row */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '0.75rem', marginBottom: '1.25rem' }}>
        <StatCard
          label="Enrollment"
          primary={`${enrolled} / ${limit || '—'}`}
          secondary={limit > 0 ? `${pct}% full` : null}
          accent={isFull ? '#b40000' : pct >= 80 ? '#d97706' : '#16a34a'}
        />
        <StatCard
          label="Waitlist"
          primary={`${waiting.length}`}
          secondary={offered.length > 0 ? `${offered.length} offered` : 'waiting'}
          accent="#7c3aed"
        />
        <StatCard
          label="Revenue"
          primary={fmt(totalRevenue)}
          secondary={`from ${activeRegs.length} reg${activeRegs.length !== 1 ? 's' : ''}`}
          accent="#16a34a"
        />
        <StatCard
          label="Outstanding"
          primary={fmt(totalOutstanding)}
          secondary={totalOutstanding > 0 ? `due ${fmtDate(program.balance_due_date)}` : 'all paid'}
          accent={totalOutstanding > 0 ? '#d97706' : '#16a34a'}
        />
      </div>

      {/* Registrations section */}
      <div style={sectionStyle}>
        <div style={sectionHeaderStyle}>
          <h2 style={sectionTitleStyle}>Registrations · {activeRegs.length}</h2>
        </div>
        {activeRegs.length === 0 ? (
          <p style={{ padding: '2rem', textAlign: 'center', fontFamily: 'var(--font-body)', color: '#9ca3af', fontStyle: 'italic', margin: 0 }}>
            No active registrations yet.
          </p>
        ) : (
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr>
                <th style={thStyle}>Participant</th>
                <th style={thStyle}>Reg #</th>
                <th style={thStyle}>Status</th>
                <th style={thStyle}>Paid</th>
                <th style={thStyle}>Balance</th>
                <th style={thStyle}>Registered</th>
                <th style={thStyle}></th>
              </tr>
            </thead>
            <tbody>
              {activeRegs.map((r, i) => {
                const balance = (parseFloat(r.total_fee) || 0) - (parseFloat(r.amount_paid) || 0);
                const p = r.participants;
                const pName = p?.nickname ? `${p.nickname} ${p.last_name}` : `${p?.first_name || ''} ${p?.last_name || ''}`;
                return (
                  <tr key={r.id} style={{ background: i % 2 === 0 ? '#fff' : '#fafafa', borderBottom: '1px solid #f3f4f6' }}>
                    <td style={tdStyle}>
                      <p style={{ margin: 0, fontWeight: 600, color: '#111' }}>{pName}</p>
                      {p?.yog && <p style={{ margin: 0, fontSize: '0.75rem', color: '#9ca3af' }}>Class of {p.yog}</p>}
                    </td>
                    <td style={tdStyle}>{r.registration_number}</td>
                    <td style={tdStyle}><RegStatusBadge label={r.registration_statuses?.label} /></td>
                    <td style={tdStyle}>{fmt(r.amount_paid)}</td>
                    <td style={{ ...tdStyle, color: balance > 0 ? '#b40000' : '#16a34a', fontWeight: balance > 0 ? 600 : 400 }}>
                      {balance > 0 ? fmt(balance) : 'Paid'}
                    </td>
                    <td style={tdStyle}>{fmtDate(r.registered_at)}</td>
                    <td style={tdStyle}>
                      <Link href={`/backstage/registrations/${r.id}`} style={{
                        fontFamily: 'var(--font-display)', fontSize: '0.65rem', fontWeight: 600,
                        letterSpacing: '0.08em', textTransform: 'uppercase',
                        color: '#374151', textDecoration: 'none',
                        border: '1px solid #e5e7eb', borderRadius: '4px',
                        padding: '0.3rem 0.6rem',
                      }}>
                        View
                      </Link>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>

      {/* Waitlist section — interactive */}
      <WaitlistManager programId={program.id} entries={waitlistEntries || []} />

      {/* Cancelled registrations (collapsed-look section) */}
      {cancelledRegs.length > 0 && (
        <details style={{ ...sectionStyle, padding: 0 }}>
          <summary style={{ ...sectionHeaderStyle, cursor: 'pointer', listStyle: 'none' }}>
            <h2 style={sectionTitleStyle}>Cancelled Registrations · {cancelledRegs.length}</h2>
            <span style={{ fontFamily: 'var(--font-body)', fontSize: '0.75rem', color: '#9ca3af' }}>Click to expand</span>
          </summary>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr>
                <th style={thStyle}>Participant</th>
                <th style={thStyle}>Reg #</th>
                <th style={thStyle}>Registered</th>
                <th style={thStyle}></th>
              </tr>
            </thead>
            <tbody>
              {cancelledRegs.map((r, i) => {
                const p = r.participants;
                const pName = p?.nickname ? `${p.nickname} ${p.last_name}` : `${p?.first_name || ''} ${p?.last_name || ''}`;
                return (
                  <tr key={r.id} style={{ background: i % 2 === 0 ? '#fff' : '#fafafa', borderBottom: '1px solid #f3f4f6', opacity: 0.7 }}>
                    <td style={tdStyle}>
                      <p style={{ margin: 0, color: '#111' }}>{pName}</p>
                    </td>
                    <td style={tdStyle}>{r.registration_number}</td>
                    <td style={tdStyle}>{fmtDate(r.registered_at)}</td>
                    <td style={tdStyle}>
                      <Link href={`/backstage/registrations/${r.id}`} style={{
                        fontFamily: 'var(--font-display)', fontSize: '0.65rem', fontWeight: 600,
                        letterSpacing: '0.08em', textTransform: 'uppercase',
                        color: '#374151', textDecoration: 'none',
                        border: '1px solid #e5e7eb', borderRadius: '4px',
                        padding: '0.3rem 0.6rem',
                      }}>
                        View
                      </Link>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </details>
      )}
    </div>
  );
}

function StatCard({ label, primary, secondary, accent }) {
  return (
    <div style={{
      background: '#fff', border: '1px solid #e5e7eb', borderRadius: '8px',
      padding: '0.875rem 1.125rem',
    }}>
      <p style={{ fontFamily: 'var(--font-display)', fontSize: '0.6rem', fontWeight: 600, letterSpacing: '0.1em', textTransform: 'uppercase', color: '#9ca3af', margin: 0, marginBottom: '0.25rem' }}>
        {label}
      </p>
      <p style={{ fontFamily: 'var(--font-display)', fontSize: '1.4rem', fontWeight: 800, color: accent || '#111', margin: 0, lineHeight: 1.1 }}>
        {primary}
      </p>
      {secondary && (
        <p style={{ fontFamily: 'var(--font-body)', fontSize: '0.7rem', color: '#9ca3af', margin: 0, marginTop: '0.15rem' }}>
          {secondary}
        </p>
      )}
    </div>
  );
}