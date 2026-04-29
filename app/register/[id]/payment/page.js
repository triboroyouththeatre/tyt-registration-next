'use client';

import { useState, useEffect, useCallback } from 'react';
import { useRouter, useParams, useSearchParams } from 'next/navigation';
import { loadStripe } from '@stripe/stripe-js';
import { Elements, PaymentElement, useStripe, useElements } from '@stripe/react-stripe-js';
import { createClient } from '@/lib/supabase/client';
import Image from 'next/image';

const stripePromise = loadStripe(process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY);
const FEE_RATE = 0.05;
const REGISTRATION_STATUS_PENDING = '448779d0-8e45-47e1-b653-37d8fb16eb20';
const PAYMENT_STATUS_PENDING = '92d4b30c-799e-43ba-83e1-f7989d95f612';

// ─── Helpers ──────────────────────────────────────────────────────────────────

function fmt(amount) {
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(Number(amount) || 0);
}

// ─── Step Bar ─────────────────────────────────────────────────────────────────

function StepBar() {
  const steps = [
    { n: 1, label: 'Health',     done: true,  active: false },
    { n: 2, label: 'Agreements', done: true,  active: false },
    { n: 3, label: 'Review',     done: true,  active: false },
    { n: 4, label: 'Payment',    done: false, active: true  },
  ];
  return (
    <div style={{ background: 'var(--bg-card)', borderBottom: '1px solid var(--border)', padding: '0.75rem 1.5rem' }}>
      <div style={{ maxWidth: '680px', margin: '0 auto', display: 'flex', alignItems: 'center' }}>
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

// ─── Payment Form ──────────────────────────────────────────────────────────────

function PaymentForm({ cartItems, programId, participantId, paymentAmount, feeAmount, totalCharged, stripeCustomerId, programData }) {
  const stripe = useStripe();
  const elements = useElements();
  const router = useRouter();

  const [processing, setProcessing] = useState(false);
  const [error, setError] = useState('');

  async function saveRegistrations(stripePaymentIntentId) {
    const supabase = createClient();
    const { data: { user } } = await supabase.auth.getUser();
    const { data: profile } = await supabase.from('profiles').select('family_id').eq('id', user.id).single();
    const familyId = profile.family_id;

    // 1. Create cart record
    const { data: cart, error: cartErr } = await supabase
      .from('carts')
      .insert({
        family_id: familyId,
        stripe_payment_intent_id: stripePaymentIntentId,
        total_deposit: paymentAmount,
        status: 'paid',
      })
      .select('id')
      .single();
    if (cartErr) throw new Error('Failed to create cart: ' + cartErr.message);

    const createdRegistrations = [];

    // 2. One registration + health + agreements per cart item
    for (const item of cartItems) {
      const healthRaw     = sessionStorage.getItem(`health_${programId}_${item.participantId}`);
      const agreementsRaw = sessionStorage.getItem(`agreements_${programId}_${item.participantId}`);
      const health        = healthRaw     ? JSON.parse(healthRaw)     : null;
      const agreements    = agreementsRaw ? JSON.parse(agreementsRaw) : [];

      // Per-participant payment share (split evenly)
      const perParticipantPaid = paymentAmount / cartItems.length;
      const perParticipantFee  = parseFloat(item.fee);

      const { data: reg, error: regErr } = await supabase
        .from('registrations')
        .insert({
          family_id:                  familyId,
          participant_id:             item.participantId,
          cart_id:                    cart.id,
          status_id:                  REGISTRATION_STATUS_PENDING,
          sig_parent:                 agreements[0]?.agreed_by || '',
          stripe_payment_intent_id:   stripePaymentIntentId,
          amount_paid:                perParticipantPaid,
          total_fee:                  perParticipantFee,
          is_financial_aid_requested: item.financialAid || false,
          registered_at:              new Date().toISOString(),
          updated_at:                 new Date().toISOString(),
        })
        .select('id')
        .single();
      if (regErr) throw new Error('Failed to create registration: ' + regErr.message);

      // Health record
      if (health) {
        const { error: healthErr } = await supabase.from('health_records').insert({
          registration_id:           reg.id,
          academic_flag:             health.academic_flag             || false,
          academic_notes:            health.academic_notes            || '',
          behavioral_flag:           health.behavioral_flag           || false,
          behavioral_notes:          health.behavioral_notes          || '',
          allergies_flag:            health.allergies_flag            || false,
          allergies_notes:           health.allergies_notes           || '',
          epipen:                    health.epipen                    || false,
          asthma:                    health.asthma                    || false,
          concussion_flag:           health.concussion_flag           || false,
          concussion_date:           health.concussion_date           || null,
          concussion_cleared:        health.concussion_cleared        || false,
          concussion_symptoms:       health.concussion_symptoms       || false,
          concussion_symptoms_notes: health.concussion_symptoms_notes || '',
          general_comments:          health.general_comments          || '',
        });
        if (healthErr) throw new Error('Failed to create health record: ' + healthErr.message);
      }

      // Agreements
      for (const agreement of agreements) {
        const { error: agreeErr } = await supabase.from('agreements').insert({
          registration_id:    reg.id,
          family_id:          familyId,
          policy_document_id: agreement.policy_document_id,
          agreed_by:          agreement.agreed_by,
          agreed_at:          agreement.agreed_at,
        });
        if (agreeErr) throw new Error('Failed to create agreement: ' + agreeErr.message);
      }

      createdRegistrations.push({
        registrationId:  reg.id,
        participantName: item.participantName,
        programLabel:    item.programLabel,
        totalFee:        perParticipantFee,
        amountPaid:      perParticipantPaid,
        financialAid:    item.financialAid || false,
        balanceDueDate:  programData?.balance_due_date || null,
      });
    }

    // 3. Payment record
    const { error: paymentErr } = await supabase.from('payments').insert({
      family_id:                familyId,
      stripe_payment_intent_id: stripePaymentIntentId,
      amount:                   totalCharged,
      status_id:                PAYMENT_STATUS_PENDING,
      paid_at:                  new Date().toISOString(),
    });
    if (paymentErr) throw new Error('Failed to create payment: ' + paymentErr.message);

    // 4. Create invoice for non-FA registrations only
    const nonFARegistrations = createdRegistrations.filter(r => {
      const balance = r.totalFee - r.amountPaid;
      return !r.financialAid && balance > 0.01;
    });

    if (nonFARegistrations.length > 0 && stripeCustomerId) {
      try {
        await fetch('/api/create-invoice', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            stripeCustomerId,
            registrations: nonFARegistrations,
          }),
        });
      } catch (invoiceErr) {
        // Invoice failure is non-fatal — registration is still created
        console.error('[PaymentForm] Invoice creation failed:', invoiceErr);
      }
    }
  }

  async function handleSubmit(e) {
    e.preventDefault();
    if (!stripe || !elements) return;

    setProcessing(true);
    setError('');

    const { error: stripeError, paymentIntent } = await stripe.confirmPayment({
      elements,
      redirect: 'if_required',
    });

    if (stripeError) {
      setError(stripeError.message);
      setProcessing(false);
      return;
    }

    if (paymentIntent.status === 'succeeded') {
      try {
        await saveRegistrations(paymentIntent.id);
      } catch (dbErr) {
        console.error('[PaymentForm] DB save error:', dbErr);
        // Payment succeeded — still redirect even if DB write fails partially
        // Webhook handler will reconcile
      }

      // Clear sessionStorage
      cartItems.forEach(item => {
        sessionStorage.removeItem(`health_${programId}_${item.participantId}`);
        sessionStorage.removeItem(`agreements_${programId}_${item.participantId}`);
      });
      sessionStorage.removeItem(`cart_${programId}`);

      router.push(`/register/${programId}/confirmation?participant=${participantId}`);
    } else {
      setError('Payment was not completed. Please try again.');
      setProcessing(false);
    }
  }

  return (
    <form onSubmit={handleSubmit}>
      {error && <div className="tyt-error" style={{ marginBottom: '1rem' }}>{error}</div>}

      <div style={{ background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 'var(--radius-md)', padding: '1.5rem', marginBottom: '1.5rem' }}>
        <PaymentElement options={{ layout: 'tabs' }} />
      </div>

      <button
        type="submit"
        disabled={!stripe || !elements || processing}
        className="tyt-btn tyt-btn-primary tyt-btn-full"
        style={{ opacity: processing ? 0.7 : 1 }}
      >
        {processing ? 'Processing...' : `Pay ${fmt(totalCharged)} Now`}
      </button>

      <p style={{ fontFamily: 'var(--font-body)', fontSize: '0.75rem', color: 'var(--text-faint)', textAlign: 'center', marginTop: '1rem' }}>
        🔒 Payments are secured by Stripe. Your card details are never stored on our servers.
      </p>
    </form>
  );
}

// ─── Main Page ─────────────────────────────────────────────────────────────────

export default function PaymentPage() {
  const params = useParams();
  const searchParams = useSearchParams();
  const programId = params?.id;
  const participantId = searchParams?.get('participant');

  const [status, setStatus] = useState('loading');
  const [error, setError] = useState('');

  // Cart data
  const [cartItems, setCartItems] = useState([]);
  const [programData, setProgramData] = useState(null);
  const [minPayment, setMinPayment] = useState(0);
  const [maxPayment, setMaxPayment] = useState(0);
  const [paymentAmount, setPaymentAmount] = useState(0);

  // Stripe
  const [clientSecret, setClientSecret] = useState('');
  const [stripeCustomerId, setStripeCustomerId] = useState('');
  const [intentCreated, setIntentCreated] = useState(false);

  // Derived fee values
  const feeAmount    = paymentAmount * FEE_RATE;
  const totalCharged = paymentAmount + feeAmount;

  useEffect(() => {
    if (!programId || programId === 'undefined') {
      setError('Missing registration parameters.');
      setStatus('error');
      return;
    }

    const rawCart = sessionStorage.getItem(`cart_${programId}`);
    if (!rawCart) {
      setError('Your cart is empty. Please start your registration again.');
      setStatus('error');
      return;
    }

    const items = JSON.parse(rawCart);
    if (!items.length) {
      setError('Your cart is empty. Please start your registration again.');
      setStatus('error');
      return;
    }

    // Calculate min (total deposits) and max (total fees)
    const totalDeposit = items.reduce((sum, item) => sum + (parseFloat(item.deposit) || 0), 0);
    const totalFee     = items.reduce((sum, item) => sum + (parseFloat(item.fee)     || 0), 0);

    setCartItems(items);
    setMinPayment(totalDeposit);
    setMaxPayment(totalFee);
    setPaymentAmount(totalDeposit); // default to deposit

    // Fetch program data for balance_due_date
    async function loadProgram() {
      const supabase = createClient();
      const { data: prog } = await supabase
        .from('programs')
        .select('balance_due_date')
        .eq('id', programId)
        .single();
      setProgramData(prog);
      setStatus('ready');
    }

    loadProgram();
  }, [programId]);

  // Create/recreate payment intent when paymentAmount changes (debounced)
  useEffect(() => {
    if (status !== 'ready' || paymentAmount <= 0) return;

    const timer = setTimeout(async () => {
      try {
        setIntentCreated(false);
        const res = await fetch('/api/create-payment-intent', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ cartItems, programId, paymentAmount }),
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || 'Failed to initialize payment');
        setClientSecret(data.clientSecret);
        setStripeCustomerId(data.stripeCustomerId);
        setIntentCreated(true);
      } catch (err) {
        console.error('[PaymentPage] createIntent error:', err);
        setError(err.message);
      }
    }, 600); // debounce 600ms

    return () => clearTimeout(timer);
  }, [paymentAmount, status]);

  function handleAmountChange(val) {
    const num = parseFloat(val);
    if (isNaN(num)) return;
    if (num < minPayment) setPaymentAmount(minPayment);
    else if (num > maxPayment) setPaymentAmount(maxPayment);
    else setPaymentAmount(num);
  }

  const stripeAppearance = {
    theme: 'night',
    variables: {
      colorPrimary: '#e0bf5c',
      colorBackground: '#1c1c1c',
      colorText: '#ffffff',
      colorDanger: '#b40000',
      fontFamily: 'DM Sans, sans-serif',
      borderRadius: '6px',
    },
  };

  return (
    <div style={{ minHeight: '100vh', background: 'var(--bg-dark)' }}>

      {/* Nav */}
      <nav style={{ background: 'var(--bg-card)', borderBottom: '1px solid var(--border)', padding: '0 1.5rem', display: 'flex', alignItems: 'center', justifyContent: 'space-between', height: '64px', position: 'sticky', top: 0, zIndex: 100 }}>
        <a href="/register" style={{ display: 'flex', alignItems: 'center', textDecoration: 'none' }}>
          <Image src="/images/tyt-logo.png" alt="Triboro Youth Theatre" width={48} height={48} style={{ objectFit: 'contain' }} />
        </a>
        <span style={{ fontFamily: 'var(--font-display)', fontSize: '1.1rem', fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase', color: 'var(--text-primary)' }}>
          Registration
        </span>
        <div style={{ width: '80px' }} />
      </nav>

      <StepBar />

      <main style={{ maxWidth: '680px', margin: '0 auto', padding: '2rem 1.5rem' }}>

        {status === 'loading' && (
          <div style={{ textAlign: 'center', padding: '4rem', fontFamily: 'var(--font-accent)', fontStyle: 'italic', color: 'var(--text-muted)' }}>
            Preparing your payment...
          </div>
        )}

        {status === 'error' && (
          <div>
            <div className="tyt-error" style={{ marginBottom: '1rem' }}>{error}</div>
            <a href="/register" className="tyt-btn tyt-btn-secondary" style={{ display: 'inline-flex' }}>← Back to Programs</a>
          </div>
        )}

        {status === 'ready' && (
          <>
            <h2 style={{ fontFamily: 'var(--font-display)', fontSize: '1.3rem', fontWeight: 700, letterSpacing: '0.05em', textTransform: 'uppercase', color: 'var(--text-primary)', marginBottom: '0.25rem' }}>
              Payment
            </h2>
            <p style={{ fontFamily: 'var(--font-accent)', fontStyle: 'italic', color: 'var(--text-muted)', fontSize: '0.9rem', marginBottom: '1.5rem' }}>
              A minimum deposit is required today. You may pay more to reduce your balance.
            </p>

            {/* Order Summary */}
            <div style={{ background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 'var(--radius-md)', padding: '1.25rem', marginBottom: '1.5rem' }}>
              <p style={{ fontFamily: 'var(--font-display)', fontSize: '0.7rem', fontWeight: 600, letterSpacing: '0.1em', textTransform: 'uppercase', color: 'var(--text-faint)', marginBottom: '0.75rem' }}>
                Order Summary
              </p>

              {cartItems.map((item, i) => (
                <div key={i} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', paddingBottom: i < cartItems.length - 1 ? '0.5rem' : 0, marginBottom: i < cartItems.length - 1 ? '0.5rem' : 0, borderBottom: i < cartItems.length - 1 ? '1px solid var(--border)' : 'none' }}>
                  <div>
                    <p style={{ fontFamily: 'var(--font-body)', fontSize: '0.875rem', color: 'var(--text-primary)' }}>{item.participantName}</p>
                    <p style={{ fontFamily: 'var(--font-body)', fontSize: '0.75rem', color: 'var(--text-muted)' }}>{item.programLabel} — Total fee {fmt(item.fee)} + fees</p>
                  </div>
                </div>
              ))}

              <div style={{ borderTop: '1px solid var(--border)', marginTop: '1rem', paddingTop: '1rem' }}>

                {/* Payment amount selector */}
                <div style={{ marginBottom: '1rem' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.4rem' }}>
                    <label style={{ fontFamily: 'var(--font-display)', fontSize: '0.7rem', fontWeight: 600, letterSpacing: '0.1em', textTransform: 'uppercase', color: 'var(--text-muted)' }}>
                      Payment Amount
                    </label>
                    <span style={{ fontFamily: 'var(--font-body)', fontSize: '0.75rem', color: 'var(--text-faint)' }}>
                      Min {fmt(minPayment)} · Max {fmt(maxPayment)}
                    </span>
                  </div>

                  {/* Slider */}
                  <input
                    type="range"
                    min={minPayment}
                    max={maxPayment}
                    step={1}
                    value={paymentAmount}
                    onChange={e => handleAmountChange(e.target.value)}
                    style={{ width: '100%', accentColor: 'var(--red)', marginBottom: '0.5rem', cursor: 'pointer' }}
                  />

                  {/* Manual input */}
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                    <span style={{ fontFamily: 'var(--font-body)', color: 'var(--text-muted)', fontSize: '0.9rem' }}>$</span>
                    <input
                      type="number"
                      min={minPayment}
                      max={maxPayment}
                      step={1}
                      value={paymentAmount}
                      onChange={e => handleAmountChange(e.target.value)}
                      className="tyt-input"
                      style={{ maxWidth: '140px' }}
                    />
                  </div>

                  {/* Quick select buttons */}
                  <div style={{ display: 'flex', gap: '0.5rem', marginTop: '0.75rem', flexWrap: 'wrap' }}>
                    {[minPayment, Math.round(maxPayment * 0.5), maxPayment].map((amt, i) => {
                      const labels = ['Min Deposit', 'Half', 'Pay in Full'];
                      if (amt <= 0) return null;
                      return (
                        <button
                          key={i}
                          type="button"
                          onClick={() => setPaymentAmount(amt)}
                          style={{
                            fontFamily: 'var(--font-display)', fontSize: '0.65rem', fontWeight: 600,
                            letterSpacing: '0.08em', textTransform: 'uppercase',
                            padding: '0.3rem 0.75rem', borderRadius: 'var(--radius-sm)', cursor: 'pointer',
                            border: `1px solid ${paymentAmount === amt ? 'var(--red)' : 'var(--border)'}`,
                            background: paymentAmount === amt ? 'var(--red)' : 'transparent',
                            color: paymentAmount === amt ? '#fff' : 'var(--text-muted)',
                          }}
                        >
                          {labels[i]} · {fmt(amt)}
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* Fee breakdown */}
                <div style={{ background: 'var(--bg-hover)', borderRadius: 'var(--radius-sm)', padding: '0.875rem 1rem' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.3rem' }}>
                    <span style={{ fontFamily: 'var(--font-body)', fontSize: '0.85rem', color: 'var(--text-muted)' }}>Payment</span>
                    <span style={{ fontFamily: 'var(--font-body)', fontSize: '0.85rem', color: 'var(--text-primary)' }}>{fmt(paymentAmount)}</span>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.5rem' }}>
                    <span style={{ fontFamily: 'var(--font-body)', fontSize: '0.85rem', color: 'var(--text-muted)' }}>Processing fee (5%)</span>
                    <span style={{ fontFamily: 'var(--font-body)', fontSize: '0.85rem', color: 'var(--text-primary)' }}>{fmt(feeAmount)}</span>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', borderTop: '1px solid var(--border)', paddingTop: '0.5rem' }}>
                    <span style={{ fontFamily: 'var(--font-display)', fontSize: '0.8rem', fontWeight: 700, letterSpacing: '0.05em', textTransform: 'uppercase', color: 'var(--text-muted)' }}>Total Charged Today</span>
                    <span style={{ fontFamily: 'var(--font-display)', fontSize: '1.1rem', fontWeight: 800, color: 'var(--gold)' }}>{fmt(totalCharged)}</span>
                  </div>
                </div>

                {/* Balance notice */}
                {paymentAmount < maxPayment && (
                  <div style={{ marginTop: '0.75rem', padding: '0.6rem 0.875rem', background: 'var(--bg-dark)', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border)' }}>
                    <p style={{ fontFamily: 'var(--font-body)', fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                      Remaining balance of <strong style={{ color: 'var(--text-primary)' }}>{fmt(maxPayment - paymentAmount)}</strong> + 5% fee will be invoiced
                      {programData?.balance_due_date ? ` and due by ${new Date(programData.balance_due_date + 'T00:00:00').toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}` : ''}.
                    </p>
                  </div>
                )}
              </div>
            </div>

            {/* Stripe Elements — only render when intent is ready */}
            {intentCreated && clientSecret ? (
              <Elements
                stripe={stripePromise}
                options={{ clientSecret, appearance: stripeAppearance }}
              >
                <PaymentForm
                  cartItems={cartItems}
                  programId={programId}
                  participantId={participantId}
                  paymentAmount={paymentAmount}
                  feeAmount={feeAmount}
                  totalCharged={totalCharged}
                  stripeCustomerId={stripeCustomerId}
                  programData={programData}
                />
              </Elements>
            ) : (
              <div style={{ textAlign: 'center', padding: '2rem', fontFamily: 'var(--font-accent)', fontStyle: 'italic', color: 'var(--text-muted)' }}>
                Updating payment details...
              </div>
            )}
          </>
        )}
      </main>
    </div>
  );
}