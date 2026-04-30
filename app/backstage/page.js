import { createClient } from '@/lib/supabase/server';
import { redirect } from 'next/navigation';
import Link from 'next/link';

function fmt(amount) {
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(Number(amount) || 0);
}

function fmtDate(str) {
  if (!str) return '—';
  return new Date(str).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

function StatCard({ label, value, sub, color = '#111', border = '#e5e7eb', bg = '#ffffff' }) {
  return (
    <div style={{
      background: bg, border: `1px solid ${border}`,
      borderRadius: '8px', padding: '1.25rem',
      display: 'flex', flexDirection: 'column', gap: '0.25rem',
    }}>
      <p style={{ fontFamily: 'var(--font-display)', fontSize: '0.65rem', fontWeight: 600, letterSpacing: '0.12em', textTransform: 'uppercase', color: '#6b7280', margin: 0 }}>
        {label}
      </p>
      <p style={{ fontFamily: 'var(--font-display)', fontSize: '1.75rem', fontWeight: 800, color, margin: 0, lineHeight: 1 }}>
        {value}
      </p>
      {sub && <p style={{ fontFamily: 'var(--font-body)', fontSize: '0.75rem', color: '#9ca3af', margin: 0 }}>{sub}</p>}
    </div>
  );
}

function StatusBadge({ label, value, color }) {
  return (
    <div style={{ textAlign: 'center' }}>
      <p style={{ fontFamily: 'var(--font-display)', fontSize: '1.5rem', fontWeight: 800, color, margin: 0, lineHeight: 1 }}>{value}</p>
      <p style={{ fontFamily: 'var(--font-display)', fontSize: '0.6rem', fontWeight: 600, letterSpacing: '0.08em', textTransform: 'uppercase', color: '#9ca3af', margin: 0, marginTop: '2px' }}>{label}</p>
    </div>
  );
}

export default async function BackstageDashboard() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  // ── Fetch all data ────────────────────────────────────────────────────────

  // Active season programs with enrollment counts
  const { data: programs } = await supabase
    .from('programs')
    .select(`
      id, label, enrollment_limit, is_registration_open, fee, balance_due_date,
      sessions!inner(name, seasons!inner(is_active, display_name, name))
    `)
    .eq('sessions.seasons.is_active', true);

  // Enrollment counts per program
  const enrollmentByProgram = {};
  if (programs?.length) {
    for (const prog of programs) {
      const { count } = await supabase
        .from('registrations')
        .select('id', { count: 'exact', head: true })
        .eq('status_id', 'd3ae5075-819c-41e2-a685-bbfaea5171b1'); // Active only
      enrollmentByProgram[prog.id] = count || 0;
    }
  }

  // Registration status counts
  const { data: regStatusCounts } = await supabase
    .from('registrations')
    .select('status_id, registration_statuses(label)');

  const statusCounts = {
    active:    0,
    pending:   0,
    cancelled: 0,
  };
  (regStatusCounts || []).forEach(r => {
    const label = r.registration_statuses?.label?.toLowerCase();
    if (label === 'active')    statusCounts.active++;
    if (label === 'pending')   statusCounts.pending++;
    if (label === 'cancelled') statusCounts.cancelled++;
  });

  // Payment status counts
  const { data: paymentCounts } = await supabase
    .from('payments')
    .select('status_id, payment_statuses(label)');

  const payStatus = { paid: 0, pending: 0, overdue: 0 };
  (paymentCounts || []).forEach(p => {
    const label = p.payment_statuses?.label?.toLowerCase();
    if (label === 'paid')    payStatus.paid++;
    if (label === 'pending') payStatus.pending++;
    if (label === 'overdue') payStatus.overdue++;
  });

  // Financial totals
  const { data: financials } = await supabase
    .from('registrations')
    .select('amount_paid, total_fee, is_financial_aid_requested');

  const totalCollected   = (financials || []).reduce((s, r) => s + (parseFloat(r.amount_paid) || 0), 0);
  const totalOutstanding = (financials || [])
    .filter(r => !r.is_financial_aid_requested)
    .reduce((s, r) => s + Math.max(0, (parseFloat(r.total_fee) || 0) - (parseFloat(r.amount_paid) || 0)), 0);
  const totalFA = (financials || []).filter(r => r.is_financial_aid_requested).length;

  // Recent registrations
  const { data: recentRegs } = await supabase
    .from('registrations')
    .select(`
      id, registration_number, registered_at, amount_paid, total_fee,
      participants(first_name, last_name, nickname, yog),
      registration_statuses(label),
      payment_statuses:payments(payment_statuses(label))
    `)
    .order('registered_at', { ascending: false })
    .limit(8);

  // Grade levels for active season
  const { data: gradeLevels } = await supabase
    .from('grade_levels')
    .select('yog, label, seasons!inner(is_active)')
    .eq('seasons.is_active', true);

  function getGrade(yog) {
    return gradeLevels?.find(g => g.yog === yog)?.label || `YOG ${yog}`;
  }

  function displayName(p) {
    if (!p) return '—';
    return p.nickname ? `${p.nickname} ${p.last_name}` : `${p.first_name} ${p.last_name}`;
  }

  const season = programs?.[0]?.sessions?.seasons;
  const sessionName = programs?.[0]?.sessions?.name;

  return (
    <div>
      {/* Page header */}
      <div style={{ marginBottom: '1.5rem', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
        <div>
          <h1 style={{ fontFamily: 'var(--font-display)', fontSize: '1.5rem', fontWeight: 800, letterSpacing: '0.05em', textTransform: 'uppercase', color: '#111', margin: 0 }}>
            Dashboard
          </h1>
          <p style={{ fontFamily: 'var(--font-body)', fontSize: '0.875rem', color: '#6b7280', margin: 0, marginTop: '2px' }}>
            {season?.display_name || season?.name} Season · {sessionName} Session
          </p>
        </div>
        <p style={{ fontFamily: 'var(--font-body)', fontSize: '0.8rem', color: '#9ca3af', margin: 0 }}>
          {new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' })}
        </p>
      </div>

      {/* ── Enrollment cards ─────────────────────────────────────────────── */}
      <section style={{ marginBottom: '1.5rem' }}>
        <h2 style={{ fontFamily: 'var(--font-display)', fontSize: '0.75rem', fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase', color: '#6b7280', marginBottom: '0.75rem' }}>
          Enrollment by Program
        </h2>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: '1rem' }}>
          {(programs || []).map(prog => {
            const enrolled  = enrollmentByProgram[prog.id] || 0;
            const limit     = prog.enrollment_limit || 0;
            const remaining = Math.max(0, limit - enrolled);
            const pct       = limit > 0 ? Math.round((enrolled / limit) * 100) : 0;
            const isFull    = remaining === 0;
            const isNearFull = pct >= 80 && !isFull;

            return (
              <div key={prog.id} style={{
                background: '#ffffff', border: '1px solid #e5e7eb',
                borderRadius: '8px', overflow: 'hidden',
              }}>
                {/* Header */}
                <div style={{
                  background: isFull ? '#1a0505' : '#111',
                  padding: '0.875rem 1.25rem',
                  display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                }}>
                  <div>
                    <p style={{ fontFamily: 'var(--font-display)', fontSize: '0.9rem', fontWeight: 800, letterSpacing: '0.05em', textTransform: 'uppercase', color: '#ffffff', margin: 0 }}>
                      {prog.label}
                    </p>
                    <p style={{ fontFamily: 'var(--font-body)', fontSize: '0.75rem', color: '#9ca3af', margin: 0 }}>
                      {prog.is_registration_open ? '🟢 Registration Open' : '🔴 Registration Closed'}
                    </p>
                  </div>
                  <div style={{ textAlign: 'right' }}>
                    <p style={{ fontFamily: 'var(--font-display)', fontSize: '1.5rem', fontWeight: 800, color: isFull ? '#b40000' : '#e0bf5c', margin: 0, lineHeight: 1 }}>
                      {enrolled}
                    </p>
                    <p style={{ fontFamily: 'var(--font-display)', fontSize: '0.6rem', fontWeight: 600, letterSpacing: '0.1em', textTransform: 'uppercase', color: '#9ca3af', margin: 0 }}>
                      of {limit}
                    </p>
                  </div>
                </div>

                {/* Progress bar */}
                <div style={{ height: '4px', background: '#e5e7eb' }}>
                  <div style={{
                    height: '100%',
                    width: `${Math.min(100, pct)}%`,
                    background: isFull ? '#b40000' : isNearFull ? '#d97706' : '#e0bf5c',
                    transition: 'width 0.3s ease',
                  }} />
                </div>

                {/* Stats */}
                <div style={{ padding: '0.875rem 1.25rem', display: 'flex', justifyContent: 'space-between' }}>
                  <div>
                    <p style={{ fontFamily: 'var(--font-display)', fontSize: '0.65rem', fontWeight: 600, letterSpacing: '0.1em', textTransform: 'uppercase', color: '#9ca3af', margin: 0 }}>Remaining</p>
                    <p style={{ fontFamily: 'var(--font-display)', fontSize: '1rem', fontWeight: 700, color: isFull ? '#b40000' : '#111', margin: 0 }}>{isFull ? 'FULL' : remaining}</p>
                  </div>
                  <div style={{ textAlign: 'center' }}>
                    <p style={{ fontFamily: 'var(--font-display)', fontSize: '0.65rem', fontWeight: 600, letterSpacing: '0.1em', textTransform: 'uppercase', color: '#9ca3af', margin: 0 }}>Filled</p>
                    <p style={{ fontFamily: 'var(--font-display)', fontSize: '1rem', fontWeight: 700, color: '#111', margin: 0 }}>{pct}%</p>
                  </div>
                  <div style={{ textAlign: 'right' }}>
                    <p style={{ fontFamily: 'var(--font-display)', fontSize: '0.65rem', fontWeight: 600, letterSpacing: '0.1em', textTransform: 'uppercase', color: '#9ca3af', margin: 0 }}>Balance Due</p>
                    <p style={{ fontFamily: 'var(--font-display)', fontSize: '0.75rem', fontWeight: 700, color: '#111', margin: 0 }}>
                      {prog.balance_due_date ? new Date(prog.balance_due_date + 'T00:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric' }) : '—'}
                    </p>
                  </div>
                </div>

                <div style={{ padding: '0 1.25rem 0.875rem' }}>
                  <Link
                    href={`/backstage/registrations?program=${prog.id}`}
                    style={{
                      display: 'block', textAlign: 'center',
                      fontFamily: 'var(--font-display)', fontSize: '0.65rem', fontWeight: 600,
                      letterSpacing: '0.1em', textTransform: 'uppercase',
                      color: '#b40000', textDecoration: 'none',
                      border: '1px solid #b40000', borderRadius: '4px',
                      padding: '0.4rem',
                    }}
                  >
                    View Registrations →
                  </Link>
                </div>
              </div>
            );
          })}
        </div>
      </section>

      {/* ── Status summary + Financial ────────────────────────────────────── */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem', marginBottom: '1.5rem' }}>

        {/* Registration status */}
        <div style={{ background: '#ffffff', border: '1px solid #e5e7eb', borderRadius: '8px', padding: '1.25rem' }}>
          <h2 style={{ fontFamily: 'var(--font-display)', fontSize: '0.75rem', fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase', color: '#6b7280', marginBottom: '1rem', margin: '0 0 1rem 0' }}>
            Registration Status
          </h2>
          <div style={{ display: 'flex', justifyContent: 'space-around', alignItems: 'center' }}>
            <StatusBadge label="Active"    value={statusCounts.active}    color="#16a34a" />
            <div style={{ width: '1px', height: '40px', background: '#e5e7eb' }} />
            <StatusBadge label="Pending"   value={statusCounts.pending}   color="#d97706" />
            <div style={{ width: '1px', height: '40px', background: '#e5e7eb' }} />
            <StatusBadge label="Cancelled" value={statusCounts.cancelled} color="#b40000" />
          </div>
          <div style={{ borderTop: '1px solid #e5e7eb', marginTop: '1rem', paddingTop: '1rem' }}>
            <h3 style={{ fontFamily: 'var(--font-display)', fontSize: '0.75rem', fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase', color: '#6b7280', margin: '0 0 0.75rem 0' }}>
              Payment Status
            </h3>
            <div style={{ display: 'flex', justifyContent: 'space-around', alignItems: 'center' }}>
              <StatusBadge label="Paid"    value={payStatus.paid}    color="#16a34a" />
              <div style={{ width: '1px', height: '40px', background: '#e5e7eb' }} />
              <StatusBadge label="Pending" value={payStatus.pending} color="#d97706" />
              <div style={{ width: '1px', height: '40px', background: '#e5e7eb' }} />
              <StatusBadge label="Overdue" value={payStatus.overdue} color="#b40000" />
            </div>
          </div>
        </div>

        {/* Financial snapshot */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          <StatCard
            label="Total Collected"
            value={fmt(totalCollected)}
            sub="Deposits + full payments received"
            color="#16a34a"
            border="#bbf7d0"
            bg="#f0fdf4"
          />
          <StatCard
            label="Outstanding Balance"
            value={fmt(totalOutstanding)}
            sub={totalFA > 0 ? `${totalFA} financial aid registration${totalFA !== 1 ? 's' : ''} pending review` : 'No financial aid requests'}
            color={totalOutstanding > 0 ? '#b40000' : '#16a34a'}
            border={totalOutstanding > 0 ? '#fecaca' : '#bbf7d0'}
            bg={totalOutstanding > 0 ? '#fff5f5' : '#f0fdf4'}
          />
        </div>
      </div>

      {/* ── Recent registrations ──────────────────────────────────────────── */}
      <section>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.75rem' }}>
          <h2 style={{ fontFamily: 'var(--font-display)', fontSize: '0.75rem', fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase', color: '#6b7280', margin: 0 }}>
            Recent Registrations
          </h2>
          <Link href="/backstage/registrations" style={{ fontFamily: 'var(--font-display)', fontSize: '0.65rem', fontWeight: 600, letterSpacing: '0.08em', textTransform: 'uppercase', color: '#b40000', textDecoration: 'none' }}>
            View All →
          </Link>
        </div>

        <div style={{ background: '#ffffff', border: '1px solid #e5e7eb', borderRadius: '8px', overflow: 'hidden' }}>
          {/* Table header */}
          <div style={{ display: 'grid', gridTemplateColumns: '180px 1fr 100px 140px 140px 100px', gap: '0', borderBottom: '1px solid #e5e7eb', background: '#f9fafb' }}>
            {['Date', 'Participant', 'Grade', 'Reg Status', 'Payment Status', 'Amount'].map(col => (
              <div key={col} style={{ padding: '0.625rem 1rem', fontFamily: 'var(--font-display)', fontSize: '0.65rem', fontWeight: 600, letterSpacing: '0.1em', textTransform: 'uppercase', color: '#6b7280' }}>
                {col}
              </div>
            ))}
          </div>

          {/* Table rows */}
          {(recentRegs || []).length === 0 ? (
            <div style={{ padding: '2rem', textAlign: 'center', fontFamily: 'var(--font-body)', fontSize: '0.875rem', color: '#9ca3af', fontStyle: 'italic' }}>
              No registrations yet.
            </div>
          ) : (
            (recentRegs || []).map((reg, i) => {
              const p         = reg.participants;
              const regStatus = reg.registration_statuses?.label || '—';
              const payStatus = reg.payment_statuses?.[0]?.payment_statuses?.label || 'Pending';
              const balance   = (reg.total_fee || 0) - (reg.amount_paid || 0);

              const regColor = regStatus === 'Active' ? '#16a34a' : regStatus === 'Cancelled' ? '#b40000' : '#d97706';
              const payColor = payStatus === 'Paid' ? '#16a34a' : payStatus === 'Overdue' ? '#b40000' : '#d97706';

              return (
                <Link
                  key={reg.id}
                  href={`/backstage/registrations/${reg.id}`}
                  style={{
                    display: 'grid', gridTemplateColumns: '180px 1fr 100px 140px 140px 100px',
                    borderBottom: i < (recentRegs.length - 1) ? '1px solid #e5e7eb' : 'none',
                    textDecoration: 'none',
                    background: i % 2 === 0 ? '#ffffff' : '#fafafa',
                  }}
                  onMouseOver={e => e.currentTarget.style.background = '#f0f9ff'}
                  onMouseOut={e => e.currentTarget.style.background = i % 2 === 0 ? '#ffffff' : '#fafafa'}
                >
                  <div style={{ padding: '0.75rem 1rem', fontFamily: 'var(--font-body)', fontSize: '0.8rem', color: '#6b7280' }}>
                    {fmtDate(reg.registered_at)}
                  </div>
                  <div style={{ padding: '0.75rem 1rem' }}>
                    <p style={{ fontFamily: 'var(--font-body)', fontSize: '0.875rem', fontWeight: 600, color: '#111', margin: 0 }}>
                      {displayName(p)}
                    </p>
                    <p style={{ fontFamily: 'var(--font-body)', fontSize: '0.75rem', color: '#9ca3af', margin: 0 }}>
                      #{reg.registration_number}
                    </p>
                  </div>
                  <div style={{ padding: '0.75rem 1rem', fontFamily: 'var(--font-body)', fontSize: '0.875rem', color: '#374151' }}>
                    {getGrade(p?.yog)}
                  </div>
                  <div style={{ padding: '0.75rem 1rem' }}>
                    <span style={{ fontFamily: 'var(--font-display)', fontSize: '0.65rem', fontWeight: 600, letterSpacing: '0.06em', textTransform: 'uppercase', color: regColor, background: `${regColor}15`, borderRadius: '3px', padding: '0.2rem 0.5rem' }}>
                      {regStatus}
                    </span>
                  </div>
                  <div style={{ padding: '0.75rem 1rem' }}>
                    <span style={{ fontFamily: 'var(--font-display)', fontSize: '0.65rem', fontWeight: 600, letterSpacing: '0.06em', textTransform: 'uppercase', color: payColor, background: `${payColor}15`, borderRadius: '3px', padding: '0.2rem 0.5rem' }}>
                      {payStatus}
                    </span>
                  </div>
                  <div style={{ padding: '0.75rem 1rem', fontFamily: 'var(--font-body)', fontSize: '0.875rem', color: '#111' }}>
                    {fmt(reg.amount_paid)}
                    {balance > 0 && (
                      <p style={{ fontFamily: 'var(--font-body)', fontSize: '0.7rem', color: '#b40000', margin: 0 }}>
                        {fmt(balance)} due
                      </p>
                    )}
                  </div>
                </Link>
              );
            })
          )}
        </div>
      </section>
    </div>
  );
}