'use client';

import { useState, useEffect } from 'react';
import { useRouter, useParams, useSearchParams } from 'next/navigation';
import { loadStripe } from '@stripe/stripe-js';
import { Elements, PaymentElement, useStripe, useElements } from '@stripe/react-stripe-js';
import { createClient } from '@/lib/supabase/client';
import Image from 'next/image';

// Load Stripe outside of component to avoid recreating on every render
const stripePromise = loadStripe(process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY);

// Registration status IDs from DB
const REGISTRATION_STATUS_PENDING = '448779d0-8e45-47e1-b653-37d8fb16eb20';
const PAYMENT_STATUS_PENDING = '92d4b30c-799e-43ba-83e1-f7989d95f612';

// ─── Helpers ──────────────────────────────────────────────────────────────────

function fmt(amount) {
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(Number(amount) || 0);
}

// ─── Step Bar ─────────────────────────────────────────────────────────────────

function StepBar() {
  const steps = [
    { n: 1, label: 'Health',      done: true,  active: false },
    { n: 2, label: 'Agreements',  done: true,  active: false },
    { n: 3, label: 'Review',      done: true,  active: false },
    { n: 4, label: 'Payment',     done: false, active: true  },
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

// ─── Stripe Payment Form ───────────────────────────────────────────────────────

function PaymentForm({ cartItems, programId, participantId, totalDeposit, paymentIntentId }) {
  const stripe = useStripe();
  const elements = useElements();
  const router = useRouter();

  const [processing, setProcessing] = useState(false);
  const [error, setError] = useState('');

  async function handleSubmit(e) {
    e.preventDefault();
    if (!stripe || !elements) return;

    setProcessing(true);
    setError('');

    // Confirm payment with Stripe
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
      // Write all records to the database
      try {
        await saveRegistrations(paymentIntent.id);
        // Clear sessionStorage
        cartItems.forEach(item => {
          sessionStorage.removeItem(`health_${programId}_${item.participantId}`);
          sessionStorage.removeItem(`agreements_${programId}_${item.participantId}`);
        });
        sessionStorage.removeItem(`cart_${programId}`);
        router.push(`/register/${programId}/confirmation?participant=${participantId}`);
      } catch (dbErr) {
        console.error('[PaymentForm] DB error after payment:', dbErr);
        // Payment succeeded but DB failed — still redirect to confirmation
        // The webhook handler will reconcile
        router.push(`/register/${programId}/confirmation?participant=${participantId}`);
      }
    } else {
      setError('Payment was not completed. Please try again.');
      setProcessing(false);
    }
  }

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
        total_deposit: totalDeposit,
        status: 'paid',
      })
      .select('id')
      .single();

    if (cartErr) throw new Error('Failed to create cart: ' + cartErr.message);

    // 2. Create one registration + health record + agreements per cart item
    for (const item of cartItems) {
      const healthRaw   = sessionStorage.getItem(`health_${programId}_${item.participantId}`);
      const agreementsRaw = sessionStorage.getItem(`agreements_${programId}_${item.participantId}`);
      const health      = healthRaw     ? JSON.parse(healthRaw)     : null;
      const agreements  = agreementsRaw ? JSON.parse(agreementsRaw) : [];

      // Registration
      const { data: reg, error: regErr } = await supabase
        .from('registrations')
        .insert({
          family_id:                familyId,
          participant_id:           item.participantId,
          cart_id:                  cart.id,
          status_id:                REGISTRATION_STATUS_PENDING,
          sig_parent:               agreements[0]?.agreed_by || '',
          stripe_payment_intent_id: stripePaymentIntentId,
          amount_paid:              parseFloat(item.deposit),
          total_fee:                parseFloat(item.fee),
          is_financial_aid_requested: item.financialAid || false,
          registered_at:            new Date().toISOString(),
          updated_at:               new Date().toISOString(),
        })
        .select('id')
        .single();

      if (regErr) throw new Error('Failed to create registration: ' + regErr.message);

      // Health record
      if (health) {
        const { error: healthErr } = await supabase
          .from('health_records')
          .insert({
            registration_id:          reg.id,
            academic_flag:            health.academic_flag    || false,
            academic_notes:           health.academic_notes   || '',
            behavioral_flag:          health.behavioral_flag  || false,
            behavioral_notes:         health.behavioral_notes || '',
            allergies_flag:           health.allergies_flag   || false,
            allergies_notes:          health.allergies_notes  || '',
            epipen:                   health.epipen           || false,
            asthma:                   health.asthma           || false,
            concussion_flag:          health.concussion_flag  || false,
            concussion_date:          health.concussion_date  || null,
            concussion_cleared:       health.concussion_cleared    || false,
            concussion_symptoms:      health.concussion_symptoms   || false,
            concussion_symptoms_notes: health.concussion_symptoms_notes || '',
            general_comments:         health.general_comments || '',
          });
        if (healthErr) throw new Error('Failed to create health record: ' + healthErr.message);
      }

      // Agreements
      for (const agreement of agreements) {
        const { error: agreeErr } = await supabase
          .from('agreements')
          .insert({
            registration_id:    reg.id,
            family_id:          familyId,
            policy_document_id: agreement.policy_document_id,
            agreed_by:          agreement.agreed_by,
            agreed_at:          agreement.agreed_at,
          });
        if (agreeErr) throw new Error('Failed to create agreement: ' + agreeErr.message);
      }
    }

    // 3. Create payment record
    const { error: paymentErr } = await supabase
      .from('payments')
      .insert({
        family_id:                familyId,
        stripe_payment_intent_id: stripePaymentIntentId,
        amount:                   totalDeposit,
        status_id:                PAYMENT_STATUS_PENDING,
        paid_at:                  new Date().toISOString(),
      });

    if (paymentErr) throw new Error('Failed to create payment: ' + paymentErr.message);
  }

  return (
    <form onSubmit={handleSubmit}>
      {error && <div className="tyt-error" style={{ marginBottom: '1rem' }}>{error}</div>}

      <div style={{ background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 'var(--radius-md)', padding: '1.5rem', marginBottom: '1.5rem' }}>
        <PaymentElement
          options={{
            layout: 'tabs',
            fields: { billingDetails: { email: 'auto' } },
          }}
        />
      </div>

      <button
        type="submit"
        disabled={!stripe || !elements || processing}
        className="tyt-btn tyt-btn-primary tyt-btn-full"
        style={{ opacity: processing ? 0.7 : 1 }}
      >
        {processing ? 'Processing...' : `Pay ${fmt(totalDeposit)} Now`}
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
  const [cartItems, setCartItems] = useState([]);
  const [totalDeposit, setTotalDeposit] = useState(0);
  const [clientSecret, setClientSecret] = useState('');
  const [paymentIntentId, setPaymentIntentId] = useState('');

  useEffect(() => {
    if (!programId || programId === 'undefined') {
      setError('Missing registration parameters.');
      setStatus('error');
      return;
    }

    // Load cart from sessionStorage
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

    const total = items.reduce((sum, item) => sum + (parseFloat(item.deposit) || 0), 0);
    setCartItems(items);
    setTotalDeposit(total);

    // Create Payment Intent via API route
    async function createIntent() {
      try {
        const res = await fetch('/api/create-payment-intent', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ cartItems: items, programId }),
        });

        const data = await res.json();
        if (!res.ok) throw new Error(data.error || 'Failed to initialize payment');

        setClientSecret(data.clientSecret);
        setPaymentIntentId(data.paymentIntentId);
        setStatus('ready');
      } catch (err) {
        console.error('[PaymentPage] createIntent error:', err);
        setError(err.message);
        setStatus('error');
      }
    }

    createIntent();
  }, [programId]);

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
        {/* No back button on payment page — intentional */}
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

        {status === 'ready' && clientSecret && (
          <>
            <h2 style={{ fontFamily: 'var(--font-display)', fontSize: '1.3rem', fontWeight: 700, letterSpacing: '0.05em', textTransform: 'uppercase', color: 'var(--text-primary)', marginBottom: '0.25rem' }}>
              Payment
            </h2>
            <p style={{ fontFamily: 'var(--font-accent)', fontStyle: 'italic', color: 'var(--text-muted)', fontSize: '0.9rem', marginBottom: '1.5rem' }}>
              A deposit is due today to complete your registration.
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
                    <p style={{ fontFamily: 'var(--font-body)', fontSize: '0.75rem', color: 'var(--text-muted)' }}>{item.programLabel} — Deposit</p>
                  </div>
                  <span style={{ fontFamily: 'var(--font-display)', fontSize: '0.9rem', fontWeight: 700, color: 'var(--text-primary)' }}>{fmt(item.deposit)}</span>
                </div>
              ))}
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderTop: '1px solid var(--border)', paddingTop: '0.75rem', marginTop: '0.75rem' }}>
                <span style={{ fontFamily: 'var(--font-display)', fontSize: '0.8rem', fontWeight: 700, letterSpacing: '0.05em', textTransform: 'uppercase', color: 'var(--text-muted)' }}>Total Due Today</span>
                <span style={{ fontFamily: 'var(--font-display)', fontSize: '1.3rem', fontWeight: 800, color: 'var(--gold)' }}>{fmt(totalDeposit)}</span>
              </div>
            </div>

            {/* Stripe Elements */}
            <Elements
              stripe={stripePromise}
              options={{ clientSecret, appearance: stripeAppearance }}
            >
              <PaymentForm
                cartItems={cartItems}
                programId={programId}
                participantId={participantId}
                totalDeposit={totalDeposit}
                paymentIntentId={paymentIntentId}
              />
            </Elements>
          </>
        )}
      </main>
    </div>
  );
}