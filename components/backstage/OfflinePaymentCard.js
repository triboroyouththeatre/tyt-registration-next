'use client';

import { useState } from 'react';

function fmt(amount) {
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(Number(amount) || 0);
}

const OFFLINE_METHODS = [
  'Check',
  'Cash',
  'Scholarship',
  'Financial Aid Adjustment',
];

export default function OfflinePaymentCard({ registrationId, totalFee, amountPaid, onPaymentSaved }) {
  const [open, setOpen]       = useState(false);
  const [saving, setSaving]   = useState(false);
  const [error, setError]     = useState('');
  const [success, setSuccess] = useState('');
  const [form, setForm] = useState({
    amount:          '',
    method:          'Check',
    referenceNumber: '',
    receivedDate:    new Date().toISOString().slice(0, 10),
    notes:           '',
  });

  const balance = (parseFloat(totalFee) || 0) - (parseFloat(amountPaid) || 0);

  async function handleSubmit() {
    setError('');
    const amt = parseFloat(form.amount);
    if (!amt || amt <= 0) { setError('Please enter a valid amount.'); return; }
    if (amt > balance + 0.01) { setError(`Amount exceeds outstanding balance of ${fmt(balance)}.`); return; }

    setSaving(true);
    try {
      const res = await fetch('/api/offline-payment', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          registrationId,
          amount:          form.amount,
          method:          form.method,
          referenceNumber: form.referenceNumber || null,
          receivedDate:    form.receivedDate    || null,
          notes:           form.notes           || null,
        }),
      });
      const data = await res.json();
      if (!res.ok) { setError(data.error || 'Failed to record payment.'); setSaving(false); return; }

      setSuccess(`Payment of ${fmt(form.amount)} recorded. ${data.isFullyPaid ? 'Balance fully paid! Stripe invoice voided.' : `Remaining balance: ${fmt(data.newBalance)}.`} Receipt email sent.`);
      setForm({ amount: '', method: 'Check', referenceNumber: '', receivedDate: new Date().toISOString().slice(0, 10), notes: '' });
      setSaving(false);
      setOpen(false);
      onPaymentSaved();
    } catch {
      setError('Unexpected error. Please try again.');
      setSaving(false);
    }
  }

  if (balance <= 0.01) return null;

  return (
    <div style={{ background: '#fff', border: '1px solid #e5e7eb', borderRadius: '8px', padding: '1.25rem', marginBottom: '1rem' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: open ? '1rem' : 0 }}>
        <div>
          <p style={{ fontFamily: 'var(--font-display)', fontSize: '0.7rem', fontWeight: 700, letterSpacing: '0.12em', textTransform: 'uppercase', color: '#6b7280', margin: 0 }}>
            Record Offline Payment
          </p>
          <p style={{ fontFamily: 'var(--font-body)', fontSize: '0.8rem', color: '#9ca3af', margin: '2px 0 0 0' }}>
            Outstanding balance: <strong style={{ color: '#b40000' }}>{fmt(balance)}</strong>
          </p>
        </div>
        <button
          onClick={() => { setOpen(!open); setError(''); setSuccess(''); }}
          style={{ fontFamily: 'var(--font-display)', fontSize: '0.7rem', fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase', background: open ? '#f3f4f6' : '#111', color: open ? '#374151' : '#fff', border: '1px solid #e5e7eb', borderRadius: '6px', padding: '0.5rem 1rem', cursor: 'pointer' }}
        >
          {open ? 'Cancel' : '+ Record Payment'}
        </button>
      </div>

      {success && (
        <div style={{ background: '#f0fdf4', border: '1px solid #bbf7d0', borderRadius: '6px', padding: '0.75rem 1rem', marginBottom: '1rem', fontFamily: 'var(--font-body)', fontSize: '0.875rem', color: '#16a34a' }}>
          ✓ {success}
        </div>
      )}

      {open && (
        <div>
          {error && (
            <div style={{ background: '#fff5f5', border: '1px solid #fecaca', borderRadius: '6px', padding: '0.75rem 1rem', marginBottom: '1rem', fontFamily: 'var(--font-body)', fontSize: '0.875rem', color: '#b40000' }}>
              {error}
            </div>
          )}

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem', marginBottom: '0.75rem' }}>
            <div>
              <label style={{ fontFamily: 'var(--font-display)', fontSize: '0.65rem', fontWeight: 600, letterSpacing: '0.08em', textTransform: 'uppercase', color: '#6b7280', display: 'block', marginBottom: '0.3rem' }}>
                Amount * <span style={{ color: '#9ca3af', fontWeight: 400, textTransform: 'none', letterSpacing: 0 }}>max {fmt(balance)}</span>
              </label>
              <div style={{ position: 'relative' }}>
                <span style={{ position: 'absolute', left: '0.75rem', top: '50%', transform: 'translateY(-50%)', fontFamily: 'var(--font-body)', fontSize: '0.875rem', color: '#6b7280' }}>$</span>
                <input
                  type="number"
                  value={form.amount}
                  onChange={e => setForm(f => ({ ...f, amount: e.target.value }))}
                  step="0.01"
                  min="0.01"
                  max={balance}
                  placeholder={balance.toFixed(2)}
                  style={{ fontFamily: 'var(--font-body)', fontSize: '0.875rem', color: '#111', border: '1px solid #d1d5db', borderRadius: '6px', padding: '0.5rem 0.75rem 0.5rem 1.5rem', width: '100%', boxSizing: 'border-box', background: '#fff' }}
                />
              </div>
            </div>
            <div>
              <label style={{ fontFamily: 'var(--font-display)', fontSize: '0.65rem', fontWeight: 600, letterSpacing: '0.08em', textTransform: 'uppercase', color: '#6b7280', display: 'block', marginBottom: '0.3rem' }}>Payment Method *</label>
              <select
                value={form.method}
                onChange={e => setForm(f => ({ ...f, method: e.target.value }))}
                style={{ fontFamily: 'var(--font-body)', fontSize: '0.875rem', color: '#111', border: '1px solid #d1d5db', borderRadius: '6px', padding: '0.5rem 0.75rem', width: '100%', boxSizing: 'border-box', background: '#fff' }}
              >
                {OFFLINE_METHODS.map(m => <option key={m} value={m}>{m}</option>)}
              </select>
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem', marginBottom: '0.75rem' }}>
            <div>
              <label style={{ fontFamily: 'var(--font-display)', fontSize: '0.65rem', fontWeight: 600, letterSpacing: '0.08em', textTransform: 'uppercase', color: '#6b7280', display: 'block', marginBottom: '0.3rem' }}>Reference # <span style={{ color: '#9ca3af', fontWeight: 400, textTransform: 'none', letterSpacing: 0 }}>(check #, etc.)</span></label>
              <input
                type="text"
                value={form.referenceNumber}
                onChange={e => setForm(f => ({ ...f, referenceNumber: e.target.value }))}
                placeholder="Optional"
                style={{ fontFamily: 'var(--font-body)', fontSize: '0.875rem', color: '#111', border: '1px solid #d1d5db', borderRadius: '6px', padding: '0.5rem 0.75rem', width: '100%', boxSizing: 'border-box', background: '#fff' }}
              />
            </div>
            <div>
              <label style={{ fontFamily: 'var(--font-display)', fontSize: '0.65rem', fontWeight: 600, letterSpacing: '0.08em', textTransform: 'uppercase', color: '#6b7280', display: 'block', marginBottom: '0.3rem' }}>Date Received</label>
              <input
                type="date"
                value={form.receivedDate}
                onChange={e => setForm(f => ({ ...f, receivedDate: e.target.value }))}
                style={{ fontFamily: 'var(--font-body)', fontSize: '0.875rem', color: '#111', border: '1px solid #d1d5db', borderRadius: '6px', padding: '0.5rem 0.75rem', width: '100%', boxSizing: 'border-box', background: '#fff', colorScheme: 'light' }}
              />
            </div>
          </div>

          <div style={{ marginBottom: '1rem' }}>
            <label style={{ fontFamily: 'var(--font-display)', fontSize: '0.65rem', fontWeight: 600, letterSpacing: '0.08em', textTransform: 'uppercase', color: '#6b7280', display: 'block', marginBottom: '0.3rem' }}>Notes</label>
            <textarea
              value={form.notes}
              onChange={e => setForm(f => ({ ...f, notes: e.target.value }))}
              rows={2}
              placeholder="Optional internal notes..."
              style={{ fontFamily: 'var(--font-body)', fontSize: '0.875rem', color: '#111', border: '1px solid #d1d5db', borderRadius: '6px', padding: '0.5rem 0.75rem', width: '100%', boxSizing: 'border-box', background: '#fff', resize: 'vertical' }}
            />
          </div>

          <div style={{ background: '#f9fafb', border: '1px solid #e5e7eb', borderRadius: '6px', padding: '0.75rem 1rem', marginBottom: '1rem' }}>
            <p style={{ fontFamily: 'var(--font-display)', fontSize: '0.65rem', fontWeight: 600, letterSpacing: '0.1em', textTransform: 'uppercase', color: '#6b7280', margin: '0 0 0.5rem 0' }}>Payment Summary</p>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontFamily: 'var(--font-body)', fontSize: '0.8rem', marginBottom: '0.25rem' }}>
              <span style={{ color: '#6b7280' }}>Payment amount</span>
              <span style={{ color: '#111', fontWeight: 600 }}>{form.amount ? fmt(form.amount) : '—'}</span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontFamily: 'var(--font-body)', fontSize: '0.8rem', marginBottom: '0.25rem' }}>
              <span style={{ color: '#6b7280' }}>Remaining balance after</span>
              <span style={{ color: form.amount && (balance - parseFloat(form.amount)) <= 0.01 ? '#16a34a' : '#b40000', fontWeight: 600 }}>
                {form.amount ? fmt(Math.max(0, balance - parseFloat(form.amount))) : fmt(balance)}
              </span>
            </div>
            {form.amount && (balance - parseFloat(form.amount)) <= 0.01 && (
              <p style={{ fontFamily: 'var(--font-body)', fontSize: '0.75rem', color: '#16a34a', margin: '0.25rem 0 0 0' }}>
                ✓ Fully paid — Stripe invoice will be voided
              </p>
            )}
            {form.amount && (balance - parseFloat(form.amount)) > 0.01 && (
              <p style={{ fontFamily: 'var(--font-body)', fontSize: '0.75rem', color: '#6b7280', margin: '0.25rem 0 0 0' }}>
                Stripe invoice will be updated to reflect new balance
              </p>
            )}
            <p style={{ fontFamily: 'var(--font-body)', fontSize: '0.75rem', color: '#6b7280', margin: '0.25rem 0 0 0' }}>
              ✉ Receipt email will be sent automatically
            </p>
          </div>

          <button
            onClick={handleSubmit}
            disabled={saving || !form.amount}
            style={{ fontFamily: 'var(--font-display)', fontSize: '0.7rem', fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase', background: '#111', color: '#fff', border: 'none', borderRadius: '6px', padding: '0.5rem 1.5rem', cursor: saving || !form.amount ? 'not-allowed' : 'pointer', opacity: saving || !form.amount ? 0.6 : 1 }}
          >
            {saving ? 'Recording...' : 'Record Payment & Send Receipt'}
          </button>
        </div>
      )}
    </div>
  );
}
