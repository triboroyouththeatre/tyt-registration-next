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

function StatusBadge({ label }) {
  const colors = {
    'Active':    { color: '#16a34a', bg: '#f0fdf4' },
    'Pending':   { color: '#d97706', bg: '#fffbeb' },
    'Cancelled': { color: '#b40000', bg: '#fff5f5' },
    'Withdrawn': { color: '#6b7280', bg: '#f9fafb' },
    'Waitlisted':{ color: '#7c3aed', bg: '#f5f3ff' },
    'Paid':      { color: '#16a34a', bg: '#f0fdf4' },
    'Overdue':   { color: '#b40000', bg: '#fff5f5' },
  };
  const c = colors[label] || { color: '#6b7280', bg: '#f9fafb' };
  return (
    <span style={{
      fontFamily: 'var(--font-display)', fontSize: '0.65rem', fontWeight: 600,
      letterSpacing: '0.06em', textTransform: 'uppercase',
      color: c.color, background: c.bg,
      border: `1px solid ${c.color}30`,
      borderRadius: '3px', padding: '0.2rem 0.5rem',
      whiteSpace: 'nowrap',
    }}>
      {label}
    </span>
  );
}

export default async function RegistrationsPage({ searchParams }) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  const { data: profile } = await supabase.from('profiles').select('role').eq('id', user.id).single();
  if (profile?.role !== 'admin') redirect('/dashboard');

  const sp = await searchParams;
  const filterProgram  = sp?.program  || '';
  const filterRegStatus = sp?.reg_status || '';
  const filterPayStatus = sp?.pay_status || '';

  // ── Fetch data ──────────────────────────────────────────────────────────────

  const { data: programs } = await supabase
    .from('programs')
    .select('id, label, sessions!inner(seasons!inner(is_active))')
    .eq('sessions.seasons.is_active', true);

  const { data: regStatuses } = await supabase.from('registration_statuses').select('id, label').order('label');
  const { data: payStatuses } = await supabase.from('payment_statuses').select('id, label').order('label');
  const { data: gradeLevels } = await supabase
    .from('grade_levels')
    .select('yog, label, seasons!inner(is_active)')
    .eq('seasons.is_active', true);

  // Fetch all registrations with related data
  const { data: registrations } = await supabase
    .from('registrations')
    .select(`
      id, registration_number, registered_at,
      amount_paid, total_fee, is_financial_aid_requested,
      cart_id,
      participants(id, first_name, last_name, nickname, yog),
      registration_statuses(id, label),
      payments(status_id, payment_statuses(label))
    `)
    .order('registered_at', { ascending: false });

  // Fetch carts for program mapping
  const { data: carts } = await supabase.from('carts').select('id, program_id');
  const cartProgramMap = {};
  (carts || []).forEach(c => { if (c.id && c.program_id) cartProgramMap[c.id] = c.program_id; });

  // Apply filters
  let filtered = (registrations || []).filter(r => {
    const progId    = r.cart_id ? cartProgramMap[r.cart_id] : null;
    const regStatus = r.registration_statuses?.label;
    const payStatus = derivePayStatus(r);

    if (filterProgram   && progId    !== filterProgram)   return false;
    if (filterRegStatus && regStatus !== filterRegStatus) return false;
    if (filterPayStatus && payStatus !== filterPayStatus) return false;
    return true;
  });

  // Status summary counts (from filtered set)
  const summary = {
    active: 0, pending: 0, cancelled: 0,
    paid: 0, payPending: 0, overdue: 0, fa: 0,
  };
  filtered.forEach(r => {
    const reg = r.registration_statuses?.label;
    const pay = derivePayStatus(r);
    if (reg === 'Active')    summary.active++;
    if (reg === 'Pending')   summary.pending++;
    if (reg === 'Cancelled') summary.cancelled++;
    if (pay === 'Paid')      summary.paid++;
    if (pay === 'Pending')   summary.payPending++;
    if (pay === 'Overdue')   summary.overdue++;
    if (r.is_financial_aid_requested) summary.fa++;
  });

  function derivePayStatus(r) {
    const paid  = parseFloat(r.amount_paid) || 0;
    const total = parseFloat(r.total_fee)   || 0;
    if (paid >= total && total > 0) return 'Paid';
    const hasOverdue = (r.payments || []).some(
      p => p.payment_statuses?.label?.toLowerCase() === 'overdue'
    );
    return hasOverdue ? 'Overdue' : 'Pending';
  }

  function getGrade(yog) {
    return gradeLevels?.find(g => g.yog === yog)?.label || `YOG ${yog}`;
  }

  function displayName(p) {
    if (!p) return '—';
    return p.nickname ? `${p.nickname} ${p.last_name}` : `${p.first_name} ${p.last_name}`;
  }

  function buildUrl(overrides) {
    const params = new URLSearchParams({
      ...(filterProgram   && { program:    filterProgram }),
      ...(filterRegStatus && { reg_status: filterRegStatus }),
      ...(filterPayStatus && { pay_status: filterPayStatus }),
      ...overrides,
    });
    const str = params.toString();
    return `/backstage/registrations${str ? '?' + str : ''}`;
  }

  const selectStyle = {
    fontFamily: 'var(--font-body)', fontSize: '0.8rem', color: '#374151',
    border: '1px solid #d1d5db', borderRadius: '6px',
    padding: '0.4rem 0.75rem', background: '#fff', cursor: 'pointer',
  };

  return (
    <div>
      {/* Page header */}
      <div style={{ marginBottom: '1.25rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <h1 style={{ fontFamily: 'var(--font-display)', fontSize: '1.5rem', fontWeight: 800, letterSpacing: '0.05em', textTransform: 'uppercase', color: '#111', margin: 0 }}>
          Registrations
        </h1>
        <p style={{ fontFamily: 'var(--font-body)', fontSize: '0.875rem', color: '#6b7280', margin: 0 }}>
          {filtered.length} result{filtered.length !== 1 ? 's' : ''}
        </p>
      </div>

      {/* Status summary */}
      <div style={{ background: '#fff', border: '1px solid #e5e7eb', borderRadius: '8px', padding: '1rem 1.5rem', marginBottom: '1rem', display: 'flex', gap: '2rem', flexWrap: 'wrap', alignItems: 'center' }}>
        {[
          { label: 'Active',    value: summary.active,     color: '#16a34a' },
          { label: 'Pending',   value: summary.pending,    color: '#d97706' },
          { label: 'Cancelled', value: summary.cancelled,  color: '#b40000' },
          { label: '|', value: null },
          { label: 'Paid',      value: summary.paid,       color: '#16a34a' },
          { label: 'Pay Pending', value: summary.payPending, color: '#d97706' },
          { label: 'Overdue',   value: summary.overdue,    color: '#b40000' },
          { label: '|', value: null },
          { label: 'Fin. Aid',  value: summary.fa,         color: '#7c3aed' },
        ].map((s, i) => s.value === null ? (
          <div key={i} style={{ width: '1px', height: '32px', background: '#e5e7eb' }} />
        ) : (
          <div key={s.label} style={{ textAlign: 'center' }}>
            <p style={{ fontFamily: 'var(--font-display)', fontSize: '1.25rem', fontWeight: 800, color: s.color, margin: 0, lineHeight: 1 }}>{s.value}</p>
            <p style={{ fontFamily: 'var(--font-display)', fontSize: '0.6rem', fontWeight: 600, letterSpacing: '0.08em', textTransform: 'uppercase', color: '#9ca3af', margin: '2px 0 0 0', whiteSpace: 'nowrap' }}>{s.label}</p>
          </div>
        ))}
      </div>

      {/* Filters */}
      <div style={{ background: '#fff', border: '1px solid #e5e7eb', borderRadius: '8px', padding: '0.875rem 1.25rem', marginBottom: '1rem', display: 'flex', gap: '0.75rem', flexWrap: 'wrap', alignItems: 'center' }}>
        <span style={{ fontFamily: 'var(--font-display)', fontSize: '0.65rem', fontWeight: 600, letterSpacing: '0.1em', textTransform: 'uppercase', color: '#6b7280' }}>Filter:</span>

        <a href={buildUrl({ program: '' })} style={{ ...selectStyle, textDecoration: 'none', padding: '0.4rem 0.75rem', background: !filterProgram ? '#111' : '#fff', color: !filterProgram ? '#fff' : '#374151' }}>
          All Programs
        </a>
        {(programs || []).map(p => (
          <a key={p.id} href={buildUrl({ program: p.id })} style={{ ...selectStyle, textDecoration: 'none', background: filterProgram === p.id ? '#111' : '#fff', color: filterProgram === p.id ? '#fff' : '#374151' }}>
            {p.label}
          </a>
        ))}

        <div style={{ width: '1px', height: '24px', background: '#e5e7eb' }} />

        <select
          value={filterRegStatus}
          onChange={undefined}
          style={selectStyle}
        >
          <option value="">All Reg Statuses</option>
          {(regStatuses || []).map(s => <option key={s.id} value={s.label}>{s.label}</option>)}
        </select>

        <select
          value={filterPayStatus}
          onChange={undefined}
          style={selectStyle}
        >
          <option value="">All Pay Statuses</option>
          {(payStatuses || []).map(s => <option key={s.id} value={s.label}>{s.label}</option>)}
        </select>

        {(filterProgram || filterRegStatus || filterPayStatus) && (
          <a href="/backstage/registrations" style={{ fontFamily: 'var(--font-display)', fontSize: '0.65rem', fontWeight: 600, letterSpacing: '0.08em', textTransform: 'uppercase', color: '#b40000', textDecoration: 'none' }}>
            ✕ Clear
          </a>
        )}
      </div>

      {/* Table */}
      <div style={{ background: '#fff', border: '1px solid #e5e7eb', borderRadius: '8px', overflow: 'hidden' }}>
        {/* Header */}
        <div style={{ display: 'grid', gridTemplateColumns: '140px 1fr 100px 160px 140px 140px 110px', background: '#f9fafb', borderBottom: '1px solid #e5e7eb' }}>
          {['Date', 'Participant', 'Grade', 'Program', 'Reg Status', 'Pay Status', 'Amount'].map(col => (
            <div key={col} style={{ padding: '0.625rem 1rem', fontFamily: 'var(--font-display)', fontSize: '0.65rem', fontWeight: 600, letterSpacing: '0.1em', textTransform: 'uppercase', color: '#6b7280' }}>
              {col}
            </div>
          ))}
        </div>

        {filtered.length === 0 ? (
          <div style={{ padding: '3rem', textAlign: 'center', fontFamily: 'var(--font-body)', color: '#9ca3af', fontStyle: 'italic' }}>
            No registrations match your filters.
          </div>
        ) : filtered.map((reg, i) => {
          const p         = reg.participants;
          const progId    = reg.cart_id ? cartProgramMap[reg.cart_id] : null;
          const progLabel = programs?.find(pr => pr.id === progId)?.label || '—';
          const regStatus = reg.registration_statuses?.label || 'Pending';
          const payStatus = derivePayStatus(reg);
          const balance   = (parseFloat(reg.total_fee) || 0) - (parseFloat(reg.amount_paid) || 0);

          return (
            <Link
              key={reg.id}
              href={`/backstage/registrations/${reg.id}`}
              style={{
                display: 'grid', gridTemplateColumns: '140px 1fr 100px 160px 140px 140px 110px',
                borderBottom: i < filtered.length - 1 ? '1px solid #f3f4f6' : 'none',
                textDecoration: 'none',
                background: i % 2 === 0 ? '#ffffff' : '#fafafa',
                transition: 'background 0.1s',
              }}
            >
              <div style={{ padding: '0.75rem 1rem', fontFamily: 'var(--font-body)', fontSize: '0.8rem', color: '#6b7280', display: 'flex', alignItems: 'center' }}>
                {fmtDate(reg.registered_at)}
              </div>
              <div style={{ padding: '0.75rem 1rem', display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
                <p style={{ fontFamily: 'var(--font-body)', fontSize: '0.875rem', fontWeight: 600, color: '#111', margin: 0 }}>
                  {displayName(p)}
                  {reg.is_financial_aid_requested && (
                    <span style={{ marginLeft: '0.4rem', fontFamily: 'var(--font-display)', fontSize: '0.55rem', fontWeight: 700, letterSpacing: '0.08em', color: '#7c3aed', background: '#f5f3ff', border: '1px solid #ddd6fe', borderRadius: '3px', padding: '0.1rem 0.35rem' }}>FA</span>
                  )}
                </p>
                <p style={{ fontFamily: 'var(--font-body)', fontSize: '0.75rem', color: '#9ca3af', margin: 0 }}>#{reg.registration_number}</p>
              </div>
              <div style={{ padding: '0.75rem 1rem', fontFamily: 'var(--font-body)', fontSize: '0.85rem', color: '#374151', display: 'flex', alignItems: 'center' }}>
                {getGrade(p?.yog)}
              </div>
              <div style={{ padding: '0.75rem 1rem', fontFamily: 'var(--font-body)', fontSize: '0.85rem', color: '#374151', display: 'flex', alignItems: 'center' }}>
                {progLabel}
              </div>
              <div style={{ padding: '0.75rem 1rem', display: 'flex', alignItems: 'center' }}>
                <StatusBadge label={regStatus} />
              </div>
              <div style={{ padding: '0.75rem 1rem', display: 'flex', alignItems: 'center' }}>
                <StatusBadge label={payStatus} />
              </div>
              <div style={{ padding: '0.75rem 1rem', display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
                <span style={{ fontFamily: 'var(--font-body)', fontSize: '0.875rem', color: '#111' }}>{fmt(reg.amount_paid)}</span>
                {balance > 0.01 && (
                  <span style={{ fontFamily: 'var(--font-body)', fontSize: '0.7rem', color: '#b40000' }}>{fmt(balance)} due</span>
                )}
              </div>
            </Link>
          );
        })}
      </div>
    </div>
  );
}