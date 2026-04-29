'use client';

import { useState, useEffect } from 'react';
import { useParams, useSearchParams } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import Image from 'next/image';
import Link from 'next/link';

const AWARD_LEVELS = {
  '386e44d8-0a4d-4462-85f1-adaa8231a287': 'No Award',
  'a502ce6b-bb14-4d74-b46e-48f2a99b9066': '5 Show Award',
  '7dbcd732-c2d9-4571-ae2f-32ee7cde1a7e': '10 Show Award',
  '6d2de5d1-55aa-4939-a87f-dbd34cc640db': '15 Show Award',
  '09479537-63e1-44f5-bd2e-20e84ac66dd1': '20 Show Award',
  '576fad59-97da-45b8-9b77-5b61641f4127': '25 Show Award',
  '73278f6a-a642-4ad3-ad4d-d6012b9a0a03': '30 Show Award',
  '4ee7fa1e-e3e8-485b-bb61-3e8a4949a869': '35 Show Award',
};

function fmt(amount) {
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(Number(amount) || 0);
}

function fmtDate(str) {
  if (!str) return '';
  return new Date(str + 'T00:00:00').toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' });
}

function Row({ label, value, highlight }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', gap: '1rem', paddingBottom: '0.5rem', marginBottom: '0.5rem', borderBottom: '1px solid var(--border)' }}>
      <span style={{ fontFamily: 'var(--font-display)', fontSize: '0.7rem', fontWeight: 600, letterSpacing: '0.1em', textTransform: 'uppercase', color: 'var(--text-faint)', flexShrink: 0 }}>
        {label}
      </span>
      <span style={{ fontFamily: 'var(--font-body)', fontSize: '0.875rem', color: highlight ? 'var(--gold)' : 'var(--text-primary)', textAlign: 'right', fontWeight: highlight ? 700 : 400 }}>
        {value}
      </span>
    </div>
  );
}

export default function ConfirmationPage() {
  const params = useParams();
  const searchParams = useSearchParams();
  const programId     = params?.id;
  const participantId = searchParams?.get('participant');

  const [status, setStatus]   = useState('loading');
  const [registrations, setRegistrations] = useState([]);
  const [program, setProgram] = useState(null);
  const [season, setSeason]   = useState('');
  const [gradeLevels, setGradeLevels] = useState([]);
  const [emailSent, setEmailSent] = useState(false);

  useEffect(() => {
    if (!programId || !participantId) { setStatus('error'); return; }

    async function load() {
      try {
        const supabase = createClient();

        const { data: { user } } = await supabase.auth.getUser();
        const { data: profile }  = await supabase.from('profiles').select('family_id').eq('id', user.id).single();

        // Fetch all registrations from this session's cart
        // Find registrations tied to this participant's most recent cart
        const { data: regs, error: regErr } = await supabase
          .from('registrations')
          .select(`
            id, registration_number, amount_paid, total_fee,
            is_financial_aid_requested, award_level_id,
            participants(first_name, last_name, yog),
            health_records(
              academic_flag, academic_notes,
              behavioral_flag, behavioral_notes,
              allergies_flag, allergies_notes, epipen,
              asthma,
              concussion_flag, concussion_date,
              general_comments
            ),
            carts!inner(
              id, stripe_payment_intent_id,
              programs:programs!inner(id, label, fee, deposit_amount, balance_due_date,
                sessions!inner(name, seasons!inner(name, display_name))
              )
            )
          `)
          .eq('family_id', profile.family_id)
          .eq('carts.programs.id', programId)
          .order('registered_at', { ascending: false })
          .limit(10);

        if (regErr || !regs?.length) throw new Error('No registrations found');

        // Get the most recent cart — all regs in same cart
        const latestCartId = regs[0]?.carts?.id;
        const cartRegs = regs.filter(r => r.carts?.id === latestCartId);

        // Grade levels
        const { data: grades } = await supabase
          .from('grade_levels')
          .select('yog, label, seasons!inner(is_active)')
          .eq('seasons.is_active', true);

        const prog = cartRegs[0]?.carts?.programs;
        const sess = prog?.sessions;

        setRegistrations(cartRegs);
        setProgram(prog);
        setSeason(sess?.seasons?.display_name || sess?.seasons?.name || '');
        setGradeLevels(grades || []);
        setStatus('ready');

        // Send confirmation email (fire and forget)
        if (!emailSent) {
          setEmailSent(true);
          fetch('/api/send-confirmation', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ registrationIds: cartRegs.map(r => r.id) }),
          }).catch(err => console.error('[Confirmation] Email error:', err));
        }

      } catch (err) {
        console.error('[ConfirmationPage] error:', err);
        setStatus('error');
      }
    }

    load();
  }, [programId, participantId]);

  function getGrade(yog) {
    return gradeLevels?.find(g => g.yog === yog)?.label || `Class of ${yog}`;
  }

  return (
    <div style={{ minHeight: '100vh', background: 'var(--bg-dark)' }}>

      {/* Nav */}
      <nav style={{ background: 'var(--bg-card)', borderBottom: '1px solid var(--border)', padding: '0 1.5rem', display: 'flex', alignItems: 'center', justifyContent: 'space-between', height: '64px', position: 'sticky', top: 0, zIndex: 100 }}>
        <a href="/dashboard" style={{ display: 'flex', alignItems: 'center', textDecoration: 'none' }}>
          <Image src="/images/tyt-logo.png" alt="Triboro Youth Theatre" width={48} height={48} style={{ objectFit: 'contain' }} />
        </a>
        <span style={{ fontFamily: 'var(--font-display)', fontSize: '1.1rem', fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase', color: 'var(--text-primary)' }}>
          Registration
        </span>
        <div style={{ width: '80px' }} />
      </nav>

      <main style={{ maxWidth: '680px', margin: '0 auto', padding: '2rem 1.5rem' }}>

        {status === 'loading' && (
          <div style={{ textAlign: 'center', padding: '4rem', fontFamily: 'var(--font-accent)', fontStyle: 'italic', color: 'var(--text-muted)' }}>
            Loading your confirmation...
          </div>
        )}

        {status === 'error' && (
          <div>
            <div className="tyt-error" style={{ marginBottom: '1rem' }}>
              Could not load your registration details. Your payment was processed — please contact us if you need assistance.
            </div>
            <Link href="/dashboard" className="tyt-btn tyt-btn-secondary" style={{ display: 'inline-flex' }}>
              ← Back to Dashboard
            </Link>
          </div>
        )}

        {status === 'ready' && (
          <>
            {/* Hero */}
            <div style={{ textAlign: 'center', marginBottom: '2rem' }}>
              <div style={{ width: '64px', height: '64px', borderRadius: '50%', background: '#0a1a0a', border: '2px solid #22c55e', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 1rem', fontSize: '1.75rem' }}>
                ✓
              </div>
              <h1 style={{ fontFamily: 'var(--font-display)', fontSize: '1.75rem', fontWeight: 800, letterSpacing: '0.05em', textTransform: 'uppercase', color: 'var(--text-primary)', marginBottom: '0.5rem' }}>
                Thank You for Registering!
              </h1>
              <p style={{ fontFamily: 'var(--font-body)', fontSize: '1rem', color: 'var(--text-muted)' }}>
                {program?.label}{season ? ` · ${season} Season` : ''}
              </p>
              <p style={{ fontFamily: 'var(--font-accent)', fontStyle: 'italic', fontSize: '0.9rem', color: 'var(--text-faint)', marginTop: '0.5rem' }}>
                A confirmation email has been sent to your account email address.
              </p>
            </div>

            {/* One card per registration */}
            {registrations.map((reg, i) => {
              const p    = reg.participants;
              const h    = reg.health_records?.[0];
              const balance = (reg.total_fee || 0) - (reg.amount_paid || 0);

              return (
                <div key={reg.id} style={{ background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 'var(--radius-md)', overflow: 'hidden', marginBottom: '1.25rem' }}>

                  {/* Card header */}
                  <div style={{ background: 'var(--bg-hover)', borderBottom: '1px solid var(--border)', padding: '0.875rem 1.25rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <div>
                      <p style={{ fontFamily: 'var(--font-display)', fontSize: '0.65rem', fontWeight: 600, letterSpacing: '0.1em', textTransform: 'uppercase', color: 'var(--text-faint)', marginBottom: '0.15rem' }}>
                        Registration {registrations.length > 1 ? i + 1 : ''}
                      </p>
                      <p style={{ fontFamily: 'var(--font-display)', fontSize: '1.1rem', fontWeight: 800, color: 'var(--text-primary)' }}>
                        {p?.first_name} {p?.last_name}
                      </p>
                      <p style={{ fontFamily: 'var(--font-body)', fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                        {getGrade(p?.yog)}
                      </p>
                    </div>
                    <div style={{ textAlign: 'right' }}>
                      <p style={{ fontFamily: 'var(--font-display)', fontSize: '0.65rem', fontWeight: 600, letterSpacing: '0.1em', textTransform: 'uppercase', color: 'var(--text-faint)', marginBottom: '0.2rem' }}>Reg #</p>
                      <p style={{ fontFamily: 'var(--font-display)', fontSize: '0.9rem', fontWeight: 700, color: 'var(--gold)' }}>{reg.registration_number}</p>
                    </div>
                  </div>

                  <div style={{ padding: '1.25rem' }}>

                    {/* Program & award */}
                    <div style={{ marginBottom: '1rem' }}>
                      <Row label="Program" value={program?.label} />
                      <Row label="Award Level" value={AWARD_LEVELS[reg.award_level_id] || 'No Award'} />
                    </div>

                    {/* Health summary */}
                    {h && (
                      <div style={{ marginBottom: '1rem' }}>
                        <p style={{ fontFamily: 'var(--font-display)', fontSize: '0.7rem', fontWeight: 600, letterSpacing: '0.1em', textTransform: 'uppercase', color: 'var(--text-faint)', marginBottom: '0.5rem' }}>
                          Health Information
                        </p>
                        {[
                          { label: 'Academic Considerations', flag: h.academic_flag, notes: h.academic_notes },
                          { label: 'Behavioral Considerations', flag: h.behavioral_flag, notes: h.behavioral_notes },
                          { label: 'Allergies', flag: h.allergies_flag, notes: h.allergies_notes, extra: h.epipen ? 'EpiPen: Yes' : null },
                          { label: 'Asthma', flag: h.asthma },
                          { label: 'Concussion History', flag: h.concussion_flag, notes: h.concussion_date ? `Date: ${fmtDate(h.concussion_date)}` : null },
                        ].map(item => (
                          <div key={item.label} style={{ display: 'flex', gap: '0.5rem', marginBottom: '0.4rem', alignItems: 'flex-start' }}>
                            <span style={{ fontFamily: 'var(--font-display)', fontSize: '0.65rem', fontWeight: 700, letterSpacing: '0.06em', padding: '0.15rem 0.4rem', borderRadius: '3px', flexShrink: 0, border: `1px solid ${item.flag ? 'var(--red)' : 'var(--border)'}`, color: item.flag ? 'var(--red)' : 'var(--text-faint)', background: item.flag ? '#1a0505' : 'transparent' }}>
                              {item.flag ? 'YES' : 'NO'}
                            </span>
                            <div>
                              <span style={{ fontFamily: 'var(--font-body)', fontSize: '0.8rem', color: 'var(--text-primary)' }}>{item.label}</span>
                              {item.flag && item.notes && <p style={{ fontFamily: 'var(--font-body)', fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '0.1rem' }}>{item.notes}</p>}
                              {item.flag && item.extra && <p style={{ fontFamily: 'var(--font-body)', fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '0.1rem' }}>{item.extra}</p>}
                            </div>
                          </div>
                        ))}
                        {h.general_comments && (
                          <div style={{ marginTop: '0.5rem', padding: '0.5rem 0.75rem', background: 'var(--bg-hover)', borderRadius: 'var(--radius-sm)' }}>
                            <p style={{ fontFamily: 'var(--font-display)', fontSize: '0.65rem', fontWeight: 600, letterSpacing: '0.08em', textTransform: 'uppercase', color: 'var(--text-faint)', marginBottom: '0.2rem' }}>Additional Comments</p>
                            <p style={{ fontFamily: 'var(--font-body)', fontSize: '0.8rem', color: 'var(--text-muted)' }}>{h.general_comments}</p>
                          </div>
                        )}
                      </div>
                    )}

                    {/* Payment summary */}
                    <div style={{ borderTop: '1px solid var(--border)', paddingTop: '1rem' }}>
                      <p style={{ fontFamily: 'var(--font-display)', fontSize: '0.7rem', fontWeight: 600, letterSpacing: '0.1em', textTransform: 'uppercase', color: 'var(--text-faint)', marginBottom: '0.5rem' }}>
                        Payment
                      </p>
                      <Row label="Amount Paid Today" value={fmt(reg.amount_paid)} highlight />
                      {balance > 0 && (
                        <>
                          <Row label="Balance Due" value={`${fmt(balance)} + 5% fee`} />
                          {program?.balance_due_date && (
                            <Row label="Balance Due Date" value={fmtDate(program.balance_due_date)} />
                          )}
                        </>
                      )}
                      {reg.is_financial_aid_requested && (
                        <div style={{ marginTop: '0.5rem', padding: '0.5rem 0.75rem', background: '#1a0d00', borderRadius: 'var(--radius-sm)', border: '1px solid #b8860b' }}>
                          <p style={{ fontFamily: 'var(--font-body)', fontSize: '0.8rem', color: '#e0bf5c' }}>
                            Financial aid application submitted — TYT will review and adjust your balance.
                          </p>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}

            {/* Additional info notice */}
            <div style={{ background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 'var(--radius-md)', padding: '1.25rem', marginBottom: '1.5rem' }}>
              <p style={{ fontFamily: 'var(--font-display)', fontSize: '0.75rem', fontWeight: 600, letterSpacing: '0.1em', textTransform: 'uppercase', color: 'var(--text-faint)', marginBottom: '0.5rem' }}>
                What's Next
              </p>
              <p style={{ fontFamily: 'var(--font-body)', fontSize: '0.875rem', color: 'var(--text-muted)', lineHeight: 1.7 }}>
                Additional information about {program?.label}, including rehearsal schedules and production materials, will be provided via email as it becomes available. Please refer to your Registration Fee Policy agreement regarding balance due dates.
              </p>
            </div>

            {/* Back to dashboard */}
            <Link href="/dashboard" className="tyt-btn tyt-btn-primary tyt-btn-full">
              Return to Dashboard
            </Link>
          </>
        )}
      </main>
    </div>
  );
}