'use client';

import { useState, useEffect } from 'react';
import { useRouter, useParams, useSearchParams } from 'next/navigation';
import { loadStripe } from '@stripe/stripe-js';
import { Elements, PaymentElement, useStripe, useElements } from '@stripe/react-stripe-js';
import { createClient } from '@/lib/supabase/client';
import Image from 'next/image';
import WizardStepper from '@/components/WizardStepper';

const stripePromise = loadStripe(process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY);
const FEE_RATE = 0.05;

function fmt(amount) {
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(Number(amount) || 0);
}

function PaymentForm({ cartItems, programId, participantId, paymentAmount, totalCharged, stripeCustomerId, programData, maxPayment }) {
  const stripe = useStripe();
  const elements = useElements();
  const router = useRouter();
  const [processing, setProcessing] = useState(false);
  const [error, setError] = useState('');

  async function saveRegistrations(stripePaymentIntentId) {
    const cartItemsWithData = cartItems.map(item => ({
      ...item,
      health:     JSON.parse(sessionStorage.getItem(`health_${programId}_${item.participantId}`) || 'null'),
      agreements: JSON.parse(sessionStorage.getItem(`agreements_${programId}_${item.participantId}`) || '[]'),
    }));

    // Look for a stored waitlist token for any participant in this cart.
    // In practice, waitlist offers target a single participant — we forward whichever
    // token we find so save-registration can validate and accept it.
    let waitlistToken = null;
    let waitlistParticipantId = null;
    for (const item of cartItems) {
      const stored = sessionStorage.getItem(`waitlist_token_${programId}_${item.participantId}`);
      if (stored) {
        waitlistToken = stored;
        waitlistParticipantId = item.participantId;
        break;
      }
    }

    const res = await fetch('/api/save-registration', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        cartItems:             cartItemsWithData,
        programId,
        stripePaymentIntentId,
        paymentAmount,
        totalCharged,
        maxPayment,
        programData,
        stripeCustomerId,
        waitlistToken,
        waitlistParticipantId,
      }),
    });

    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Failed to save registration');
    return data.registrations || [];
  }

  async function handleSubmit(e) {
    e.preventDefault();
    if (!stripe || !elements) return;
    setProcessing(true);
    setError('');

    const { error: stripeError, paymentIntent } = await stripe.confirmPayment({ elements, redirect: 'if_required' });

    if (stripeError) { setError(stripeError.message); setProcessing(false); return; }

    if (paymentIntent.status === 'succeeded') {
      let createdRegs = [];
      try {
        createdRegs = await saveRegistrations(paymentIntent.id);
      } catch (dbErr) {
        console.error('[PaymentForm] DB error:', dbErr.message);
      }

      // Fire confirmation email — fire-and-forget so it doesn't block the redirect
      if (createdRegs.length > 0) {
        const registrationIds = createdRegs.map(r => r.registrationId);
        fetch('/api/send-confirmation', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ registrationIds }),
        }).catch(err => console.error('[PaymentForm] Confirmation email failed:', err));
      }

      cartItems.forEach(item => {
        sessionStorage.removeItem(`health_${programId}_${item.participantId}`);
        sessionStorage.removeItem(`agreements_${programId}_${item.participantId}`);
        sessionStorage.removeItem(`waitlist_token_${programId}_${item.participantId}`);
      });
      sessionStorage.removeItem(`cart_${programId}`);
      router.push(`/register/${programId}/confirmation?participant=${cartItems[0]?.participantId}`);
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
      <button type="submit" disabled={!stripe || !elements || processing} className="tyt-btn tyt-btn-primary tyt-btn-full" style={{ opacity: processing ? 0.7 : 1 }}>
        {processing ? 'Processing...' : `Pay ${fmt(totalCharged)} Now`}
      </button>
      <p style={{ fontFamily: 'var(--font-body)', fontSize: '0.75rem', color: 'var(--text-faint)', textAlign: 'center', marginTop: '1rem' }}>
        🔒 Payments are secured by Stripe. Your card details are never stored on our servers.
      </p>
    </form>
  );
}

export default function PaymentPage() {
  const params = useParams();
  const searchParams = useSearchParams();
  const programId = params?.id;
  const participantId = searchParams?.get('participant');

  const [status, setStatus] = useState('amount');
  const [error, setError] = useState('');
  const [cartItems, setCartItems] = useState([]);
  const [programData, setProgramData] = useState(null);
  const [minPayment, setMinPayment] = useState(0);
  const [maxPayment, setMaxPayment] = useState(0);
  const [inputValue, setInputValue] = useState('');
  const [amountError, setAmountError] = useState('');
  const [confirmedAmount, setConfirmedAmount] = useState(0);
  const [confirmedFee, setConfirmedFee] = useState(0);
  const [confirmedTotal, setConfirmedTotal] = useState(0);
  const [clientSecret, setClientSecret] = useState('');
  const [stripeCustomerId, setStripeCustomerId] = useState('');

  useEffect(() => {
    if (!programId || programId === 'undefined') { setError('Missing registration parameters.'); setStatus('error'); return; }
    const rawCart = sessionStorage.getItem(`cart_${programId}`);
    if (!rawCart) { setError('Your cart is empty. Please start your registration again.'); setStatus('error'); return; }
    const items = JSON.parse(rawCart);
    if (!items.length) { setError('Your cart is empty. Please start your registration again.'); setStatus('error'); return; }
    const totalDeposit = items.reduce((sum, i) => sum + (parseFloat(i.deposit) || 0), 0);
    const totalFee = items.reduce((sum, i) => sum + (parseFloat(i.fee) || 0), 0);
    setCartItems(items); setMinPayment(totalDeposit); setMaxPayment(totalFee);
    setInputValue(totalDeposit.toFixed(2));
    async function loadProgram() {
      const supabase = createClient();
      const { data: prog } = await supabase.from('programs').select('balance_due_date').eq('id', programId).single();
      setProgramData(prog);
    }
    loadProgram();
  }, [programId]);

  const parsedInput = parseFloat(inputValue) || 0;
  const previewFee = parsedInput * FEE_RATE;
  const previewTotal = parsedInput + previewFee;

  async function handleConfirmAmount() {
    setAmountError('');
    const amount = parseFloat(inputValue);
    if (isNaN(amount) || amount < minPayment) { setAmountError(`Minimum payment is ${fmt(minPayment)}.`); return; }
    if (amount > maxPayment) { setAmountError(`Maximum payment is ${fmt(maxPayment)}.`); return; }
    const fee = amount * FEE_RATE;
    const total = amount + fee;
    setConfirmedAmount(amount); setConfirmedFee(fee); setConfirmedTotal(total);
    try {
      const res = await fetch('/api/create-payment-intent', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ cartItems, programId, paymentAmount: amount }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to initialize payment');
      setClientSecret(data.clientSecret); setStripeCustomerId(data.stripeCustomerId);
      setStatus('checkout');
    } catch (err) { setAmountError(err.message); }
  }

  const stripeAppearance = { theme: 'night', variables: { colorPrimary: '#e0bf5c', colorBackground: '#1c1c1c', colorText: '#ffffff', colorDanger: '#b40000', fontFamily: 'DM Sans, sans-serif', borderRadius: '6px' } };
  const balanceDueDateStr = programData?.balance_due_date ? new Date(programData.balance_due_date + 'T00:00:00').toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' }) : null;

  return (
    <div style={{ minHeight: '100vh', background: 'var(--bg-dark)' }}>
      <nav style={{ background: 'var(--bg-card)', borderBottom: '1px solid var(--border)', padding: '0 1.5rem', display: 'flex', alignItems: 'center', justifyContent: 'space-between', height: '64px', position: 'sticky', top: 0, zIndex: 100 }}>
        <a href="/dashboard" style={{ display: 'flex', alignItems: 'center', textDecoration: 'none' }}>
          <Image src="/images/tyt-logo.png" alt="Triboro Youth Theatre" width={48} height={48} style={{ objectFit: 'contain' }} />
        </a>
        <span style={{ fontFamily: 'var(--font-display)', fontSize: '1.1rem', fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase', color: 'var(--text-primary)' }}>Registration</span>
        <div style={{ width: '80px' }} />
      </nav>

      <WizardStepper currentStep={4} />

      <main style={{ maxWidth: '680px', margin: '0 auto', padding: '2rem 1.5rem' }}>

        {status === 'error' && (
          <div>
            <div className="tyt-error" style={{ marginBottom: '1rem' }}>{error}</div>
            <a href="/register" className="tyt-btn tyt-btn-secondary" style={{ display: 'inline-flex' }}>← Back to Programs</a>
          </div>
        )}

        {status === 'amount' && (
          <>
            <h2 style={{ fontFamily: 'var(--font-display)', fontSize: '1.3rem', fontWeight: 700, letterSpacing: '0.05em', textTransform: 'uppercase', color: 'var(--text-primary)', marginBottom: '0.25rem' }}>Payment</h2>
            <p style={{ fontFamily: 'var(--font-accent)', fontStyle: 'italic', color: 'var(--text-muted)', fontSize: '0.9rem', marginBottom: '1.5rem' }}>Enter the amount you'd like to pay today. A minimum deposit is required.</p>

            <div style={{ background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 'var(--radius-md)', padding: '1.25rem', marginBottom: '1.25rem' }}>
              <p style={{ fontFamily: 'var(--font-display)', fontSize: '0.7rem', fontWeight: 600, letterSpacing: '0.1em', textTransform: 'uppercase', color: 'var(--text-faint)', marginBottom: '0.75rem' }}>Registration Summary</p>
              {cartItems.map((item, i) => (
                <div key={i} style={{ display: 'flex', justifyContent: 'space-between', paddingBottom: i < cartItems.length - 1 ? '0.5rem' : 0, marginBottom: i < cartItems.length - 1 ? '0.5rem' : 0, borderBottom: i < cartItems.length - 1 ? '1px solid var(--border)' : 'none' }}>
                  <div>
                    <p style={{ fontFamily: 'var(--font-body)', fontSize: '0.875rem', color: 'var(--text-primary)' }}>{item.participantName}</p>
                    <p style={{ fontFamily: 'var(--font-body)', fontSize: '0.75rem', color: 'var(--text-muted)' }}>{item.programLabel}</p>
                  </div>
                  <p style={{ fontFamily: 'var(--font-body)', fontSize: '0.875rem', color: 'var(--text-muted)' }}>{fmt(item.fee)} + fees</p>
                </div>
              ))}
            </div>

            <div style={{ background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 'var(--radius-md)', padding: '1.25rem', marginBottom: '1.25rem' }}>
              <label style={{ fontFamily: 'var(--font-display)', fontSize: '0.7rem', fontWeight: 600, letterSpacing: '0.1em', textTransform: 'uppercase', color: 'var(--text-faint)', display: 'block', marginBottom: '0.5rem' }}>Payment Amount</label>
              <p style={{ fontFamily: 'var(--font-body)', fontSize: '0.8rem', color: 'var(--text-muted)', marginBottom: '0.875rem' }}>
                Minimum: <strong style={{ color: 'var(--text-primary)' }}>{fmt(minPayment)}</strong> &nbsp;·&nbsp; Maximum: <strong style={{ color: 'var(--text-primary)' }}>{fmt(maxPayment)}</strong>
              </p>
              <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '1rem', flexWrap: 'wrap' }}>
                {[{ label: 'Min Deposit', amount: minPayment }, ...(Math.round(maxPayment * 0.5) > minPayment ? [{ label: 'Half Balance', amount: Math.round(maxPayment * 0.5) }] : []), { label: 'Pay in Full', amount: maxPayment }].map(opt => (
                  <button key={opt.label} type="button" onClick={() => setInputValue(opt.amount.toFixed(2))} style={{ fontFamily: 'var(--font-display)', fontSize: '0.65rem', fontWeight: 600, letterSpacing: '0.08em', textTransform: 'uppercase', padding: '0.35rem 0.875rem', borderRadius: 'var(--radius-sm)', cursor: 'pointer', border: `1px solid ${parseFloat(inputValue) === opt.amount ? 'var(--red)' : 'var(--border)'}`, background: parseFloat(inputValue) === opt.amount ? 'var(--red)' : 'transparent', color: parseFloat(inputValue) === opt.amount ? '#fff' : 'var(--text-muted)' }}>
                    {opt.label} · {fmt(opt.amount)}
                  </button>
                ))}
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '1rem' }}>
                <span style={{ fontFamily: 'var(--font-body)', color: 'var(--text-muted)', fontSize: '1rem' }}>$</span>
                <input type="number" min={minPayment} max={maxPayment} step="0.01" value={inputValue} onChange={e => setInputValue(e.target.value)} className="tyt-input" style={{ maxWidth: '160px' }} />
              </div>
              {amountError && <p style={{ fontFamily: 'var(--font-body)', fontSize: '0.8rem', color: 'var(--red)', marginBottom: '0.75rem' }}>{amountError}</p>}
              {parsedInput > 0 && (
                <div style={{ background: 'var(--bg-hover)', borderRadius: 'var(--radius-sm)', padding: '0.875rem 1rem' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.3rem' }}>
                    <span style={{ fontFamily: 'var(--font-body)', fontSize: '0.85rem', color: 'var(--text-muted)' }}>Payment</span>
                    <span style={{ fontFamily: 'var(--font-body)', fontSize: '0.85rem', color: 'var(--text-primary)' }}>{fmt(parsedInput)}</span>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.5rem' }}>
                    <span style={{ fontFamily: 'var(--font-body)', fontSize: '0.85rem', color: 'var(--text-muted)' }}>Processing fee (5%)</span>
                    <span style={{ fontFamily: 'var(--font-body)', fontSize: '0.85rem', color: 'var(--text-primary)' }}>{fmt(previewFee)}</span>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', borderTop: '1px solid var(--border)', paddingTop: '0.5rem' }}>
                    <span style={{ fontFamily: 'var(--font-display)', fontSize: '0.8rem', fontWeight: 700, letterSpacing: '0.05em', textTransform: 'uppercase', color: 'var(--text-muted)' }}>Total Charged</span>
                    <span style={{ fontFamily: 'var(--font-display)', fontSize: '1.1rem', fontWeight: 800, color: 'var(--gold)' }}>{fmt(previewTotal)}</span>
                  </div>
                </div>
              )}
              {parsedInput > 0 && parsedInput < maxPayment && (
                <div style={{ marginTop: '0.75rem', padding: '0.6rem 0.875rem', background: 'var(--bg-dark)', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border)' }}>
                  <p style={{ fontFamily: 'var(--font-body)', fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                    Remaining balance of <strong style={{ color: 'var(--text-primary)' }}>{fmt(maxPayment - parsedInput)}</strong> + 5% processing fee will be invoiced{balanceDueDateStr ? ` and due by ${balanceDueDateStr}` : ''}.
                  </p>
                </div>
              )}
            </div>

            <button onClick={handleConfirmAmount} className="tyt-btn tyt-btn-primary tyt-btn-full">Continue to Payment →</button>
          </>
        )}

        {status === 'checkout' && clientSecret && (
          <>
            <h2 style={{ fontFamily: 'var(--font-display)', fontSize: '1.3rem', fontWeight: 700, letterSpacing: '0.05em', textTransform: 'uppercase', color: 'var(--text-primary)', marginBottom: '0.25rem' }}>Enter Payment Details</h2>
            <p style={{ fontFamily: 'var(--font-accent)', fontStyle: 'italic', color: 'var(--text-muted)', fontSize: '0.9rem', marginBottom: '1.5rem' }}>Review your order summary before completing payment.</p>

            <div style={{ background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 'var(--radius-md)', padding: '1.25rem', marginBottom: '1.5rem' }}>
              <p style={{ fontFamily: 'var(--font-display)', fontSize: '0.7rem', fontWeight: 600, letterSpacing: '0.1em', textTransform: 'uppercase', color: 'var(--text-faint)', marginBottom: '0.75rem' }}>Order Summary</p>
              {cartItems.map((item, i) => (
                <div key={i} style={{ display: 'flex', justifyContent: 'space-between', paddingBottom: i < cartItems.length - 1 ? '0.5rem' : 0, marginBottom: i < cartItems.length - 1 ? '0.5rem' : 0, borderBottom: i < cartItems.length - 1 ? '1px solid var(--border)' : 'none' }}>
                  <div>
                    <p style={{ fontFamily: 'var(--font-body)', fontSize: '0.875rem', color: 'var(--text-primary)' }}>{item.participantName}</p>
                    <p style={{ fontFamily: 'var(--font-body)', fontSize: '0.75rem', color: 'var(--text-muted)' }}>{item.programLabel} — Payment</p>
                  </div>
                </div>
              ))}
              <div style={{ borderTop: '1px solid var(--border)', marginTop: '0.75rem', paddingTop: '0.75rem' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.3rem' }}>
                  <span style={{ fontFamily: 'var(--font-body)', fontSize: '0.85rem', color: 'var(--text-muted)' }}>Payment</span>
                  <span style={{ fontFamily: 'var(--font-body)', fontSize: '0.85rem', color: 'var(--text-primary)' }}>{fmt(confirmedAmount)}</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.5rem' }}>
                  <span style={{ fontFamily: 'var(--font-body)', fontSize: '0.85rem', color: 'var(--text-muted)' }}>Processing fee (5%)</span>
                  <span style={{ fontFamily: 'var(--font-body)', fontSize: '0.85rem', color: 'var(--text-primary)' }}>{fmt(confirmedFee)}</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', borderTop: '1px solid var(--border)', paddingTop: '0.5rem' }}>
                  <span style={{ fontFamily: 'var(--font-display)', fontSize: '0.8rem', fontWeight: 700, letterSpacing: '0.05em', textTransform: 'uppercase', color: 'var(--text-muted)' }}>Total Charged</span>
                  <span style={{ fontFamily: 'var(--font-display)', fontSize: '1.1rem', fontWeight: 800, color: 'var(--gold)' }}>{fmt(confirmedTotal)}</span>
                </div>
              </div>
            </div>

            <button type="button" onClick={() => setStatus('amount')} style={{ background: 'none', border: 'none', fontFamily: 'var(--font-display)', fontSize: '0.75rem', fontWeight: 600, letterSpacing: '0.08em', textTransform: 'uppercase', color: 'var(--gold)', cursor: 'pointer', padding: 0, marginBottom: '1rem', textDecoration: 'underline' }}>
              ← Change Amount
            </button>

            <Elements stripe={stripePromise} options={{ clientSecret, appearance: stripeAppearance }}>
              <PaymentForm cartItems={cartItems} programId={programId} participantId={participantId} paymentAmount={confirmedAmount} totalCharged={confirmedTotal} stripeCustomerId={stripeCustomerId} programData={programData} maxPayment={maxPayment} />
            </Elements>
          </>
        )}
      </main>
    </div>
  );
}