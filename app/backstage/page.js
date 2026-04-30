import { createClient } from '@/lib/supabase/server';
import { redirect } from 'next/navigation';
import Link from 'next/link';

function fmt(amount) {
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(Number(amount) || 0);
}

function fmtDateTime(str) {
  if (!str) return '—';
  return new Date(str).toLocaleDateString('en-US', {
    month: 'short', day: 'numeric', year: 'numeric',
  });
}

export default async function BackstageDashboard() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  const { data: profile } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .single();
  if (profile?.role !== 'admin') redirect('/dashboard');

  // ── Data fetching ──────────────────────────────────────────────────────────

  // Programs for active season
  const { data: programs } = await supabase
    .from('programs')
    .select(`
      id, label, enrollment_limit, is_registration_open,
      fee, deposit_amount, balance_due_date,
      sessions!inner(name, seasons!inner(is_active, display_name, name))
    `)
    .eq('sessions.seasons.is_active', true);

  // All registrations with status + payment info
  const { data: registrations } = await supabase
    .from('registrations')
    .select(`
      id, registration_number, registered_at,
      amount_paid, total_fee, is_financial_aid_requested,
      status_id, cart_id,
      participants(first_name, last_name, nickname, yog),
      registration_statuses(label),
      payments(status_id, payment_statuses(label))
    `)
    .order('registered_at', { ascending: false });

  // Grade levels for active season
  const { data: gradeLevels } = await supabase
    .from('grade_levels')
    .select('yog, label, seasons!inner(is_active)')
    .eq('seasons.is_active', true);

  // Carts to link registrations to programs
  const { data: carts } = await supabase
    .from('carts')
    .select('id, programs:programs!inner(id, label, sessions!inner(seasons!inner(is_active)))')
    .eq('programs.sessions.seasons.is_active', true);

  // ── Derived data ───────────────────────────────────────────────────────────

  // Build cart → program map
  const cartProgramMap = {};
  (carts || []).forEach(c => {
    if (c.id && c.programs?.id) {
      cartProgramMap[c.id] = c.programs.id;
    }
  });

  // Enrollment count per program (Active registrations only)
  const enrollmentByProgram = {};
  (programs || []).forEach(p => { enrollmentByProgram[p.id] = 0; });
  (registrations || []).forEach(r => {
    if (r.registration_statuses?.label === 'Active' && r.cart_id) {
      const progId = cartProgramMap[r.cart_id];
      if (progId && enrollmentByProgram[progId] !== undefined) {
        enrollmentByProgram[progId]++;
      }
    }
  });

  // Status counts
  const statusCounts = { active: 0, pending: 0, cancelled: 0 };
  (registrations || []).forEach(r => {
    const label = r.registration_statuses?.label?.toLowerCase();
    if (label === 'active')    statusCounts.active++;
    if (label === 'pending')   statusCounts.pending++;
    if (label === 'cancelled') statusCounts.cancelled++;
  });

  // Payment status counts
  const payStatus = { paid: 0, pending: 0, overdue: 0 };
  (registrations || []).forEach(r => {
    const label = r.payments?.[0]?.payment_statuses?.label?.toLowerCase();
    if (label === 'paid')    payStatus.paid++;
    if (label === 'pending') payStatus.pending++;
    if (label === 'overdue') payStatus.overdue++;
  });

  // Financial totals
  const totalCollected = (registrations || [])
    .reduce((s, r) => s + (parseFloat(r.amount_paid) || 0), 0);
  const totalOutstanding = (registrations || [])
    .filter(r => !r.is_financial_aid_requested)
    .reduce((s, r) => s + Math.max(0, (parseFloat(r.total_fee) || 0) - (parseFloat(r.amount_paid) || 0)), 0);
  const totalFA = (registrations || []).filter(r => r.is_financial_aid_requested).length;

  // Recent 8 registrations
  const recentRegs = (registrations || []).slice(0, 8);

  function getGrade(yog) {
    return gradeLevels?.find(g => g.yog === yog)?.label || `YOG ${yog}`;
  }

  function displayName(p) {
    if (!p) return '—';
    return p.nickname ? `${p.nickname} ${p.last_name}` : `${p.first_name} ${p.last_name}`;
  }

  const season = programs?.[0]?.sessions?.seasons;
  const sessionName = programs?.[0]?.sessions?.name;

  // ── Styles ─────────────────────────────────────────────────────────────────

  const card = {
    background: '#ffffff', border: '1px solid #e5e7eb',
    borderRadius: '8px', padding: '1.25rem',
  };

  const sectionLabel = {
    fontFamily: 'var(--font-display)', fontSize: '0.7rem', fontWeight: 700,
    letterSpacing: '0.12em', textTransform: 'uppercase', color: '#6b7280',
    margin: '0 0 0.75rem 0',
  };

  return (
    <div>

      {/* Page header */}
      <div style={{ marginBottom: '1.5rem', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
        <div>
          <h1 style={{ fontFamily: 'var(--font-display)', fontSize: '1.5rem', fontWeight: 800, letterSpacing: '0.05em', textTransform: 'uppercase', color: '#111', margin: 0 }}>
            Dashboard
          </h1>
          <p style={{ fontFamily: 'var(--font-body)', fontSize: '0.875rem', color: '#6b7280', margin: '2px 0 0 0' }}>
            {season?.display_name || season?.name || '—'} Season · {sessionName || '—'} Session
          </p>
        </div>
        <p style={{ fontFamily: 'var(--font-body)', fontSize: '0.8rem', color: '#9ca3af', margin: 0 }}>
          {new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' })}
        </p>
      </div>

      {/* ── Enrollment cards ──────────────────────────────────────────────────── */}
      <h2 style={sectionLabel}>Enrollment by Program</h2>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))', gap: '1rem', marginBottom: '1.5rem' }}>
        {(programs || []).map(prog => {
          const enrolled  = enrollmentByProgram[prog.id] || 0;
          const limit     = prog.enrollment_limit || 0;
          const remaining = Math.max(0, limit - enrolled);
          const pct       = limit > 0 ? Math.round((enrolled / limit) * 100) : 0;
          const isFull    = remaining === 0 && limit > 0;
          const isNear    = pct >= 80 && !isFull;
          const barColor  = isFull ? '#b40000' : isNear ? '#d97706' : '#e0bf5c';

          return (
            <div key={prog.id} style={{ background: '#ffffff', border: '1px solid #e5e7eb', borderRadius: '8px', overflow: 'hidden' }}>
              <div style={{ background: '#111', padding: '0.875rem 1.25rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div>
                  <p style={{ fontFamily: 'var(--font-display)', fontSize: '0.85rem', fontWeight: 800, letterSpacing: '0.05em', textTransform: 'uppercase', color: '#fff', margin: 0 }}>{prog.label}</p>
                  <p style={{ fontFamily: 'var(--font-body)', fontSize: '0.7rem', color: '#9ca3af', margin: 0 }}>
                    {prog.is_registration_open ? '🟢 Open' : '🔴 Closed'}
                  </p>
                </div>
                <div style={{ textAlign: 'right' }}>
                  <p style={{ fontFamily: 'var(--font-display)', fontSize: '1.5rem', fontWeight: 800, color: isFull ? '#b40000' : '#e0bf5c', margin: 0, lineHeight: 1 }}>{enrolled}</p>
                  <p style={{ fontFamily: 'var(--font-display)', fontSize: '0.6rem', fontWeight: 600, letterSpacing: '0.1em', textTransform: 'uppercase', color: '#9ca3af', margin: 0 }}>of {limit}</p>
                </div>
              </div>
              <div style={{ height: '4px', background: '#e5e7eb' }}>
                <div style={{ height: '100%', width: `${Math.min(100, pct)}%`, background: barColor }} />
              </div>
              <div style={{ padding: '0.875rem 1.25rem' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.75rem' }}>
                  <div>
                    <p style={{ fontFamily: 'var(--font-display)', fontSize: '0.6rem', fontWeight: 600, letterSpacing: '0.1em', textTransform: 'uppercase', color: '#9ca3af', margin: 0 }}>Remaining</p>
                    <p style={{ fontFamily: 'var(--font-display)', fontSize: '1rem', fontWeight: 700, color: isFull ? '#b40000' : '#111', margin: 0 }}>{isFull ? 'FULL' : remaining}</p>
                  </div>
                  <div style={{ textAlign: 'center' }}>
                    <p style={{ fontFamily: 'var(--font-display)', fontSize: '0.6rem', fontWeight: 600, letterSpacing: '0.1em', textTransform: 'uppercase', color: '#9ca3af', margin: 0 }}>Filled</p>
                    <p style={{ fontFamily: 'var(--font-display)', fontSize: '1rem', fontWeight: 700, color: '#111', margin: 0 }}>{pct}%</p>
                  </div>
                  <div style={{ textAlign: 'right' }}>
                    <p style={{ fontFamily: 'var(--font-display)', fontSize: '0.6rem', fontWeight: 600, letterSpacing: '0.1em', textTransform: 'uppercase', color: '#9ca3af', margin: 0 }}>Balance Due</p>
                    <p style={{ fontFamily: 'var(--font-display)', fontSize: '0.75rem', fontWeight: 700, color: '#111', margin: 0 }}>
                      {prog.balance_due_date ? new Date(prog.balance_due_date + 'T00:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric' }) : '—'}
                    </p>
                  </div>
                </div>
                <Link href={`/backstage/registrations?program=${prog.id}`} style={{ display: 'block', textAlign: 'center', fontFamily: 'var(--font-display)', fontSize: '0.65rem', fontWeight: 600, letterSpacing: '0.1em', textTransform: 'uppercase', color: '#b40000', textDecoration: 'none', border: '1px solid #b40000', borderRadius: '4px', padding: '0.4rem' }}>
                  View Registrations →
                </Link>
              </div>
            </div>
          );
        })}
      </div>

      {/* ── Status + Financial ─────────────────────────────────────────────── */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem', marginBottom: '1.5rem' }}>

        {/* Status summary */}
        <div style={card}>
          <h2 style={sectionLabel}>Registration Status</h2>
          <div style={{ display: 'flex', justifyContent: 'space-around', alignItems: 'center', paddingBottom: '1rem', borderBottom: '1px solid #e5e7eb' }}>
            {[
              { label: 'Active',    value: statusCounts.active,    color: '#16a34a' },
              { label: 'Pending',   value: statusCounts.pending,   color: '#d97706' },
              { label: 'Cancelled', value: statusCounts.cancelled, color: '#b40000' },
            ].map(s => (
              <div key={s.label} style={{ textAlign: 'center' }}>
                <p style={{ fontFamily: 'var(--font-display)', fontSize: '1.5rem', fontWeight: 800, color: s.color, margin: 0, lineHeight: 1 }}>{s.value}</p>
                <p style={{ fontFamily: 'var(--font-display)', fontSize: '0.6rem', fontWeight: 600, letterSpacing: '0.08em', textTransform: 'uppercase', color: '#9ca3af', margin: '2px 0 0 0' }}>{s.label}</p>
              </div>
            ))}
          </div>
          <h2 style={{ ...sectionLabel, marginTop: '1rem' }}>Payment Status</h2>
          <div style={{ display: 'flex', justifyContent: 'space-around', alignItems: 'center' }}>
            {[
              { label: 'Paid',    value: payStatus.paid,    color: '#16a34a' },
              { label: 'Pending', value: payStatus.pending, color: '#d97706' },
              { label: 'Overdue', value: payStatus.overdue, color: '#b40000' },
            ].map(s => (
              <div key={s.label} style={{ textAlign: 'center' }}>
                <p style={{ fontFamily: 'var(--font-display)', fontSize: '1.5rem', fontWeight: 800, color: s.color, margin: 0, lineHeight: 1 }}>{s.value}</p>
                <p style={{ fontFamily: 'var(--font-display)', fontSize: '0.6rem', fontWeight: 600, letterSpacing: '0.08em', textTransform: 'uppercase', color: '#9ca3af', margin: '2px 0 0 0' }}>{s.label}</p>
              </div>
            ))}
          </div>
        </div>

        {/* Financial */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          <div style={{ ...card, background: '#f0fdf4', border: '1px solid #bbf7d0', flex: 1 }}>
            <p style={{ fontFamily: 'var(--font-display)', fontSize: '0.65rem', fontWeight: 600, letterSpacing: '0.12em', textTransform: 'uppercase', color: '#6b7280', margin: '0 0 0.25rem 0' }}>Total Collected</p>
            <p style={{ fontFamily: 'var(--font-display)', fontSize: '1.75rem', fontWeight: 800, color: '#16a34a', margin: 0, lineHeight: 1 }}>{fmt(totalCollected)}</p>
            <p style={{ fontFamily: 'var(--font-body)', fontSize: '0.75rem', color: '#9ca3af', margin: '4px 0 0 0' }}>Deposits + full payments received</p>
          </div>
          <div style={{ ...card, background: totalOutstanding > 0 ? '#fff5f5' : '#f0fdf4', border: `1px solid ${totalOutstanding > 0 ? '#fecaca' : '#bbf7d0'}`, flex: 1 }}>
            <p style={{ fontFamily: 'var(--font-display)', fontSize: '0.65rem', fontWeight: 600, letterSpacing: '0.12em', textTransform: 'uppercase', color: '#6b7280', margin: '0 0 0.25rem 0' }}>Outstanding Balance</p>
            <p style={{ fontFamily: 'var(--font-display)', fontSize: '1.75rem', fontWeight: 800, color: totalOutstanding > 0 ? '#b40000' : '#16a34a', margin: 0, lineHeight: 1 }}>{fmt(totalOutstanding)}</p>
            <p style={{ fontFamily: 'var(--font-body)', fontSize: '0.75rem', color: '#9ca3af', margin: '4px 0 0 0' }}>
              {totalFA > 0 ? `${totalFA} financial aid request${totalFA !== 1 ? 's' : ''} pending` : 'No financial aid requests'}
            </p>
          </div>
        </div>
      </div>

      {/* ── Recent registrations ───────────────────────────────────────────── */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.75rem' }}>
        <h2 style={{ ...sectionLabel, margin: 0 }}>Recent Registrations</h2>
        <Link href="/backstage/registrations" style={{ fontFamily: 'var(--font-display)', fontSize: '0.65rem', fontWeight: 600, letterSpacing: '0.08em', textTransform: 'uppercase', color: '#b40000', textDecoration: 'none' }}>
          View All →
        </Link>
      </div>

      <div style={{ background: '#ffffff', border: '1px solid #e5e7eb', borderRadius: '8px', overflow: 'hidden' }}>
        {/* Header row */}
        <div style={{ display: 'grid', gridTemplateColumns: '160px 1fr 90px 130px 130px 100px', background: '#f9fafb', borderBottom: '1px solid #e5e7eb' }}>
          {['Date', 'Participant', 'Grade', 'Reg Status', 'Pay Status', 'Amount'].map(col => (
            <div key={col} style={{ padding: '0.625rem 1rem', fontFamily: 'var(--font-display)', fontSize: '0.65rem', fontWeight: 600, letterSpacing: '0.1em', textTransform: 'uppercase', color: '#6b7280' }}>{col}</div>
          ))}
        </div>

        {recentRegs.length === 0 ? (
          <div style={{ padding: '2rem', textAlign: 'center', fontFamily: 'var(--font-body)', fontSize: '0.875rem', color: '#9ca3af', fontStyle: 'italic' }}>
            No registrations yet.
          </div>
        ) : recentRegs.map((reg, i) => {
          const p         = reg.participants;
          const regStatus = reg.registration_statuses?.label || 'Pending';
          const payLabel  = reg.payments?.[0]?.payment_statuses?.label || 'Pending';
          const balance   = (parseFloat(reg.total_fee) || 0) - (parseFloat(reg.amount_paid) || 0);
          const regColor  = regStatus === 'Active' ? '#16a34a' : regStatus === 'Cancelled' ? '#b40000' : '#d97706';
          const payColor  = payLabel  === 'Paid'   ? '#16a34a' : payLabel   === 'Overdue'  ? '#b40000' : '#d97706';

          return (
            <Link key={reg.id} href={`/backstage/registrations/${reg.id}`} style={{ display: 'grid', gridTemplateColumns: '160px 1fr 90px 130px 130px 100px', borderBottom: i < recentRegs.length - 1 ? '1px solid #e5e7eb' : 'none', textDecoration: 'none', background: i % 2 === 0 ? '#ffffff' : '#fafafa' }}>
              <div style={{ padding: '0.75rem 1rem', fontFamily: 'var(--font-body)', fontSize: '0.8rem', color: '#6b7280' }}>
                {fmtDateTime(reg.registered_at)}
              </div>
              <div style={{ padding: '0.75rem 1rem' }}>
                <p style={{ fontFamily: 'var(--font-body)', fontSize: '0.875rem', fontWeight: 600, color: '#111', margin: 0 }}>{displayName(p)}</p>
                <p style={{ fontFamily: 'var(--font-body)', fontSize: '0.75rem', color: '#9ca3af', margin: 0 }}>#{reg.registration_number}</p>
              </div>
              <div style={{ padding: '0.75rem 1rem', fontFamily: 'var(--font-body)', fontSize: '0.875rem', color: '#374151', display: 'flex', alignItems: 'center' }}>
                {getGrade(p?.yog)}
              </div>
              <div style={{ padding: '0.75rem 1rem', display: 'flex', alignItems: 'center' }}>
                <span style={{ fontFamily: 'var(--font-display)', fontSize: '0.65rem', fontWeight: 600, letterSpacing: '0.06em', textTransform: 'uppercase', color: regColor, background: `${regColor}18`, borderRadius: '3px', padding: '0.2rem 0.5rem' }}>{regStatus}</span>
              </div>
              <div style={{ padding: '0.75rem 1rem', display: 'flex', alignItems: 'center' }}>
                <span style={{ fontFamily: 'var(--font-display)', fontSize: '0.65rem', fontWeight: 600, letterSpacing: '0.06em', textTransform: 'uppercase', color: payColor, background: `${payColor}18`, borderRadius: '3px', padding: '0.2rem 0.5rem' }}>{payLabel}</span>
              </div>
              <div style={{ padding: '0.75rem 1rem', fontFamily: 'var(--font-body)', fontSize: '0.875rem', color: '#111', display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
                {fmt(reg.amount_paid)}
                {balance > 0.01 && <span style={{ fontFamily: 'var(--font-body)', fontSize: '0.7rem', color: '#b40000' }}>{fmt(balance)} due</span>}
              </div>
            </Link>
          );
        })}
      </div>
    </div>
  );
}