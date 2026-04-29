'use client';

import { useState, useEffect } from 'react';
import { createClient } from '@/lib/supabase/client';
import { useRouter, useSearchParams, useParams } from 'next/navigation';
import Image from 'next/image';

const FA_LINK = 'https://drive.google.com/file/d/1T5ReNZm8cCpDLwwxkcL7xG3uDtlK1TFz/view?usp=sharing';

function fmt(amount) {
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(Number(amount) || 0);
}

function fmtDate(str) {
  if (!str) return '';
  return new Date(str + 'T00:00:00').toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' });
}

function StepBar() {
  const steps = [
    { n: 1, label: 'Health', done: true, active: false },
    { n: 2, label: 'Agreements', done: true, active: false },
    { n: 3, label: 'Review', done: false, active: true },
    { n: 4, label: 'Payment', done: false, active: false },
  ];
  return (
    <div style={{ background: 'var(--bg-card)', borderBottom: '1px solid var(--border)', padding: '0.75rem 1.5rem' }}>
      <div style={{ maxWidth: '680px', margin: '0 auto', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        {steps.map((s, i) => (
          <div key={s.n} style={{ display: 'flex', alignItems: 'center' }}>
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '0.2rem' }}>
              <div style={{
                width: '28px', height: '28px', borderRadius: '50%',
                background: s.done ? 'var(--gold)' : s.active ? 'var(--red)' : 'var(--bg-hover)',
                border: `2px solid ${s.done ? 'var(--gold)' : s.active ? 'var(--red)' : 'var(--border)'}`,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontFamily: 'var(--font-display)', fontSize: '0.75rem', fontWeight: 700,
                color: s.done ? '#111' : s.active ? '#fff' : 'var(--text-faint)',
              }}>
                {s.done ? '✓' : s.n}
              </div>
              <span style={{ fontFamily: 'var(--font-display)', fontSize: '0.55rem', fontWeight: 600, letterSpacing: '0.08em', textTransform: 'uppercase', whiteSpace: 'nowrap', color: s.done || s.active ? 'var(--text-primary)' : 'var(--text-faint)' }}>
                {s.label}
              </span>
            </div>
            {i < steps.length - 1 && (
              <div style={{ width: '40px', height: '2px', background: s.done ? 'var(--gold)' : 'var(--border)', margin: '0 4px', marginBottom: '16px' }} />
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

function HealthBadge({ flag }) {
  return (
    <span style={{
      fontFamily: 'var(--font-display)', fontSize: '0.65rem', fontWeight: 700,
      letterSpacing: '0.06em', padding: '0.15rem 0.4rem', borderRadius: '3px', flexShrink: 0,
      border: `1px solid ${flag ? 'var(--red)' : 'var(--border)'}`,
      color: flag ? 'var(--red)' : 'var(--text-faint)',
      background: flag ? '#1a0505' : 'transparent',
    }}>
      {flag ? 'YES' : 'NO'}
    </span>
  );
}

export default function ReviewPage() {
  const router = useRouter();
  const params = useParams();
  const searchParams = useSearchParams();

  const programId = params?.id;
  const participantId = searchParams?.get('participant');

  const [status, setStatus] = useState('loading');
  const [loadError, setLoadError] = useState('');
  const [actionError, setActionError] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [financialAid, setFinancialAid] = useState(false);

  const [participant, setParticipant] = useState(null);
  const [program, setProgram] = useState(null);
  const [seasonDisplay, setSeasonDisplay] = useState('');
  const [eligibleSiblings, setEligibleSiblings] = useState([]);
  const [healthData, setHealthData] = useState(null);
  const [agreementData, setAgreementData] = useState(null);
  const [cartItems, setCartItems] = useState([]);

  useEffect(() => {
    if (!programId || programId === 'undefined' || !participantId) {
      setLoadError('Missing registration parameters. Please start again from the program list.');
      setStatus('error');
      return;
    }

    async function load() {
      try {
        const supabase = createClient();

        const { data: { user }, error: userErr } = await supabase.auth.getUser();
        if (userErr || !user) throw new Error('Not authenticated. Please sign in again.');

        const { data: profile, error: profileErr } = await supabase
          .from('profiles')
          .select('family_id')
          .eq('id', user.id)
          .single();
        if (profileErr || !profile) throw new Error('Could not load your profile.');

        const [participantRes, programRes, allParticipantsRes] = await Promise.all([
          supabase.from('participants')
            .select('id, first_name, last_name, nickname')
            .eq('id', participantId)
            .single(),
          supabase.from('programs')
            .select('id, label, fee, deposit_amount, balance_due_date, yog_min, yog_max, costume_fee, other_fee, other_fee_label, session_id')
            .eq('id', programId)
            .single(),
          supabase.from('participants')
            .select('id, first_name, last_name, yog')
            .eq('family_id', profile.family_id)
            .eq('is_active', true)
            .order('first_name'),
        ]);

        if (participantRes.error) throw new Error('Could not load participant: ' + participantRes.error.message);
        if (programRes.error)     throw new Error('Could not load program: '     + programRes.error.message);

        // Parse all numeric fields — Supabase returns numerics as strings
        const raw = programRes.data;
        const prog = {
          ...raw,
          fee:            parseFloat(raw.fee)            || 0,
          deposit_amount: parseFloat(raw.deposit_amount) || 0,
          costume_fee:    parseFloat(raw.costume_fee)    || 0,
          other_fee:      parseFloat(raw.other_fee)      || 0,
          yog_min:        parseInt(raw.yog_min, 10)      || null,
          yog_max:        parseInt(raw.yog_max, 10)      || null,
        };

        // Fetch season display via session_id → season_id chain
        let seasonStr = '';
        if (prog.session_id) {
          const { data: sess } = await supabase
            .from('sessions')
            .select('season_id')
            .eq('id', prog.session_id)
            .single();
          if (sess?.season_id) {
            const { data: season } = await supabase
              .from('seasons')
              .select('display_name, name')
              .eq('id', sess.season_id)
              .single();
            seasonStr = season?.display_name || season?.name || '';
          }
        }

        // Filter siblings eligible for this program
        const siblings = (allParticipantsRes.data || []).filter(ap => {
          if (ap.id === participantId) return false;
          if (!prog.yog_min || !prog.yog_max) return false;
          return ap.yog >= prog.yog_min && ap.yog <= prog.yog_max;
        });

        // Load sessionStorage
        const rawHealth     = sessionStorage.getItem(`health_${programId}_${participantId}`);
        const rawAgreements = sessionStorage.getItem(`agreements_${programId}_${participantId}`);
        const rawCart       = sessionStorage.getItem(`cart_${programId}`);

        setParticipant(participantRes.data);
        setProgram(prog);
        setSeasonDisplay(seasonStr);
        setEligibleSiblings(siblings);
        setHealthData(rawHealth     ? JSON.parse(rawHealth)     : null);
        setAgreementData(rawAgreements ? JSON.parse(rawAgreements) : null);
        setCartItems(rawCart ? JSON.parse(rawCart) : []);
        setStatus('ready');

      } catch (err) {
        console.error('[ReviewPage] load error:', err);
        setLoadError(err.message || 'Failed to load registration data.');
        setStatus('error');
      }
    }

    load();
  }, [programId, participantId]);

  // Derived values — only used when status === 'ready'
  const totalFee   = program ? program.fee + program.costume_fee + program.other_fee : 0;
  const deposit    = program ? program.deposit_amount : 0;
  const balance    = totalFee - deposit;

  const currentItem = (status === 'ready' && participant && program) ? {
    participantId,
    participantName: `${participant.first_name} ${participant.last_name}`,
    programId,
    programLabel: program.label,
    fee:     program.fee,
    deposit: program.deposit_amount,
    financialAid,
  } : null;

  const otherCartItems      = cartItems.filter(c => c.participantId !== participantId);
  const allCartItems        = currentItem ? [...otherCartItems, currentItem] : otherCartItems;
  const totalDeposit        = allCartItems.reduce((sum, item) => sum + (parseFloat(item.deposit) || 0), 0);
  const addableParticipants = eligibleSiblings.filter(s => !cartItems.some(c => c.participantId === s.id));

  function saveToCart() {
    if (!currentItem) return;
    const newCart = [...otherCartItems, currentItem];
    sessionStorage.setItem(`cart_${programId}`, JSON.stringify(newCart));
    setCartItems(newCart);
  }

  function handleSaveAndAdd(siblingId) {
    saveToCart();
    router.push(`/register/${programId}?participant=${siblingId}`);
  }

  async function handleProceedToPayment() {
    setActionError('');
    if (!healthData) {
      setActionError('Health information is missing. Please go back and complete the health form.');
      return;
    }
    if (!agreementData) {
      setActionError('Agreements are not signed. Please go back and sign the agreements.');
      return;
    }
    setSubmitting(true);
    saveToCart();
    router.push(`/register/${programId}/payment`);
  }

  const backHref = programId && participantId && programId !== 'undefined'
    ? `/register/${programId}/agreements?participant=${participantId}`
    : '/register';

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
        <a href={backHref} style={{ fontFamily: 'var(--font-display)', fontSize: '0.75rem', fontWeight: 600, letterSpacing: '0.1em', textTransform: 'uppercase', color: 'var(--gold)', textDecoration: 'none', border: '1px solid var(--gold)', borderRadius: 'var(--radius-sm)', padding: '0.35rem 0.85rem' }}>
          ← Back
        </a>
      </nav>

      <StepBar />

      <main style={{ maxWidth: '680px', margin: '0 auto', padding: '2rem 1.5rem' }}>

        {status === 'loading' && (
          <div style={{ textAlign: 'center', padding: '4rem', fontFamily: 'var(--font-accent)', fontStyle: 'italic', color: 'var(--text-muted)' }}>
            Loading your registration...
          </div>
        )}

        {status === 'error' && (
          <div>
            <div className="tyt-error" style={{ marginBottom: '1rem' }}>{loadError}</div>
            <a href="/register" className="tyt-btn tyt-btn-secondary" style={{ display: 'inline-flex' }}>← Back to Programs</a>
          </div>
        )}

        {status === 'ready' && (
          <>
            <h2 style={{ fontFamily: 'var(--font-display)', fontSize: '1.3rem', fontWeight: 700, letterSpacing: '0.05em', textTransform: 'uppercase', color: 'var(--text-primary)', marginBottom: '0.25rem' }}>
              Review Your Registration
            </h2>
            <p style={{ fontFamily: 'var(--font-accent)', fontStyle: 'italic', color: 'var(--text-muted)', fontSize: '0.9rem', marginBottom: '1.5rem' }}>
              Please review all information below before proceeding to payment.
            </p>

            {actionError && <div className="tyt-error" style={{ marginBottom: '1rem' }}>{actionError}</div>}

            {/* ── Registration Summary Card ── */}
            <div style={{ background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 'var(--radius-md)', overflow: 'hidden', marginBottom: '1rem' }}>

              <div style={{ background: 'var(--bg-hover)', borderBottom: '1px solid var(--border)', padding: '0.875rem 1.25rem' }}>
                <p style={{ fontFamily: 'var(--font-display)', fontSize: '0.65rem', fontWeight: 600, letterSpacing: '0.1em', textTransform: 'uppercase', color: 'var(--text-faint)', marginBottom: '0.15rem' }}>Registration</p>
                <p style={{ fontFamily: 'var(--font-display)', fontSize: '1.1rem', fontWeight: 800, color: 'var(--text-primary)' }}>
                  {participant.nickname ? participant.nickname : participant.first_name} {participant.last_name}
                </p>
                <p style={{ fontFamily: 'var(--font-body)', fontSize: '0.8rem', color: 'var(--text-muted)', marginTop: '0.1rem' }}>
                  {program.label}{seasonDisplay ? ` · ${seasonDisplay} Season` : ''}
                </p>
              </div>

              <div style={{ padding: '1.25rem' }}>

                {/* Health */}
                {healthData && (
                  <div style={{ marginBottom: '1.25rem' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.6rem' }}>
                      <p style={{ fontFamily: 'var(--font-display)', fontSize: '0.7rem', fontWeight: 600, letterSpacing: '0.1em', textTransform: 'uppercase', color: 'var(--text-faint)' }}>Health Information</p>
                      <a href={`/register/${programId}?participant=${participantId}`} style={{ fontFamily: 'var(--font-display)', fontSize: '0.65rem', fontWeight: 600, letterSpacing: '0.08em', textTransform: 'uppercase', color: 'var(--gold)', textDecoration: 'none' }}>Edit</a>
                    </div>
                    {[
                      { label: 'Academic Considerations',  flag: healthData.academic_flag,   notes: healthData.academic_notes },
                      { label: 'Behavioral Considerations', flag: healthData.behavioral_flag, notes: healthData.behavioral_notes },
                      { label: 'Allergies',                flag: healthData.allergies_flag,  notes: healthData.allergies_notes, extra: healthData.epipen ? 'EpiPen: Yes' : null },
                      { label: 'Asthma',                   flag: healthData.asthma },
                      { label: 'Concussion History',       flag: healthData.concussion_flag, notes: healthData.concussion_date ? `Date: ${fmtDate(healthData.concussion_date)}` : null },
                    ].map(item => (
                      <div key={item.label} style={{ display: 'flex', gap: '0.5rem', marginBottom: '0.4rem', alignItems: 'flex-start' }}>
                        <HealthBadge flag={item.flag} />
                        <div>
                          <span style={{ fontFamily: 'var(--font-body)', fontSize: '0.82rem', color: 'var(--text-primary)' }}>{item.label}</span>
                          {item.flag && item.notes && <p style={{ fontFamily: 'var(--font-body)', fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '0.1rem' }}>{item.notes}</p>}
                          {item.flag && item.extra && <p style={{ fontFamily: 'var(--font-body)', fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '0.1rem' }}>{item.extra}</p>}
                        </div>
                      </div>
                    ))}
                    {healthData.general_comments && (
                      <div style={{ marginTop: '0.5rem', padding: '0.5rem 0.75rem', background: 'var(--bg-hover)', borderRadius: 'var(--radius-sm)' }}>
                        <p style={{ fontFamily: 'var(--font-display)', fontSize: '0.65rem', fontWeight: 600, letterSpacing: '0.08em', textTransform: 'uppercase', color: 'var(--text-faint)', marginBottom: '0.2rem' }}>Additional Comments</p>
                        <p style={{ fontFamily: 'var(--font-body)', fontSize: '0.8rem', color: 'var(--text-muted)' }}>{healthData.general_comments}</p>
                      </div>
                    )}
                  </div>
                )}

                {/* Fees */}
                <div style={{ borderTop: healthData ? '1px solid var(--border)' : 'none', paddingTop: healthData ? '1rem' : 0 }}>
                  <p style={{ fontFamily: 'var(--font-display)', fontSize: '0.7rem', fontWeight: 600, letterSpacing: '0.1em', textTransform: 'uppercase', color: 'var(--text-faint)', marginBottom: '0.5rem' }}>Fees</p>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '0.35rem', marginBottom: '0.75rem' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                      <span style={{ fontFamily: 'var(--font-body)', fontSize: '0.875rem', color: 'var(--text-muted)' }}>Registration Fee</span>
                      <span style={{ fontFamily: 'var(--font-body)', fontSize: '0.875rem', color: 'var(--text-primary)' }}>{fmt(program.fee)}</span>
                    </div>
                    {program.costume_fee > 0 && (
                      <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                        <span style={{ fontFamily: 'var(--font-body)', fontSize: '0.875rem', color: 'var(--text-muted)' }}>Costume Fee</span>
                        <span style={{ fontFamily: 'var(--font-body)', fontSize: '0.875rem', color: 'var(--text-primary)' }}>{fmt(program.costume_fee)}</span>
                      </div>
                    )}
                    {program.other_fee > 0 && (
                      <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                        <span style={{ fontFamily: 'var(--font-body)', fontSize: '0.875rem', color: 'var(--text-muted)' }}>{program.other_fee_label || 'Other Fee'}</span>
                        <span style={{ fontFamily: 'var(--font-body)', fontSize: '0.875rem', color: 'var(--text-primary)' }}>{fmt(program.other_fee)}</span>
                      </div>
                    )}
                    <div style={{ display: 'flex', justifyContent: 'space-between', borderTop: '1px solid var(--border)', paddingTop: '0.35rem' }}>
                      <span style={{ fontFamily: 'var(--font-display)', fontSize: '0.78rem', fontWeight: 700, letterSpacing: '0.05em', textTransform: 'uppercase', color: 'var(--text-muted)' }}>Total</span>
                      <span style={{ fontFamily: 'var(--font-display)', fontSize: '0.9rem', fontWeight: 700, color: 'var(--text-primary)' }}>{fmt(totalFee)}</span>
                    </div>
                  </div>
                  <div style={{ background: 'var(--bg-hover)', borderRadius: 'var(--radius-sm)', padding: '0.875rem 1rem', display: 'flex', gap: '2rem', flexWrap: 'wrap' }}>
                    <div>
                      <p style={{ fontFamily: 'var(--font-display)', fontSize: '0.65rem', fontWeight: 600, letterSpacing: '0.1em', textTransform: 'uppercase', color: 'var(--text-faint)', marginBottom: '0.2rem' }}>Deposit Due Today</p>
                      <p style={{ fontFamily: 'var(--font-display)', fontSize: '1.2rem', fontWeight: 800, color: 'var(--gold)' }}>{fmt(deposit)}</p>
                    </div>
                    <div>
                      <p style={{ fontFamily: 'var(--font-display)', fontSize: '0.65rem', fontWeight: 600, letterSpacing: '0.1em', textTransform: 'uppercase', color: 'var(--text-faint)', marginBottom: '0.2rem' }}>Balance Due</p>
                      <p style={{ fontFamily: 'var(--font-display)', fontSize: '1.2rem', fontWeight: 800, color: 'var(--text-primary)' }}>{fmt(balance)}</p>
                    </div>
                    {program.balance_due_date && (
                      <div>
                        <p style={{ fontFamily: 'var(--font-display)', fontSize: '0.65rem', fontWeight: 600, letterSpacing: '0.1em', textTransform: 'uppercase', color: 'var(--text-faint)', marginBottom: '0.2rem' }}>Balance Due Date</p>
                        <p style={{ fontFamily: 'var(--font-display)', fontSize: '1rem', fontWeight: 700, color: 'var(--text-primary)' }}>{fmtDate(program.balance_due_date)}</p>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </div>

            {/* ── Register Another Participant ── */}
            {addableParticipants.length > 0 && (
              <div style={{ background: 'var(--bg-card)', border: '1px dashed var(--border)', borderRadius: 'var(--radius-md)', padding: '1.25rem', marginBottom: '1rem' }}>
                <p style={{ fontFamily: 'var(--font-display)', fontSize: '0.75rem', fontWeight: 600, letterSpacing: '0.1em', textTransform: 'uppercase', color: 'var(--text-muted)', marginBottom: '0.75rem' }}>
                  Register Another Participant for {program.label}
                </p>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                  {addableParticipants.map(s => (
                    <div key={s.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '1rem' }}>
                      <div>
                        <p style={{ fontFamily: 'var(--font-body)', fontSize: '0.875rem', color: 'var(--text-primary)' }}>{s.first_name} {s.last_name}</p>
                        <p style={{ fontFamily: 'var(--font-body)', fontSize: '0.75rem', color: 'var(--text-faint)' }}>Adds {fmt(deposit)} deposit</p>
                      </div>
                      <button type="button" onClick={() => handleSaveAndAdd(s.id)} className="tyt-btn tyt-btn-secondary" style={{ fontSize: '0.75rem', padding: '0.4rem 1rem', whiteSpace: 'nowrap' }}>
                        Save &amp; Add →
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* ── Financial Aid ── */}
            <div style={{ background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 'var(--radius-md)', padding: '1.25rem', marginBottom: '1rem' }}>
              <div style={{ display: 'flex', alignItems: 'flex-start', gap: '0.875rem' }}>
                <input type="checkbox" id="financial_aid" checked={financialAid} onChange={e => setFinancialAid(e.target.checked)} style={{ width: '16px', height: '16px', accentColor: 'var(--red)', cursor: 'pointer', marginTop: '3px', flexShrink: 0 }} />
                <label htmlFor="financial_aid" style={{ cursor: 'pointer' }}>
                  <p style={{ fontFamily: 'var(--font-display)', fontSize: '0.8rem', fontWeight: 700, letterSpacing: '0.06em', textTransform: 'uppercase', color: 'var(--text-primary)', marginBottom: '0.3rem' }}>I am applying for financial aid</p>
                  <p style={{ fontFamily: 'var(--font-body)', fontSize: '0.8rem', color: 'var(--text-muted)', lineHeight: 1.6 }}>
                    Check this box if you plan to submit a financial aid application. You will still need to pay the {fmt(deposit)} deposit today. TYT will adjust your balance upon review of your application.{' '}
                    <a href={FA_LINK} target="_blank" rel="noopener noreferrer" style={{ color: 'var(--gold)', textDecoration: 'underline' }}>Download the financial aid application here.</a>
                  </p>
                </label>
              </div>
            </div>

            {/* ── Also in Your Cart ── */}
            {otherCartItems.length > 0 && (
              <div style={{ background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 'var(--radius-md)', padding: '1.25rem', marginBottom: '1rem' }}>
                <p style={{ fontFamily: 'var(--font-display)', fontSize: '0.75rem', fontWeight: 600, letterSpacing: '0.1em', textTransform: 'uppercase', color: 'var(--gold)', marginBottom: '0.75rem' }}>Also in Your Cart</p>
                {otherCartItems.map((item, i) => (
                  <div key={i} style={{ display: 'flex', justifyContent: 'space-between', paddingBottom: i < otherCartItems.length - 1 ? '0.5rem' : 0, marginBottom: i < otherCartItems.length - 1 ? '0.5rem' : 0, borderBottom: i < otherCartItems.length - 1 ? '1px solid var(--border)' : 'none' }}>
                    <span style={{ fontFamily: 'var(--font-body)', fontSize: '0.875rem', color: 'var(--text-primary)' }}>{item.participantName}</span>
                    <span style={{ fontFamily: 'var(--font-body)', fontSize: '0.875rem', color: 'var(--gold)' }}>{fmt(item.deposit)} deposit</span>
                  </div>
                ))}
              </div>
            )}

            {/* ── Total Due Today ── */}
            <div style={{ background: '#0d1a0a', border: '1px solid var(--gold)', borderRadius: 'var(--radius-md)', padding: '1.25rem', marginBottom: '1.75rem' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div>
                  <p style={{ fontFamily: 'var(--font-display)', fontSize: '0.75rem', fontWeight: 600, letterSpacing: '0.1em', textTransform: 'uppercase', color: 'var(--text-muted)', marginBottom: '0.25rem' }}>
                    Total Due Today ({allCartItems.length} registration{allCartItems.length !== 1 ? 's' : ''})
                  </p>
                  <p style={{ fontFamily: 'var(--font-display)', fontSize: '2rem', fontWeight: 800, color: 'var(--gold)', lineHeight: 1 }}>
                    {fmt(totalDeposit)}
                  </p>
                </div>
                <p style={{ fontFamily: 'var(--font-body)', fontSize: '0.75rem', color: 'var(--text-faint)', textAlign: 'right' }}>
                  {fmt(deposit)} × {allCartItems.length}
                </p>
              </div>
            </div>

            {/* ── Proceed to Payment ── */}
            <button onClick={handleProceedToPayment} disabled={submitting} className="tyt-btn tyt-btn-primary tyt-btn-full">
              {submitting ? 'Processing...' : `Proceed to Payment — ${fmt(totalDeposit)}`}
            </button>
          </>
        )}
      </main>
    </div>
  );
}