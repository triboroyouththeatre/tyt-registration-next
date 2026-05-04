import { createClient } from '@/lib/supabase/server';
import { redirect } from 'next/navigation';
import Image from 'next/image';
import LogoutButton from '@/components/LogoutButton';

function fmt(amount) {
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(Number(amount) || 0);
}

function fmtDate(str) {
  if (!str) return '—';
  return new Date(str + 'T00:00:00').toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' });
}

function Row({ label, value, valueColor }) {
  return (
    <div style={{
      display: 'flex', justifyContent: 'space-between', alignItems: 'baseline',
      gap: '1rem', padding: '0.75rem 0',
      borderBottom: '1px solid var(--border)',
    }}>
      <span style={{
        fontFamily: 'var(--font-display)', fontSize: '0.7rem', fontWeight: 600,
        letterSpacing: '0.1em', textTransform: 'uppercase', color: 'var(--text-faint)',
        flexShrink: 0,
      }}>
        {label}
      </span>
      <span style={{
        fontFamily: 'var(--font-body)', fontSize: '0.9rem',
        color: valueColor || 'var(--text-primary)', textAlign: 'right',
      }}>
        {value}
      </span>
    </div>
  );
}

export default async function RegistrationDetailPage({ params }) {
  const { id: registrationId } = await params;

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  const { data: profile } = await supabase
    .from('profiles').select('family_id').eq('id', user.id).single();

  const { data: reg } = await supabase
    .from('registrations')
    .select(`
      id, registration_number, amount_paid, total_fee,
      is_financial_aid_requested, registered_at,
      participants(first_name, last_name, nickname, yog),
      registration_statuses(label),
      award_levels(label),
      carts(
        programs(
          label, fee, deposit_amount, balance_due_date,
          sessions(name, seasons(display_name, name))
        )
      ),
      health_records(
        academic_flag, behavioral_flag, allergies_flag, epipen,
        asthma, concussion_flag, general_comments
      ),
      payments(amount, paid_at, payment_method)
    `)
    .eq('id', registrationId)
    .eq('family_id', profile.family_id)
    .single();

  if (!reg) redirect('/dashboard');

  const p           = reg.participants;
  const program     = reg.carts?.programs;
  const session     = program?.sessions;
  const season      = session?.seasons;
  const health      = Array.isArray(reg.health_records) ? reg.health_records[0] : reg.health_records;
  const balance     = Math.max(0, (reg.total_fee || 0) - (reg.amount_paid || 0));
  const participantName = p?.nickname
    ? `${p.nickname} ${p.last_name}`
    : `${p?.first_name} ${p?.last_name}`;
  const seasonDisplay = season?.display_name || season?.name || '';

  const healthFlags = [];
  if (health) {
    if (health.academic_flag)   healthFlags.push('Academic');
    if (health.behavioral_flag) healthFlags.push('Behavioral');
    if (health.allergies_flag)  healthFlags.push(health.epipen ? 'Allergies (EpiPen)' : 'Allergies');
    if (health.asthma)          healthFlags.push('Asthma');
    if (health.concussion_flag) healthFlags.push('Concussion history');
  }

  return (
    <>
      <style>{`
        .section-card {
          background: var(--bg-card);
          border: 1px solid var(--border);
          border-radius: var(--radius-md);
          padding: 1.5rem;
          margin-bottom: 1.25rem;
        }
        .section-label {
          font-family: var(--font-display);
          font-size: 0.65rem;
          font-weight: 700;
          letter-spacing: 0.12em;
          text-transform: uppercase;
          color: var(--text-faint);
          margin-bottom: 0.75rem;
        }
      `}</style>

      <div style={{ minHeight: '100vh', background: 'var(--bg-dark)' }}>
        <nav style={{
          background: 'var(--bg-card)', borderBottom: '1px solid var(--border)',
          padding: '0 1.5rem', display: 'flex', alignItems: 'center',
          justifyContent: 'space-between', height: '64px',
          position: 'sticky', top: 0, zIndex: 100,
        }}>
          <a href="/dashboard">
            <Image src="/images/tyt-logo.png" alt="Triboro Youth Theatre" width={48} height={48} style={{ objectFit: 'contain' }} priority />
          </a>
          <span style={{ fontFamily: 'var(--font-display)', fontSize: '1.1rem', fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase', color: 'var(--text-primary)' }}>
            Registration
          </span>
          <LogoutButton />
        </nav>

        <main style={{ maxWidth: '680px', margin: '0 auto', padding: '2rem 1.5rem' }}>

          <a href="/dashboard" style={{ fontFamily: 'var(--font-display)', fontSize: '0.75rem', fontWeight: 600, letterSpacing: '0.1em', textTransform: 'uppercase', color: 'var(--text-faint)', textDecoration: 'none', display: 'inline-flex', alignItems: 'center', gap: '0.4rem', marginBottom: '1.5rem' }}>
            ← Dashboard
          </a>

          {/* Header */}
          <div style={{ marginBottom: '1.5rem' }}>
            <h1 style={{ fontFamily: 'var(--font-display)', fontSize: '1.6rem', fontWeight: 800, letterSpacing: '0.05em', textTransform: 'uppercase', color: 'var(--text-primary)', marginBottom: '0.25rem' }}>
              {participantName}
            </h1>
            <p style={{ fontFamily: 'var(--font-accent)', fontStyle: 'italic', color: 'var(--text-muted)', fontSize: '0.95rem' }}>
              {program?.label || '—'}{seasonDisplay ? ` · ${seasonDisplay} Season` : ''}
            </p>
          </div>

          {/* Registration details */}
          <div className="section-card">
            <p className="section-label">Registration Details</p>
            <Row label="Registration #"  value={`#${reg.registration_number}`} valueColor="var(--gold)" />
            <Row label="Status"          value={reg.registration_statuses?.label || '—'} />
            <Row label="Award Level"     value={reg.award_levels?.label || 'No Award'} />
            <Row label="Registered"      value={reg.registered_at ? new Date(reg.registered_at).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' }) : '—'} />
            {program?.balance_due_date && (
              <Row label="Balance Due Date" value={fmtDate(program.balance_due_date)} />
            )}
          </div>

          {/* Payment summary */}
          <div className="section-card">
            <p className="section-label">Payment</p>
            <Row label="Program Fee"  value={fmt(reg.total_fee)} />
            <Row label="Amount Paid"  value={fmt(reg.amount_paid)} />
            {balance > 0.01 ? (
              <Row label="Balance Due" value={fmt(balance)} valueColor="var(--red)" />
            ) : (
              <Row label="Balance Due" value="Paid in full" valueColor="var(--gold)" />
            )}
            {reg.is_financial_aid_requested && (
              <p style={{ fontFamily: 'var(--font-body)', fontSize: '0.8rem', color: '#d97706', marginTop: '0.75rem' }}>
                ⚠ Financial aid application submitted — TYT will review and adjust your balance.
              </p>
            )}
          </div>

          {/* Health information */}
          {health && (
            <div className="section-card">
              <p className="section-label">Health Information</p>
              {healthFlags.length > 0 ? (
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem', marginBottom: health.general_comments ? '0.75rem' : 0 }}>
                  {healthFlags.map(flag => (
                    <span key={flag} style={{
                      fontFamily: 'var(--font-display)', fontSize: '0.7rem', fontWeight: 600,
                      letterSpacing: '0.08em', textTransform: 'uppercase',
                      color: 'var(--red)', background: '#1a0505',
                      border: '1px solid var(--red)', borderRadius: '3px',
                      padding: '0.2rem 0.6rem',
                    }}>
                      {flag}
                    </span>
                  ))}
                </div>
              ) : (
                <p style={{ fontFamily: 'var(--font-body)', fontSize: '0.875rem', color: 'var(--text-muted)' }}>No flags noted</p>
              )}
              {health.general_comments && (
                <p style={{ fontFamily: 'var(--font-body)', fontSize: '0.875rem', color: 'var(--text-muted)', marginTop: '0.75rem', fontStyle: 'italic' }}>
                  {health.general_comments}
                </p>
              )}
            </div>
          )}

        </main>
      </div>
    </>
  );
}
