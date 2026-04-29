import { createClient } from '@/lib/supabase/server';
import { redirect } from 'next/navigation';
import Image from 'next/image';

function fmt(amount) {
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(Number(amount) || 0);
}

function fmtDate(str) {
  if (!str) return '—';
  return new Date(str).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' });
}

function fmtDateTime(str) {
  if (!str) return '—';
  return new Date(str).toLocaleDateString('en-US', {
    month: 'short', day: 'numeric', year: 'numeric',
    hour: 'numeric', minute: '2-digit',
  });
}

function displayName(p) {
  if (!p) return '—';
  if (p.nickname) return `"${p.nickname}" ${p.last_name}`;
  return `${p.first_name} ${p.last_name}`;
}

export default async function PaymentsPage() {
  const supabase = await createClient();

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  const { data: profile } = await supabase
    .from('profiles')
    .select('family_id')
    .eq('id', user.id)
    .single();

  const familyId = profile?.family_id;

  // Fetch payments — join only through registrations and participants (no carts→programs)
  const { data: payments } = await supabase
    .from('payments')
    .select(`
      id, amount, paid_at, created_at,
      stripe_payment_intent_id,
      payment_statuses(label),
      payment_types(label),
      registrations(
        id, registration_number, total_fee, amount_paid,
        participants(first_name, last_name, nickname)
      )
    `)
    .eq('family_id', familyId)
    .order('paid_at', { ascending: false });

  // Fetch registrations with outstanding balances
  // Join programs via session to get label — use a simpler path
  const { data: registrations } = await supabase
    .from('registrations')
    .select(`
      id, registration_number, total_fee, amount_paid,
      is_financial_aid_requested,
      participants(first_name, last_name, nickname)
    `)
    .eq('family_id', familyId)
    .order('registered_at', { ascending: false });

  const outstandingRegs = (registrations || []).filter(r => {
    const balance = (r.total_fee || 0) - (r.amount_paid || 0);
    return balance > 0.01 && !r.is_financial_aid_requested;
  });

  const totalPaid      = (payments || []).reduce((sum, p) => sum + (parseFloat(p.amount) || 0), 0);
  const totalOutstanding = outstandingRegs.reduce((sum, r) => sum + ((r.total_fee || 0) - (r.amount_paid || 0)), 0);

  return (
    <div style={{ minHeight: '100vh', background: 'var(--bg-dark)' }}>

      {/* Nav */}
      <nav style={{ background: 'var(--bg-card)', borderBottom: '1px solid var(--border)', padding: '0 1.5rem', display: 'flex', alignItems: 'center', justifyContent: 'space-between', height: '64px', position: 'sticky', top: 0, zIndex: 100 }}>
        <a href="/dashboard" style={{ display: 'flex', alignItems: 'center', textDecoration: 'none' }}>
          <Image src="/images/tyt-logo.png" alt="Triboro Youth Theatre" width={48} height={48} style={{ objectFit: 'contain' }} />
        </a>
        <span style={{ fontFamily: 'var(--font-display)', fontSize: '1.1rem', fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase', color: 'var(--text-primary)' }}>
          Payment History
        </span>
        <a href="/dashboard" style={{ fontFamily: 'var(--font-display)', fontSize: '0.75rem', fontWeight: 600, letterSpacing: '0.1em', textTransform: 'uppercase', color: 'var(--gold)', textDecoration: 'none', border: '1px solid var(--gold)', borderRadius: 'var(--radius-sm)', padding: '0.35rem 0.85rem' }}>
          ← Back
        </a>
      </nav>

      <main style={{ maxWidth: '700px', margin: '0 auto', padding: '2rem 1.5rem' }}>

        <h1 style={{ fontFamily: 'var(--font-display)', fontSize: '2rem', fontWeight: 800, letterSpacing: '0.05em', textTransform: 'uppercase', color: 'var(--text-primary)', marginBottom: '0.25rem' }}>
          Payment History
        </h1>
        <p style={{ fontFamily: 'var(--font-accent)', fontStyle: 'italic', color: 'var(--text-muted)', fontSize: '0.95rem', marginBottom: '2rem' }}>
          All payments made to Triboro Youth Theatre.
        </p>

        {/* Summary cards */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem', marginBottom: '2rem' }}>
          <div style={{ background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 'var(--radius-md)', padding: '1.25rem' }}>
            <p style={{ fontFamily: 'var(--font-display)', fontSize: '0.65rem', fontWeight: 600, letterSpacing: '0.12em', textTransform: 'uppercase', color: 'var(--text-faint)', marginBottom: '0.4rem' }}>Total Paid</p>
            <p style={{ fontFamily: 'var(--font-display)', fontSize: '1.75rem', fontWeight: 800, color: 'var(--gold)', lineHeight: 1 }}>{fmt(totalPaid)}</p>
          </div>
          <div style={{ background: totalOutstanding > 0 ? '#1a0a0a' : 'var(--bg-card)', border: `1px solid ${totalOutstanding > 0 ? 'var(--red)' : 'var(--border)'}`, borderRadius: 'var(--radius-md)', padding: '1.25rem' }}>
            <p style={{ fontFamily: 'var(--font-display)', fontSize: '0.65rem', fontWeight: 600, letterSpacing: '0.12em', textTransform: 'uppercase', color: 'var(--text-faint)', marginBottom: '0.4rem' }}>Outstanding Balance</p>
            <p style={{ fontFamily: 'var(--font-display)', fontSize: '1.75rem', fontWeight: 800, color: totalOutstanding > 0 ? 'var(--red)' : 'var(--gold)', lineHeight: 1 }}>{fmt(totalOutstanding)}</p>
          </div>
        </div>

        {/* Outstanding balances */}
        {outstandingRegs.length > 0 && (
          <div style={{ marginBottom: '2rem' }}>
            <h2 style={{ fontFamily: 'var(--font-display)', fontSize: '1rem', fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase', color: 'var(--red)', marginBottom: '0.75rem' }}>
              Outstanding Balances
            </h2>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
              {outstandingRegs.map(r => {
                const balance = (r.total_fee || 0) - (r.amount_paid || 0);
                return (
                  <div key={r.id} style={{ background: '#1a0a0a', border: '1px solid var(--red)', borderRadius: 'var(--radius-md)', padding: '1rem 1.25rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '1rem', flexWrap: 'wrap' }}>
                    <div>
                      <p style={{ fontFamily: 'var(--font-display)', fontSize: '0.9rem', fontWeight: 700, color: 'var(--text-primary)', marginBottom: '0.15rem' }}>
                        {displayName(r.participants)}
                      </p>
                      <p style={{ fontFamily: 'var(--font-body)', fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                        #{r.registration_number}
                      </p>
                    </div>
                    <div style={{ textAlign: 'right' }}>
                      <p style={{ fontFamily: 'var(--font-display)', fontSize: '1.2rem', fontWeight: 800, color: 'var(--red)' }}>{fmt(balance)}</p>
                      <p style={{ fontFamily: 'var(--font-body)', fontSize: '0.7rem', color: 'var(--text-faint)' }}>+ 5% processing fee</p>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Payment records */}
        <h2 style={{ fontFamily: 'var(--font-display)', fontSize: '1rem', fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase', color: 'var(--text-primary)', marginBottom: '0.75rem' }}>
          Payment Records
        </h2>

        {payments && payments.length > 0 ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
            {payments.map(p => {
              const reg = p.registrations;
              const typeLabel   = p.payment_types?.label   || '—';
              const statusLabel = p.payment_statuses?.label || '—';
              const isPaid      = statusLabel.toLowerCase() === 'paid';

              return (
                <div key={p.id} style={{ background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 'var(--radius-md)', padding: '1rem 1.25rem' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '1rem', flexWrap: 'wrap' }}>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.2rem', flexWrap: 'wrap' }}>
                        <p style={{ fontFamily: 'var(--font-display)', fontSize: '0.9rem', fontWeight: 700, color: 'var(--text-primary)' }}>
                          {displayName(reg?.participants)}
                        </p>
                        <span style={{ fontFamily: 'var(--font-display)', fontSize: '0.6rem', fontWeight: 600, letterSpacing: '0.08em', textTransform: 'uppercase', padding: '0.1rem 0.4rem', borderRadius: '3px', border: `1px solid ${isPaid ? '#22c55e' : 'var(--border)'}`, color: isPaid ? '#22c55e' : 'var(--text-faint)' }}>
                          {statusLabel}
                        </span>
                        <span style={{ fontFamily: 'var(--font-display)', fontSize: '0.6rem', fontWeight: 600, letterSpacing: '0.08em', textTransform: 'uppercase', padding: '0.1rem 0.4rem', borderRadius: '3px', border: '1px solid var(--border)', color: 'var(--text-faint)' }}>
                          {typeLabel}
                        </span>
                      </div>
                      {reg?.registration_number && (
                        <p style={{ fontFamily: 'var(--font-body)', fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                          #{reg.registration_number}
                        </p>
                      )}
                      <p style={{ fontFamily: 'var(--font-body)', fontSize: '0.75rem', color: 'var(--text-faint)', marginTop: '0.2rem' }}>
                        {fmtDateTime(p.paid_at || p.created_at)}
                      </p>
                    </div>
                    <div style={{ textAlign: 'right', flexShrink: 0 }}>
                      <p style={{ fontFamily: 'var(--font-display)', fontSize: '1.1rem', fontWeight: 800, color: 'var(--gold)' }}>
                        {fmt(p.amount)}
                      </p>
                      {p.stripe_payment_intent_id && (
                        <p style={{ fontFamily: 'var(--font-body)', fontSize: '0.65rem', color: 'var(--text-faint)', marginTop: '0.2rem' }}>
                          {p.stripe_payment_intent_id.slice(-8)}
                        </p>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        ) : (
          <div style={{ background: 'var(--bg-card)', border: '1px dashed var(--border)', borderRadius: 'var(--radius-md)', padding: '3rem', textAlign: 'center' }}>
            <p style={{ fontFamily: 'var(--font-accent)', fontStyle: 'italic', color: 'var(--text-muted)' }}>No payments on record yet.</p>
          </div>
        )}

      </main>
    </div>
  );
}