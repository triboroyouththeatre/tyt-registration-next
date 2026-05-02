import { createClient } from '@/lib/supabase/server';
import { redirect } from 'next/navigation';
import Link from 'next/link';

function fmtDate(str) {
  if (!str) return '—';
  return new Date(str + 'T00:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

function fmtDateTime(str) {
  if (!str) return '—';
  return new Date(str).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric', hour: 'numeric', minute: '2-digit' });
}

function StatusBadge({ label, color, bg }) {
  return (
    <span style={{ fontFamily: 'var(--font-display)', fontSize: '0.65rem', fontWeight: 600, letterSpacing: '0.06em', textTransform: 'uppercase', color, background: bg, border: `1px solid ${color}30`, borderRadius: '3px', padding: '0.2rem 0.5rem', whiteSpace: 'nowrap' }}>
      {label}
    </span>
  );
}

export default async function ProgramsPage({ searchParams }) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/login');
  const { data: profile } = await supabase.from('profiles').select('role').eq('id', user.id).single();
  if (profile?.role !== 'admin') redirect('/dashboard');

  const sp = await searchParams;
  const filterSeason  = sp?.season  || '';
  const filterSession = sp?.session || '';
  const filterStatus  = sp?.status  || '';

  // Fetch all data
  const [{ data: seasons }, { data: sessions }, { data: programs }, { data: registrations }, { data: carts }] = await Promise.all([
    supabase.from('seasons').select('id, name, display_name, is_active').order('name', { ascending: false }),
    supabase.from('sessions').select('id, name, season_id, is_active').order('name'),
    supabase.from('programs').select('id, label, key, enrollment_limit, fee, deposit_amount, balance_due_date, is_registration_open, is_active, registration_opens_at, registration_closes_at, session_id, yog_min, yog_max, costume_fee, other_fee').order('label'),
    supabase.from('registrations').select('id, cart_id, status_id'),
    supabase.from('carts').select('id, program_id'),
  ]);

  // Build enrollment map
  const cartProgramMap = {};
  (carts || []).forEach(c => { if (c.id && c.program_id) cartProgramMap[c.id] = c.program_id; });
  const ACTIVE_STATUS = 'd3ae5075-819c-41e2-a685-bbfaea5171b1';
  const enrollmentByProgram = {};
  (registrations || []).forEach(r => {
    if (r.status_id === ACTIVE_STATUS && r.cart_id) {
      const progId = cartProgramMap[r.cart_id];
      if (progId) enrollmentByProgram[progId] = (enrollmentByProgram[progId] || 0) + 1;
    }
  });

  // Enrich programs with session/season
  const enriched = (programs || []).map(p => {
    const session = sessions?.find(s => s.id === p.session_id);
    const season  = seasons?.find(s => s.id === session?.season_id);
    const enrolled = enrollmentByProgram[p.id] || 0;
    const isFull   = p.enrollment_limit > 0 && enrolled >= p.enrollment_limit;
    const now      = new Date();
    const opensAt  = p.registration_opens_at ? new Date(p.registration_opens_at) : null;
    const closesAt = p.registration_closes_at ? new Date(p.registration_closes_at) : null;

    let statusLabel, statusColor, statusBg;
    if (isFull) {
      statusLabel = 'Full — Waitlist'; statusColor = '#7c3aed'; statusBg = '#f5f3ff';
    } else if (p.is_registration_open) {
      statusLabel = 'Open'; statusColor = '#16a34a'; statusBg = '#f0fdf4';
    } else if (opensAt && opensAt > now) {
      statusLabel = `Opens ${fmtDateTime(p.registration_opens_at)}`; statusColor = '#d97706'; statusBg = '#fffbeb';
    } else {
      statusLabel = 'Closed'; statusColor = '#b40000'; statusBg = '#fff5f5';
    }

    return { ...p, session, season, enrolled, isFull, statusLabel, statusColor, statusBg };
  });

  // Apply filters
  let filtered = enriched.filter(p => {
    if (filterSeason  && p.season?.id  !== filterSeason)  return false;
    if (filterSession && p.session?.id !== filterSession) return false;
    if (filterStatus === 'open'   && !p.is_registration_open) return false;
    if (filterStatus === 'closed' &&  p.is_registration_open) return false;
    if (filterStatus === 'full'   && !p.isFull)               return false;
    return true;
  });

  function buildUrl(overrides) {
    const params = new URLSearchParams({
      ...(filterSeason  && { season:  filterSeason }),
      ...(filterSession && { session: filterSession }),
      ...(filterStatus  && { status:  filterStatus }),
      ...overrides,
    });
    const str = params.toString();
    return `/backstage/programs${str ? '?' + str : ''}`;
  }

  const selectStyle = { fontFamily: 'var(--font-body)', fontSize: '0.8rem', color: '#374151', border: '1px solid #d1d5db', borderRadius: '6px', padding: '0.4rem 0.75rem', background: '#fff', cursor: 'pointer' };
  const thStyle     = { padding: '0.625rem 1rem', fontFamily: 'var(--font-display)', fontSize: '0.65rem', fontWeight: 600, letterSpacing: '0.1em', textTransform: 'uppercase', color: '#6b7280', background: '#f9fafb', borderBottom: '1px solid #e5e7eb', textAlign: 'left', whiteSpace: 'nowrap' };

  return (
    <div>
      <div style={{ marginBottom: '1.25rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <h1 style={{ fontFamily: 'var(--font-display)', fontSize: '1.5rem', fontWeight: 800, letterSpacing: '0.05em', textTransform: 'uppercase', color: '#111', margin: 0 }}>Programs</h1>
        <Link href="/backstage/programs/new" style={{ fontFamily: 'var(--font-display)', fontSize: '0.7rem', fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase', background: '#b40000', color: '#fff', textDecoration: 'none', borderRadius: '6px', padding: '0.5rem 1.25rem' }}>
          + New Program
        </Link>
      </div>

      {/* Filters */}
      <div style={{ background: '#fff', border: '1px solid #e5e7eb', borderRadius: '8px', padding: '0.875rem 1.25rem', marginBottom: '1rem', display: 'flex', gap: '0.75rem', flexWrap: 'wrap', alignItems: 'center' }}>
        <span style={{ fontFamily: 'var(--font-display)', fontSize: '0.65rem', fontWeight: 600, letterSpacing: '0.1em', textTransform: 'uppercase', color: '#6b7280' }}>Filter:</span>

        <select value={filterSeason} style={selectStyle}>
          <option value="">All Seasons</option>
          {(seasons || []).map(s => <option key={s.id} value={s.id}>{s.display_name}{s.is_active ? ' ★' : ''}</option>)}
        </select>

        <select value={filterSession} style={selectStyle}>
          <option value="">All Sessions</option>
          {(sessions || [])
            .filter(s => !filterSeason || s.season_id === filterSeason)
            .map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
        </select>

        <select value={filterStatus} style={selectStyle}>
          <option value="">All Statuses</option>
          <option value="open">Open</option>
          <option value="closed">Closed</option>
          <option value="full">Full</option>
        </select>

        {(filterSeason || filterSession || filterStatus) && (
          <Link href="/backstage/programs" style={{ fontFamily: 'var(--font-display)', fontSize: '0.65rem', fontWeight: 600, letterSpacing: '0.08em', textTransform: 'uppercase', color: '#b40000', textDecoration: 'none' }}>✕ Clear</Link>
        )}

        <span style={{ marginLeft: 'auto', fontFamily: 'var(--font-body)', fontSize: '0.8rem', color: '#9ca3af' }}>{filtered.length} program{filtered.length !== 1 ? 's' : ''}</span>
      </div>

      {/* Table */}
      <div style={{ background: '#fff', border: '1px solid #e5e7eb', borderRadius: '8px', overflow: 'hidden' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead>
            <tr>
              {['Season', 'Session', 'Program', 'Enrollment', 'Fee', 'Balance Due', 'Opens', 'Closes', 'Status', ''].map(col => (
                <th key={col} style={thStyle}>{col}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {filtered.length === 0 ? (
              <tr><td colSpan={10} style={{ padding: '3rem', textAlign: 'center', fontFamily: 'var(--font-body)', color: '#9ca3af', fontStyle: 'italic' }}>No programs found.</td></tr>
            ) : filtered.map((prog, i) => {
              const pct = prog.enrollment_limit > 0 ? Math.round((prog.enrolled / prog.enrollment_limit) * 100) : 0;
              return (
                <tr key={prog.id} onClick={() => window.location.href = `/backstage/programs/${prog.id}`} style={{ background: i % 2 === 0 ? '#fff' : '#fafafa', borderBottom: '1px solid #f3f4f6', cursor: 'pointer' }}>
                  <td style={{ padding: '0.75rem 1rem', fontFamily: 'var(--font-body)', fontSize: '0.8rem', color: '#374151' }}>
                    {prog.season?.display_name || prog.season?.name || '—'}
                    {prog.season?.is_active && <span style={{ marginLeft: '0.3rem', color: '#e0bf5c', fontSize: '0.7rem' }}>★</span>}
                  </td>
                  <td style={{ padding: '0.75rem 1rem', fontFamily: 'var(--font-body)', fontSize: '0.8rem', color: '#374151' }}>{prog.session?.name || '—'}</td>
                  <td style={{ padding: '0.75rem 1rem' }}>
                    <p style={{ fontFamily: 'var(--font-body)', fontSize: '0.875rem', fontWeight: 600, color: '#111', margin: 0 }}>{prog.label}</p>
                    <p style={{ fontFamily: 'var(--font-body)', fontSize: '0.75rem', color: '#9ca3af', margin: 0 }}>${prog.fee} fee · ${prog.deposit_amount} deposit</p>
                  </td>
                  <td style={{ padding: '0.75rem 1rem' }}>
                    <p style={{ fontFamily: 'var(--font-display)', fontSize: '0.875rem', fontWeight: 700, color: prog.isFull ? '#b40000' : '#111', margin: 0 }}>{prog.enrolled} / {prog.enrollment_limit}</p>
                    <div style={{ height: '4px', background: '#e5e7eb', borderRadius: '2px', marginTop: '4px', width: '80px' }}>
                      <div style={{ height: '100%', width: `${Math.min(100, pct)}%`, background: prog.isFull ? '#b40000' : pct >= 80 ? '#d97706' : '#16a34a', borderRadius: '2px' }} />
                    </div>
                  </td>
                  <td style={{ padding: '0.75rem 1rem', fontFamily: 'var(--font-body)', fontSize: '0.8rem', color: '#374151' }}>${prog.fee}</td>
                  <td style={{ padding: '0.75rem 1rem', fontFamily: 'var(--font-body)', fontSize: '0.8rem', color: '#374151' }}>{fmtDate(prog.balance_due_date)}</td>
                  <td style={{ padding: '0.75rem 1rem', fontFamily: 'var(--font-body)', fontSize: '0.75rem', color: '#6b7280' }}>{fmtDateTime(prog.registration_opens_at)}</td>
                  <td style={{ padding: '0.75rem 1rem', fontFamily: 'var(--font-body)', fontSize: '0.75rem', color: '#6b7280' }}>{fmtDateTime(prog.registration_closes_at)}</td>
                  <td style={{ padding: '0.75rem 1rem' }}>
                    <StatusBadge label={prog.statusLabel} color={prog.statusColor} bg={prog.statusBg} />
                  </td>
                  <td style={{ padding: '0.75rem 1rem' }} onClick={e => e.stopPropagation()}>
                    <Link href={`/backstage/programs/${prog.id}/edit`} style={{ fontFamily: 'var(--font-display)', fontSize: '0.65rem', fontWeight: 600, letterSpacing: '0.08em', textTransform: 'uppercase', color: '#374151', textDecoration: 'none', border: '1px solid #e5e7eb', borderRadius: '4px', padding: '0.3rem 0.75rem' }}>
                      Edit
                    </Link>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}