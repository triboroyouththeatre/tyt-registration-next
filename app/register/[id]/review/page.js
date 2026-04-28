'use client';

import { useState, useEffect, Suspense } from 'react';
import { createClient } from '@/lib/supabase/client';
import { useRouter, useSearchParams } from 'next/navigation';
import Image from 'next/image';

const STEP_INDICATOR = [
  { n: 1, label: 'Health', done: true, active: false },
  { n: 2, label: 'Agreements', done: true, active: false },
  { n: 3, label: 'Review', done: false, active: true },
  { n: 4, label: 'Payment', done: false, active: false },
];

const FA_LINK = 'https://drive.google.com/file/d/1T5ReNZm8cCpDLwwxkcL7xG3uDtlK1TFz/view?usp=sharing';

const DOC_TITLES = {
  payment_agreement: 'Registration Fee Policy',
  participant_rules: 'Participation Policy & Behavior Standards',
  liability_waiver: 'Health & Safety — Liability Waiver and Release of Claims',
};

function StepBar() {
  return (
    <div style={{ background: 'var(--bg-card)', borderBottom: '1px solid var(--border)', padding: '0.75rem 1.5rem' }}>
      <div style={{ maxWidth: '780px', margin: '0 auto', display: 'flex', alignItems: 'center' }}>
        {STEP_INDICATOR.map((s, i, arr) => (
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
            {i < arr.length - 1 && (
              <div style={{ width: '40px', height: '2px', background: s.done ? 'var(--gold)' : 'var(--border)', margin: '0 4px', marginBottom: '16px' }} />
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

function formatCurrency(amount) {
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(amount || 0);
}

function formatDate(dateStr) {
  if (!dateStr) return null;
  const d = new Date(dateStr + 'T00:00:00');
  return d.toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' });
}

function Row({ label, value, muted }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', gap: '1rem', paddingBottom: '0.5rem', marginBottom: '0.5rem', borderBottom: '1px solid var(--border)' }}>
      <span style={{ fontFamily: 'var(--font-display)', fontSize: '0.7rem', fontWeight: 600, letterSpacing: '0.1em', textTransform: 'uppercase', color: 'var(--text-faint)', flexShrink: 0 }}>{label}</span>
      <span style={{ fontFamily: 'var(--font-body)', fontSize: '0.875rem', color: muted ? 'var(--text-muted)' : 'var(--text-primary)', textAlign: 'right' }}>{value}</span>
    </div>
  );
}

function ReviewForm({ programId }) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const participantId = searchParams.get('participant');

  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [financialAid, setFinancialAid] = useState(false);

  const [participant, setParticipant] = useState(null);
  const [program, setProgram] = useState(null);
  const [family, setFamily] = useState(null);
  const [contacts, setContacts] = useState([]);
  const [familyId, setFamilyId] = useState(null);
  const [healthData, setHealthData] = useState(null);
  const [agreementData, setAgreementData] = useState(null);
  const [eligibleSiblings, setEligibleSiblings] = useState([]);
  const [cartItems, setCartItems] = useState([]);
  const [gradeLevels, setGradeLevels] = useState([]);

  useEffect(() => {
    async function load() {
      const supabase = createClient();
      const { data: { user } } = await supabase.auth.getUser();
      const { data: profile } = await supabase.from('profiles').select('family_id').eq('id', user.id).single();
      setFamilyId(profile.family_id);

      const [
        { data: p },
        { data: prog },
        { data: allParticipants },
        { data: fam },
        { data: contactData },
        { data: gradeData },
      ] = await Promise.all([
        supabase.from('participants').select('first_name, last_name, nickname, yog, gender_id, phone, email, genders(label)').eq('id', participantId).single(),
        supabase.from('programs').select(`
          id, label, fee, deposit_amount, balance_due_date,
          yog_min, yog_max, costume_fee, other_fee, other_fee_label, schedule,
          sessions!inner(
            name,
            seasons!inner(name, display_name)
          )
        `).eq('id', programId).single(),
        supabase.from('participants').select('id, first_name, last_name, yog').eq('family_id', profile.family_id).eq('is_active', true).order('first_name'),
        supabase.from('families').select('email, street, street2, city, state, zip').eq('id', profile.family_id).single(),
        supabase.from('contacts').select('*, relationships(label)').eq('family_id', profile.family_id).order('priority'),
        supabase.from('grade_levels').select('yog, label, seasons!inner(is_active)').eq('seasons.is_active', true).order('yog'),
      ]);

      setParticipant(p);
      setProgram(prog);
      setFamily(fam);
      setContacts(contactData || []);
      setGradeLevels(gradeData || []);

      const siblings = (allParticipants || []).filter(ap => {
        if (ap.id === participantId) return false;
        if (!prog?.yog_min || !prog?.yog_max) return true;
        return ap.yog >= prog.yog_min && ap.yog <= prog.yog_max;
      });
      setEligibleSiblings(siblings);

      const health = sessionStorage.getItem(`health_${programId}_${participantId}`);
      const agreements = sessionStorage.getItem(`agreements_${programId}_${participantId}`);
      if (health) setHealthData(JSON.parse(health));
      if (agreements) setAgreementData(JSON.parse(agreements));

      const cart = sessionStorage.getItem(`cart_${programId}`);
      if (cart) setCartItems(JSON.parse(cart));

      setLoading(false);
    }
    load();
  }, [participantId, programId]);

  function getGradeLabel(yog) {
    return gradeLevels?.find(g => g.yog === yog)?.label || `Class of ${yog}`;
  }

  function addToCart() {
    const item = {
      participantId,
      participantName: `${participant.first_name} ${participant.last_name}`,
      programId,
      programLabel: program.label,
      fee: program.fee,
      deposit: program.deposit_amount,
      financialAid,
    };
    const existing = cartItems.filter(c => c.participantId !== participantId);
    const newCart = [...existing, item];
    setCartItems(newCart);
    sessionStorage.setItem(`cart_${programId}`, JSON.stringify(newCart));
    return newCart;
  }

  async function handleProceedToPayment() {
    setError('');
    setSubmitting(true);
    if (!healthData) { setError('Health information is missing. Please go back to the health form.'); setSubmitting(false); return; }
    if (!agreementData) { setError('Agreement signatures are missing. Please go back to the agreements page.'); setSubmitting(false); return; }
    const newCart = addToCart();
    sessionStorage.setItem(`cart_${programId}`, JSON.stringify(newCart));
    router.push(`/register/${programId}/payment`);
  }

  function handleAddAnotherParticipant(siblingId) {
    addToCart();
    router.push(`/register/${programId}?participant=${siblingId}`);
  }

  if (loading) {
    return <div style={{ textAlign: 'center', color: 'var(--text-muted)', padding: '3rem', fontFamily: 'var(--font-accent)', fontStyle: 'italic' }}>Loading...</div>;
  }

  const seasonDisplay = program?.sessions?.seasons?.display_name || program?.sessions?.seasons?.name || '—';
  const sessionName = program?.sessions?.name || '—';
  const totalFee = (program?.fee || 0) + (program?.costume_fee || 0) + (program?.other_fee || 0);
  const deposit = program?.deposit_amount || 0;
  const balance = totalFee - deposit;
  const primaryContact = contacts.find(c => c.priority === 1);
  const secondaryContact = contacts.find(c => c.priority === 2);

  const allCartItems = [
    ...cartItems.filter(c => c.participantId !== participantId),
    { participantId, participantName: `${participant?.first_name} ${participant?.last_name}`, programLabel: program?.label, fee: program?.fee, deposit: program?.deposit_amount, financialAid },
  ];
  const totalDeposit = allCartItems.reduce((sum, item) => sum + (item.deposit || 0), 0);

  return (
    <div>
      {error && <div className="tyt-error">{error}</div>}

      <h2 style={{ fontFamily: 'var(--font-display)', fontSize: '1.3rem', fontWeight: 700, letterSpacing: '0.05em', textTransform: 'uppercase', color: 'var(--text-primary)', marginBottom: '0.25rem' }}>
        Review Your Registration
      </h2>
      <p style={{ fontFamily: 'var(--font-accent)', fontStyle: 'italic', color: 'var(--text-muted)', fontSize: '0.9rem', marginBottom: '1.5rem' }}>
        Please review all information below before proceeding to payment.
      </p>

      {/* ── Registration Summary Card ── */}
      <div style={{ background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 'var(--radius-md)', overflow: 'hidden', marginBottom: '1rem' }}>

        {/* Header */}
        <div style={{ background: 'var(--bg-hover)', borderBottom: '1px solid var(--border)', padding: '0.875rem 1.25rem' }}>
          <p style={{ fontFamily: 'var(--font-display)', fontSize: '0.65rem', fontWeight: 600, letterSpacing: '0.1em', textTransform: 'uppercase', color: 'var(--text-faint)', marginBottom: '0.15rem' }}>Registration</p>
          <p style={{ fontFamily: 'var(--font-display)', fontSize: '1.1rem', fontWeight: 800, color: 'var(--text-primary)', marginBottom: '0.1rem' }}>
            {participant?.first_name} {participant?.last_name}
            {participant?.nickname && (
              <span style={{ fontFamily: 'var(--font-accent)', fontStyle: 'italic', fontWeight: 400, fontSize: '0.9rem', color: 'var(--text-muted)', marginLeft: '0.5rem' }}>"{participant.nickname}"</span>
            )}
          </p>
          <p style={{ fontFamily: 'var(--font-body)', fontSize: '0.8rem', color: 'var(--text-muted)' }}>
            {getGradeLabel(participant?.yog)} · {participant?.genders?.label}
          </p>
        </div>

        <div style={{ padding: '1.25rem' }}>

          {/* Program info */}
          <div style={{ marginBottom: '1.25rem' }}>
            <Row label="Program" value={program?.label} />
            <Row label="Season" value={`${seasonDisplay} Season`} />
            <Row label="Session" value={`${sessionName} Session`} />
            <Row label="Schedule" value={program?.schedule || 'TBD'} muted />
            <Row label="Registration Date" value={new Date().toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })} muted />
          </div>

          {/* Health summary */}
          {healthData && (
            <div style={{ marginBottom: '1.25rem' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem' }}>
                <p style={{ fontFamily: 'var(--font-display)', fontSize: '0.7rem', fontWeight: 600, letterSpacing: '0.1em', textTransform: 'uppercase', color: 'var(--text-faint)' }}>Health Information</p>
                <a href={`/register/${programId}?participant=${participantId}`} style={{ fontFamily: 'var(--font-display)', fontSize: '0.65rem', fontWeight: 600, letterSpacing: '0.08em', textTransform: 'uppercase', color: 'var(--gold)', textDecoration: 'none' }}>Edit</a>
              </div>
              {[
                { label: 'Academic Considerations', flag: healthData.academic_flag, notes: healthData.academic_notes },
                { label: 'Behavioral Considerations', flag: healthData.behavioral_flag, notes: healthData.behavioral_notes },
                { label: 'Allergies', flag: healthData.allergies_flag, notes: healthData.allergies_notes, sub: healthData.epipen ? 'EpiPen: Yes' : null },
                { label: 'Asthma', flag: healthData.asthma },
                { label: 'Concussion History', flag: healthData.concussion_flag, notes: healthData.concussion_date ? `Date: ${formatDate(healthData.concussion_date)}` : null },
              ].map(item => (
                <div key={item.label} style={{ display: 'flex', gap: '0.5rem', marginBottom: '0.4rem', alignItems: 'flex-start' }}>
                  <span style={{
                    fontFamily: 'var(--font-display)', fontSize: '0.65rem', fontWeight: 700,
                    letterSpacing: '0.06em', padding: '0.15rem 0.4rem', borderRadius: '3px', flexShrink: 0,
                    border: `1px solid ${item.flag ? 'var(--red)' : 'var(--border)'}`,
                    color: item.flag ? 'var(--red)' : 'var(--text-faint)',
                    background: item.flag ? '#1a0505' : 'transparent',
                  }}>
                    {item.flag ? 'YES' : 'NO'}
                  </span>
                  <div>
                    <span style={{ fontFamily: 'var(--font-body)', fontSize: '0.8rem', color: 'var(--text-primary)' }}>{item.label}</span>
                    {item.flag && item.notes && <p style={{ fontFamily: 'var(--font-body)', fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '0.1rem' }}>{item.notes}</p>}
                    {item.flag && item.sub && <p style={{ fontFamily: 'var(--font-body)', fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '0.1rem' }}>{item.sub}</p>}
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

          {/* Agreements summary */}
          {agreementData && (
            <div style={{ marginBottom: '1.25rem' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem' }}>
                <p style={{ fontFamily: 'var(--font-display)', fontSize: '0.7rem', fontWeight: 600, letterSpacing: '0.1em', textTransform: 'uppercase', color: 'var(--text-faint)' }}>Agreements Signed</p>
                <a href={`/register/${programId}/agreements?participant=${participantId}`} style={{ fontFamily: 'var(--font-display)', fontSize: '0.65rem', fontWeight: 600, letterSpacing: '0.08em', textTransform: 'uppercase', color: 'var(--gold)', textDecoration: 'none' }}>Edit</a>
              </div>
              {agreementData.map(a => (
                <div key={a.type} style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.3rem' }}>
                  <span style={{ fontFamily: 'var(--font-body)', fontSize: '0.8rem', color: 'var(--text-muted)' }}>{DOC_TITLES[a.type] || a.type}</span>
                  <span style={{ fontFamily: 'var(--font-body)', fontSize: '0.8rem', color: 'var(--gold)' }}>✓ {a.agreed_by}</span>
                </div>
              ))}
            </div>
          )}

          {/* Fee breakdown */}
          <div style={{ borderTop: '1px solid var(--border)', paddingTop: '1rem' }}>
            <p style={{ fontFamily: 'var(--font-display)', fontSize: '0.7rem', fontWeight: 600, letterSpacing: '0.1em', textTransform: 'uppercase', color: 'var(--text-faint)', marginBottom: '0.5rem' }}>Fees</p>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.35rem', marginBottom: '0.75rem' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span style={{ fontFamily: 'var(--font-body)', fontSize: '0.875rem', color: 'var(--text-muted)' }}>Registration Fee</span>
                <span style={{ fontFamily: 'var(--font-body)', fontSize: '0.875rem', color: 'var(--text-primary)' }}>{formatCurrency(program?.fee)}</span>
              </div>
              {program?.costume_fee > 0 && (
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span style={{ fontFamily: 'var(--font-body)', fontSize: '0.875rem', color: 'var(--text-muted)' }}>Costume Fee</span>
                  <span style={{ fontFamily: 'var(--font-body)', fontSize: '0.875rem', color: 'var(--text-primary)' }}>{formatCurrency(program.costume_fee)}</span>
                </div>
              )}
              {program?.other_fee > 0 && (
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span style={{ fontFamily: 'var(--font-body)', fontSize: '0.875rem', color: 'var(--text-muted)' }}>{program.other_fee_label || 'Other Fee'}</span>
                  <span style={{ fontFamily: 'var(--font-body)', fontSize: '0.875rem', color: 'var(--text-primary)' }}>{formatCurrency(program.other_fee)}</span>
                </div>
              )}
              <div style={{ display: 'flex', justifyContent: 'space-between', borderTop: '1px solid var(--border)', paddingTop: '0.35rem', marginTop: '0.15rem' }}>
                <span style={{ fontFamily: 'var(--font-display)', fontSize: '0.78rem', fontWeight: 700, letterSpacing: '0.05em', textTransform: 'uppercase', color: 'var(--text-muted)' }}>Total</span>
                <span style={{ fontFamily: 'var(--font-display)', fontSize: '0.9rem', fontWeight: 700, color: 'var(--text-primary)' }}>{formatCurrency(totalFee)}</span>
              </div>
            </div>

            {/* Deposit / Balance box */}
            <div style={{ background: 'var(--bg-hover)', borderRadius: 'var(--radius-sm)', padding: '0.875rem 1rem', display: 'flex', gap: '2rem', flexWrap: 'wrap' }}>
              <div>
                <p style={{ fontFamily: 'var(--font-display)', fontSize: '0.65rem', fontWeight: 600, letterSpacing: '0.1em', textTransform: 'uppercase', color: 'var(--text-faint)', marginBottom: '0.2rem' }}>Deposit Due Today</p>
                <p style={{ fontFamily: 'var(--font-display)', fontSize: '1.2rem', fontWeight: 800, color: 'var(--gold)' }}>{formatCurrency(deposit)}</p>
              </div>
              <div>
                <p style={{ fontFamily: 'var(--font-display)', fontSize: '0.65rem', fontWeight: 600, letterSpacing: '0.1em', textTransform: 'uppercase', color: 'var(--text-faint)', marginBottom: '0.2rem' }}>Balance Due</p>
                <p style={{ fontFamily: 'var(--font-display)', fontSize: '1.2rem', fontWeight: 800, color: 'var(--text-primary)' }}>{formatCurrency(balance)}</p>
              </div>
              {program?.balance_due_date && (
                <div>
                  <p style={{ fontFamily: 'var(--font-display)', fontSize: '0.65rem', fontWeight: 600, letterSpacing: '0.1em', textTransform: 'uppercase', color: 'var(--text-faint)', marginBottom: '0.2rem' }}>Balance Due Date</p>
                  <p style={{ fontFamily: 'var(--font-display)', fontSize: '1rem', fontWeight: 700, color: 'var(--text-primary)' }}>{formatDate(program.balance_due_date)}</p>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* ── Financial Aid ── */}
      <div style={{ background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 'var(--radius-md)', padding: '1.25rem', marginBottom: '1rem' }}>
        <div style={{ display: 'flex', alignItems: 'flex-start', gap: '0.875rem' }}>
          <input
            type="checkbox"
            id="financial_aid"
            checked={financialAid}
            onChange={e => setFinancialAid(e.target.checked)}
            style={{ width: '16px', height: '16px', accentColor: 'var(--red)', cursor: 'pointer', marginTop: '3px', flexShrink: 0 }}
          />
          <label htmlFor="financial_aid" style={{ cursor: 'pointer' }}>
            <p style={{ fontFamily: 'var(--font-display)', fontSize: '0.8rem', fontWeight: 700, letterSpacing: '0.06em', textTransform: 'uppercase', color: 'var(--text-primary)', marginBottom: '0.3rem' }}>
              I am applying for financial aid
            </p>
            <p style={{ fontFamily: 'var(--font-body)', fontSize: '0.8rem', color: 'var(--text-muted)', lineHeight: 1.6 }}>
              Check this box if you plan to submit a financial aid application. You will still need to pay the {formatCurrency(deposit)} deposit today.
              TYT will adjust your balance upon review of your application.{' '}
              <a href={FA_LINK} target="_blank" rel="noopener noreferrer" style={{ color: 'var(--gold)', textDecoration: 'underline' }}>
                Download the financial aid application here.
              </a>
            </p>
          </label>
        </div>
      </div>

      {/* ── Cart summary (other participants) ── */}
      {cartItems.filter(c => c.participantId !== participantId).length > 0 && (
        <div style={{ background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 'var(--radius-md)', padding: '1.25rem', marginBottom: '1rem' }}>
          <p style={{ fontFamily: 'var(--font-display)', fontSize: '0.75rem', fontWeight: 600, letterSpacing: '0.1em', textTransform: 'uppercase', color: 'var(--gold)', marginBottom: '0.75rem' }}>
            Also in Your Cart
          </p>
          {cartItems.filter(c => c.participantId !== participantId).map((item, i) => (
            <div key={i} style={{ display: 'flex', justifyContent: 'space-between', paddingBottom: '0.5rem', marginBottom: '0.5rem', borderBottom: '1px solid var(--border)' }}>
              <span style={{ fontFamily: 'var(--font-body)', fontSize: '0.875rem', color: 'var(--text-primary)' }}>{item.participantName}</span>
              <span style={{ fontFamily: 'var(--font-body)', fontSize: '0.875rem', color: 'var(--gold)' }}>{formatCurrency(item.deposit)} deposit</span>
            </div>
          ))}
        </div>
      )}

      {/* ── Add another participant ── */}
      {eligibleSiblings.filter(s => !cartItems.some(c => c.participantId === s.id) && s.id !== participantId).length > 0 && (
        <div style={{ background: 'var(--bg-card)', border: '1px dashed var(--border)', borderRadius: 'var(--radius-md)', padding: '1.25rem', marginBottom: '1rem' }}>
          <p style={{ fontFamily: 'var(--font-display)', fontSize: '0.75rem', fontWeight: 600, letterSpacing: '0.1em', textTransform: 'uppercase', color: 'var(--text-muted)', marginBottom: '0.75rem' }}>
            Add Another Participant to This Registration
          </p>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
            {eligibleSiblings
              .filter(s => !cartItems.some(c => c.participantId === s.id) && s.id !== participantId)
              .map(s => (
                <div key={s.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span style={{ fontFamily: 'var(--font-body)', fontSize: '0.875rem', color: 'var(--text-primary)' }}>{s.first_name} {s.last_name}</span>
                  <button type="button" onClick={() => handleAddAnotherParticipant(s.id)} className="tyt-btn tyt-btn-secondary" style={{ fontSize: '0.75rem', padding: '0.3rem 0.875rem' }}>
                    + Add
                  </button>
                </div>
              ))}
          </div>
        </div>
      )}

      {/* ── Total due today ── */}
      <div style={{ background: '#0d1a0a', border: '1px solid var(--gold)', borderRadius: 'var(--radius-md)', padding: '1.25rem', marginBottom: '1.75rem' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div>
            <p style={{ fontFamily: 'var(--font-display)', fontSize: '0.75rem', fontWeight: 600, letterSpacing: '0.1em', textTransform: 'uppercase', color: 'var(--text-muted)', marginBottom: '0.25rem' }}>
              Total Due Today ({allCartItems.length} registration{allCartItems.length !== 1 ? 's' : ''})
            </p>
            <p style={{ fontFamily: 'var(--font-display)', fontSize: '2rem', fontWeight: 800, color: 'var(--gold)', lineHeight: 1 }}>
              {formatCurrency(totalDeposit)}
            </p>
          </div>
          <p style={{ fontFamily: 'var(--font-body)', fontSize: '0.75rem', color: 'var(--text-faint)', textAlign: 'right' }}>
            {formatCurrency(deposit)} deposit × {allCartItems.length}
          </p>
        </div>
      </div>

      <button onClick={handleProceedToPayment} disabled={submitting} className="tyt-btn tyt-btn-primary tyt-btn-full">
        {submitting ? 'Processing...' : `Proceed to Payment — ${formatCurrency(totalDeposit)}`}
      </button>
    </div>
  );
}

export default function ReviewPage({ params }) {
  const programId = params.id;

  return (
    <div style={{ minHeight: '100vh', background: 'var(--bg-dark)' }}>
      <nav style={{
        background: 'var(--bg-card)', borderBottom: '1px solid var(--border)',
        padding: '0 1.5rem', display: 'flex', alignItems: 'center',
        justifyContent: 'space-between', height: '64px',
        position: 'sticky', top: 0, zIndex: 100,
      }}>
        <a href="/register" style={{ display: 'flex', alignItems: 'center', textDecoration: 'none' }}>
          <Image src="/images/tyt-logo.png" alt="Triboro Youth Theatre" width={48} height={48} style={{ objectFit: 'contain' }} />
        </a>
        <span style={{ fontFamily: 'var(--font-display)', fontSize: '1.1rem', fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase', color: 'var(--text-primary)' }}>
          Registration
        </span>
        <a href={`/register/${programId}/agreements`} style={{
          fontFamily: 'var(--font-display)', fontSize: '0.75rem', fontWeight: 600,
          letterSpacing: '0.1em', textTransform: 'uppercase', color: 'var(--gold)',
          textDecoration: 'none', border: '1px solid var(--gold)',
          borderRadius: 'var(--radius-sm)', padding: '0.35rem 0.85rem',
        }}>
          ← Back
        </a>
      </nav>

      <StepBar />

      <main style={{ maxWidth: '680px', margin: '0 auto', padding: '2rem 1.5rem' }}>
        <Suspense fallback={<div style={{ textAlign: 'center', color: 'var(--text-muted)', padding: '3rem', fontFamily: 'var(--font-accent)', fontStyle: 'italic' }}>Loading...</div>}>
          <ReviewForm programId={programId} />
        </Suspense>
      </main>
    </div>
  );
}