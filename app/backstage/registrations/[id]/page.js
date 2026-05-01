'use client';

import { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import Link from 'next/link';

const AWARD_LEVELS = [
  { id: '386e44d8-0a4d-4462-85f1-adaa8231a287', label: 'No Award' },
  { id: 'a502ce6b-bb14-4d74-b46e-48f2a99b9066', label: '5 Show Award' },
  { id: '7dbcd732-c2d9-4571-ae2f-32ee7cde1a7e', label: '10 Show Award' },
  { id: '6d2de5d1-55aa-4939-a87f-dbd34cc640db', label: '15 Show Award' },
  { id: '09479537-63e1-44f5-bd2e-20e84ac66dd1', label: '20 Show Award' },
  { id: '576fad59-97da-45b8-9b77-5b61641f4127', label: '25 Show Award' },
  { id: '73278f6a-a642-4ad3-ad4d-d6012b9a0a03', label: '30 Show Award' },
  { id: '4ee7fa1e-e3e8-485b-bb61-3e8a4949a869', label: '35 Show Award' },
];

function fmt(amount) {
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(Number(amount) || 0);
}

function fmtDate(str) {
  if (!str) return '—';
  return new Date(str).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric', hour: 'numeric', minute: '2-digit' });
}

function fmtDateOnly(str) {
  if (!str) return '—';
  return new Date(str + 'T00:00:00').toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' });
}

function SectionHeader({ title }) {
  return (
    <p style={{ fontFamily: 'var(--font-display)', fontSize: '0.7rem', fontWeight: 700, letterSpacing: '0.12em', textTransform: 'uppercase', color: '#6b7280', margin: '0 0 0.75rem 0', paddingBottom: '0.5rem', borderBottom: '1px solid #e5e7eb' }}>
      {title}
    </p>
  );
}

function Row({ label, value }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', gap: '1rem', marginBottom: '0.5rem' }}>
      <span style={{ fontFamily: 'var(--font-display)', fontSize: '0.7rem', fontWeight: 600, letterSpacing: '0.08em', textTransform: 'uppercase', color: '#9ca3af', flexShrink: 0 }}>{label}</span>
      <span style={{ fontFamily: 'var(--font-body)', fontSize: '0.875rem', color: '#111', textAlign: 'right' }}>{value || '—'}</span>
    </div>
  );
}

function StatusBadge({ label }) {
  const colors = {
    'Active':    '#16a34a', 'Pending': '#d97706',
    'Cancelled': '#b40000', 'Paid':    '#16a34a',
    'Overdue':   '#b40000', 'Withdrawn': '#6b7280',
  };
  const c = colors[label] || '#6b7280';
  return (
    <span style={{ fontFamily: 'var(--font-display)', fontSize: '0.7rem', fontWeight: 600, letterSpacing: '0.06em', textTransform: 'uppercase', color: c, background: `${c}15`, border: `1px solid ${c}30`, borderRadius: '3px', padding: '0.25rem 0.6rem' }}>
      {label}
    </span>
  );
}

const card = { background: '#fff', border: '1px solid #e5e7eb', borderRadius: '8px', padding: '1.25rem', marginBottom: '1rem' };
const inputStyle = { fontFamily: 'var(--font-body)', fontSize: '0.875rem', color: '#111', border: '1px solid #d1d5db', borderRadius: '6px', padding: '0.5rem 0.75rem', width: '100%', boxSizing: 'border-box', background: '#fff' };
const btnPrimary = { fontFamily: 'var(--font-display)', fontSize: '0.7rem', fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase', background: '#111', color: '#fff', border: 'none', borderRadius: '6px', padding: '0.5rem 1.25rem', cursor: 'pointer' };
const btnSecondary = { fontFamily: 'var(--font-display)', fontSize: '0.7rem', fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase', background: '#fff', color: '#374151', border: '1px solid #d1d5db', borderRadius: '6px', padding: '0.5rem 1.25rem', cursor: 'pointer' };
const btnDanger = { ...btnPrimary, background: '#b40000' };

// ── OFFLINE PAYMENT CARD ──────────────────────────────────────────────────────
// Add this component to app/backstage/registrations/[id]/page.js
// Place it in the RIGHT COLUMN, below the Payment History card

const OFFLINE_METHODS = [
  'Check',
  'Cash',
  'Scholarship',
  'Financial Aid Adjustment',
];

function OfflinePaymentCard({ registrationId, totalFee, amountPaid, onPaymentSaved }) {
  const [open, setOpen]               = useState(false);
  const [saving, setSaving]           = useState(false);
  const [error, setError]             = useState('');
  const [success, setSuccess]         = useState('');
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
      onPaymentSaved(); // Reload page data
    } catch (err) {
      setError('Unexpected error. Please try again.');
      setSaving(false);
    }
  }

  function fmt(amount) {
    return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(Number(amount) || 0);
  }

  if (balance <= 0.01) return null; // No card if fully paid

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

          {/* Summary preview */}
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

export default function RegistrationDetailPage() {
  const params = useParams();
  const router = useRouter();
  const regId = params?.id;

  const [loading, setLoading]         = useState(true);
  const [reg, setReg]                 = useState(null);
  const [participant, setParticipant] = useState(null);
  const [health, setHealth]           = useState(null);
  const [agreements, setAgreements]   = useState([]);
  const [payments, setPayments]       = useState([]);
  const [program, setProgram]         = useState(null);
  const [gradeLevels, setGradeLevels] = useState([]);
  const [regStatuses, setRegStatuses] = useState([]);
  const [contacts, setContacts] = useState([]);

async function reloadPayments() {
    const supabase = createClient();
    const { data: pay } = await supabase
      .from('payments')
      .select('id, amount, paid_at, payment_method, reference_number, payment_statuses(label), payment_types(label)')
      .eq('registration_id', regId)
      .order('paid_at', { ascending: false });
    setPayments(pay || []);

    const { data: updatedReg } = await supabase
      .from('registrations')
      .select('amount_paid, total_fee')
      .eq('id', regId)
      .single();
    if (updatedReg) setReg(r => ({ ...r, amount_paid: updatedReg.amount_paid, total_fee: updatedReg.total_fee }));
  }  

  // Edit states
  const [editingParticipant, setEditingParticipant] = useState(false);
  const [editingAward, setEditingAward]             = useState(false);
  const [editingRegStatus, setEditingRegStatus]     = useState(false);
  const [saving, setSaving]                         = useState(false);
  const [saveMsg, setSaveMsg]                       = useState('');

  // Participant form
  const [pForm, setPForm] = useState({});
  // Award form
  const [awardLevelId, setAwardLevelId] = useState('');
  // Reg status form
  const [newRegStatusId, setNewRegStatusId] = useState('');
  const CANCELLED_STATUS_ID = '1878c625-8ce3-472c-b6d1-b84fdb04d90b';
  const [cancelling, setCancelling]     = useState(false);
  const [cancelDone, setCancelDone]     = useState(false);
  const [refundAmount, setRefundAmount] = useState('');
  const [spotReleased, setSpotReleased] = useState(false);

  useEffect(() => {
    async function load() {
      const supabase = createClient();

      const { data: regData } = await supabase
        .from('registrations')
        .select(`
          id, registration_number, registered_at, updated_at,
          amount_paid, total_fee, is_financial_aid_requested,
          sig_parent, cart_id, award_level_id,
          participant_id,
          registration_statuses(id, label),
          award_levels(label)
        `)
        .eq('id', regId)
        .single();

      if (!regData) { setLoading(false); return; }
      setReg(regData);
      setAwardLevelId(regData.award_level_id || '');
      setNewRegStatusId(regData.registration_statuses?.id || '');

      // Participant
      const { data: p } = await supabase
        .from('participants')
        .select('id, first_name, last_name, nickname, yog, date_of_birth, gender_id, phone, email, genders(label)')
        .eq('id', regData.participant_id)
        .single();
      setParticipant(p);
      if (p) setPForm({ first_name: p.first_name || '', last_name: p.last_name || '', nickname: p.nickname || '', phone: p.phone || '', email: p.email || '' });

      // Health
      const { data: h } = await supabase.from('health_records').select('*').eq('registration_id', regId).single();
      setHealth(h);

      // Agreements
      const { data: ag } = await supabase
        .from('agreements')
        .select('id, agreed_by, agreed_at, policy_documents(type)')
        .eq('registration_id', regId)
        .order('agreed_at');
      setAgreements(ag || []);

      // Payments
      const { data: pay } = await supabase
        .from('payments')
        .select('id, amount, paid_at, payment_statuses(label), payment_types(label)')
        .eq('registration_id', regId)
        .order('paid_at', { ascending: false });
      setPayments(pay || []);

      // Program
      if (regData.cart_id) {
        const { data: cart } = await supabase.from('carts').select('program_id').eq('id', regData.cart_id).single();
        if (cart?.program_id) {
          const { data: prog } = await supabase
            .from('programs')
            .select('label, fee, deposit_amount, balance_due_date, sessions(name, seasons(display_name, name))')
            .eq('id', cart.program_id)
            .single();
          setProgram(prog);
        }
      }

      // Contacts for the family
      const { data: familyReg } = await supabase
        .from('registrations')
        .select('family_id')
        .eq('id', regId)
        .single();

      if (familyReg?.family_id) {
        const { data: ct } = await supabase
          .from('contacts')
          .select('priority, first_name, last_name, phone, email, relationships(label)')
          .eq('family_id', familyReg.family_id)
          .order('priority');
        setContacts(ct || []);
      }

      // Grade levels + reg statuses
      const [{ data: gl }, { data: rs }] = await Promise.all([
        supabase.from('grade_levels').select('yog, label, seasons!inner(is_active)').eq('seasons.is_active', true),
        supabase.from('registration_statuses').select('id, label').order('label'),
      ]);
      setGradeLevels(gl || []);
      setRegStatuses(rs || []);

      setLoading(false);
    }
    load();
  }, [regId]);

  function getGrade(yog) {
    return gradeLevels?.find(g => g.yog === yog)?.label || `YOG ${yog}`;
  }

  async function saveParticipant() {
    setSaving(true);
    const supabase = createClient();
    await supabase.from('participants').update({
      first_name: pForm.first_name.trim(),
      last_name:  pForm.last_name.trim(),
      nickname:   pForm.nickname.trim() || null,
      phone:      pForm.phone || null,
      email:      pForm.email.trim() || null,
    }).eq('id', participant.id);
    setParticipant(p => ({ ...p, ...pForm }));
    setEditingParticipant(false);
    setSaving(false);
    setSaveMsg('Participant updated.');
    setTimeout(() => setSaveMsg(''), 3000);
  }

  async function saveAward() {
    setSaving(true);
    const supabase = createClient();
    await supabase.from('registrations').update({ award_level_id: awardLevelId, updated_at: new Date().toISOString() }).eq('id', regId);
    setReg(r => ({ ...r, award_level_id: awardLevelId, award_levels: { label: AWARD_LEVELS.find(a => a.id === awardLevelId)?.label } }));
    setEditingAward(false);
    setSaving(false);
    setSaveMsg('Award level updated.');
    setTimeout(() => setSaveMsg(''), 3000);
  }

  async function saveRegStatus() {
    // If changing to Cancelled, let the cancellation panel handle it
    if (newRegStatusId === CANCELLED_STATUS_ID) return;
    setSaving(true);
    const supabase = createClient();
    await supabase.from('registrations').update({ status_id: newRegStatusId, updated_at: new Date().toISOString() }).eq('id', regId);
    const matched = regStatuses.find(s => s.id === newRegStatusId);
    setReg(r => ({ ...r, registration_statuses: { id: newRegStatusId, label: matched?.label } }));
    setEditingRegStatus(false);
    setSaving(false);
    setSaveMsg('Registration status updated.');
    setTimeout(() => setSaveMsg(''), 3000);
  }

  async function confirmCancellation() {
    setCancelling(true);
    try {
      const res = await fetch('/api/cancel-registration', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          registrationId: regId,
          refundAmount:   refundAmount || '0',
        }),
      });
      const data = await res.json();
      if (!res.ok) { setSaveMsg('Error: ' + (data.error || 'Cancellation failed.')); setCancelling(false); return; }
      setReg(r => ({ ...r, registration_statuses: { id: CANCELLED_STATUS_ID, label: 'Cancelled' } }));
      setEditingRegStatus(false);
      setCancelDone(true);
      setCancelling(false);
      setSaveMsg(`Registration cancelled. ${parseFloat(refundAmount) > 0 ? `Refund of $${parseFloat(refundAmount).toFixed(2)} issued.` : 'No refund issued.'} Cancellation email sent.`);
    } catch (err) {
      setSaveMsg('Unexpected error during cancellation.');
      setCancelling(false);
    }
  }

  if (loading) {
    return <div style={{ padding: '3rem', textAlign: 'center', fontFamily: 'var(--font-body)', color: '#9ca3af', fontStyle: 'italic' }}>Loading registration...</div>;
  }

  if (!reg) {
    return (
      <div style={{ padding: '2rem' }}>
        <p style={{ color: '#b40000', fontFamily: 'var(--font-body)' }}>Registration not found.</p>
        <Link href="/backstage/registrations" style={{ color: '#b40000' }}>← Back to Registrations</Link>
      </div>
    );
  }

  const balance = (parseFloat(reg.total_fee) || 0) - (parseFloat(reg.amount_paid) || 0);
  const displayNameStr = participant?.nickname
    ? `${participant.nickname} ${participant.last_name}`
    : `${participant?.first_name} ${participant?.last_name}`;

  return (
    <div>
      {/* Header */}
      <div style={{ marginBottom: '1.25rem' }}>
        <Link href="/backstage/registrations" style={{ fontFamily: 'var(--font-display)', fontSize: '0.7rem', fontWeight: 600, letterSpacing: '0.08em', textTransform: 'uppercase', color: '#6b7280', textDecoration: 'none' }}>
          ← Registrations
        </Link>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginTop: '0.5rem', flexWrap: 'wrap', gap: '0.5rem' }}>
          <div>
            <h1 style={{ fontFamily: 'var(--font-display)', fontSize: '1.5rem', fontWeight: 800, letterSpacing: '0.05em', textTransform: 'uppercase', color: '#111', margin: 0 }}>
              {displayNameStr}
            </h1>
            <p style={{ fontFamily: 'var(--font-body)', fontSize: '0.875rem', color: '#6b7280', margin: '2px 0 0 0' }}>
              #{reg.registration_number} · {program?.label || '—'} · Registered {fmtDate(reg.registered_at)}
            </p>
          </div>
          <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
            <StatusBadge label={reg.registration_statuses?.label} />
            {reg.is_financial_aid_requested && (
              <span style={{ fontFamily: 'var(--font-display)', fontSize: '0.65rem', fontWeight: 700, letterSpacing: '0.08em', color: '#7c3aed', background: '#f5f3ff', border: '1px solid #ddd6fe', borderRadius: '3px', padding: '0.2rem 0.5rem' }}>FA</span>
            )}
          </div>
        </div>
      </div>

      {saveMsg && (
        <div style={{ background: '#f0fdf4', border: '1px solid #bbf7d0', borderRadius: '6px', padding: '0.75rem 1rem', marginBottom: '1rem', fontFamily: 'var(--font-body)', fontSize: '0.875rem', color: '#16a34a' }}>
          ✓ {saveMsg}
        </div>
      )}

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>

        {/* LEFT COLUMN */}
        <div>

          {/* Participant info */}
          <div style={card}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.75rem' }}>
              <SectionHeader title="Participant" />
              {!editingParticipant && (
                <button onClick={() => setEditingParticipant(true)} style={{ ...btnSecondary, padding: '0.3rem 0.75rem', fontSize: '0.65rem' }}>Edit</button>
              )}
            </div>

            {editingParticipant ? (
              <div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.5rem', marginBottom: '0.5rem' }}>
                  <div>
                    <label style={{ fontFamily: 'var(--font-display)', fontSize: '0.65rem', fontWeight: 600, letterSpacing: '0.08em', textTransform: 'uppercase', color: '#6b7280', display: 'block', marginBottom: '0.25rem' }}>First Name</label>
                    <input type="text" value={pForm.first_name} onChange={e => setPForm(f => ({ ...f, first_name: e.target.value }))} style={inputStyle} />
                  </div>
                  <div>
                    <label style={{ fontFamily: 'var(--font-display)', fontSize: '0.65rem', fontWeight: 600, letterSpacing: '0.08em', textTransform: 'uppercase', color: '#6b7280', display: 'block', marginBottom: '0.25rem' }}>Last Name</label>
                    <input type="text" value={pForm.last_name} onChange={e => setPForm(f => ({ ...f, last_name: e.target.value }))} style={inputStyle} />
                  </div>
                </div>
                <div style={{ marginBottom: '0.5rem' }}>
                  <label style={{ fontFamily: 'var(--font-display)', fontSize: '0.65rem', fontWeight: 600, letterSpacing: '0.08em', textTransform: 'uppercase', color: '#6b7280', display: 'block', marginBottom: '0.25rem' }}>Nickname</label>
                  <input type="text" value={pForm.nickname} onChange={e => setPForm(f => ({ ...f, nickname: e.target.value }))} style={inputStyle} />
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.5rem', marginBottom: '1rem' }}>
                  <div>
                    <label style={{ fontFamily: 'var(--font-display)', fontSize: '0.65rem', fontWeight: 600, letterSpacing: '0.08em', textTransform: 'uppercase', color: '#6b7280', display: 'block', marginBottom: '0.25rem' }}>Phone</label>
                    <input type="tel" value={pForm.phone} onChange={e => setPForm(f => ({ ...f, phone: e.target.value }))} style={inputStyle} />
                  </div>
                  <div>
                    <label style={{ fontFamily: 'var(--font-display)', fontSize: '0.65rem', fontWeight: 600, letterSpacing: '0.08em', textTransform: 'uppercase', color: '#6b7280', display: 'block', marginBottom: '0.25rem' }}>Email</label>
                    <input type="email" value={pForm.email} onChange={e => setPForm(f => ({ ...f, email: e.target.value }))} style={inputStyle} />
                  </div>
                </div>
                <div style={{ display: 'flex', gap: '0.5rem' }}>
                  <button onClick={saveParticipant} disabled={saving} style={btnPrimary}>{saving ? 'Saving...' : 'Save'}</button>
                  <button onClick={() => { setEditingParticipant(false); setPForm({ first_name: participant.first_name || '', last_name: participant.last_name || '', nickname: participant.nickname || '', phone: participant.phone || '', email: participant.email || '' }); }} style={btnSecondary}>Cancel</button>
                </div>
              </div>
            ) : (
              <div>
                <Row label="Name"   value={`${participant?.first_name} ${participant?.last_name}`} />
                {participant?.nickname && <Row label="Nickname" value={participant.nickname} />}
                <Row label="Grade"  value={getGrade(participant?.yog)} />
                <Row label="Gender" value={participant?.genders?.label} />
                <Row label="DOB"    value={participant?.date_of_birth ? fmtDateOnly(participant.date_of_birth) : '—'} />
                {participant?.phone && <Row label="Phone"  value={participant.phone} />}
                {participant?.email && <Row label="Email"  value={participant.email} />}
              </div>
            )}
          </div>

          {/* Registration details */}
          <div style={card}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.75rem' }}>
              <SectionHeader title="Registration Details" />
            </div>
            <Row label="Program"    value={program?.label} />
            <Row label="Season"     value={program?.sessions?.seasons?.display_name || program?.sessions?.seasons?.name} />
            <Row label="Session"    value={program?.sessions?.name} />
            <Row label="Reg #"      value={`#${reg.registration_number}`} />
            <Row label="Signed By"  value={reg.sig_parent} />
            <Row label="Financial Aid" value={reg.is_financial_aid_requested ? 'Yes — Pending Review' : 'No'} />

            {/* Award level */}
            <div style={{ marginTop: '0.75rem', paddingTop: '0.75rem', borderTop: '1px solid #f3f4f6' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem' }}>
                <span style={{ fontFamily: 'var(--font-display)', fontSize: '0.7rem', fontWeight: 600, letterSpacing: '0.08em', textTransform: 'uppercase', color: '#9ca3af' }}>Award Level</span>
                {!editingAward && <button onClick={() => setEditingAward(true)} style={{ ...btnSecondary, padding: '0.3rem 0.75rem', fontSize: '0.65rem' }}>Edit</button>}
              </div>
              {editingAward ? (
                <div>
                  <select value={awardLevelId} onChange={e => setAwardLevelId(e.target.value)} style={{ ...inputStyle, marginBottom: '0.5rem' }}>
                    {AWARD_LEVELS.map(a => <option key={a.id} value={a.id}>{a.label}</option>)}
                  </select>
                  <div style={{ display: 'flex', gap: '0.5rem' }}>
                    <button onClick={saveAward} disabled={saving} style={btnPrimary}>{saving ? 'Saving...' : 'Save'}</button>
                    <button onClick={() => setEditingAward(false)} style={btnSecondary}>Cancel</button>
                  </div>
                </div>
              ) : (
                <p style={{ fontFamily: 'var(--font-body)', fontSize: '0.875rem', color: '#111', margin: 0 }}>
                  {AWARD_LEVELS.find(a => a.id === reg.award_level_id)?.label || '—'}
                </p>
              )}
            </div>

            {/* Registration status */}
            <div style={{ marginTop: '0.75rem', paddingTop: '0.75rem', borderTop: '1px solid #f3f4f6' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem' }}>
                <span style={{ fontFamily: 'var(--font-display)', fontSize: '0.7rem', fontWeight: 600, letterSpacing: '0.08em', textTransform: 'uppercase', color: '#9ca3af' }}>Registration Status</span>
                {!editingRegStatus && <button onClick={() => setEditingRegStatus(true)} style={{ ...btnSecondary, padding: '0.3rem 0.75rem', fontSize: '0.65rem' }}>Edit</button>}
              </div>
              {editingRegStatus ? (
                <div>
                  <select value={newRegStatusId} onChange={e => setNewRegStatusId(e.target.value)} style={{ ...inputStyle, marginBottom: '0.75rem' }}>
                    {regStatuses.map(s => <option key={s.id} value={s.id}>{s.label}</option>)}
                  </select>

                  {/* Cancellation panel */}
                  {newRegStatusId === CANCELLED_STATUS_ID ? (
                    <div style={{ background: '#fff5f5', border: '1px solid #fecaca', borderRadius: '6px', padding: '1rem', marginBottom: '0.75rem' }}>
                      <p style={{ fontFamily: 'var(--font-display)', fontSize: '0.7rem', fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase', color: '#b40000', margin: '0 0 0.75rem 0' }}>
                        ⚠ Cancellation — This cannot be undone
                      </p>

                      {/* Payment history summary */}
                      {payments.length > 0 && (
                        <div style={{ marginBottom: '0.75rem' }}>
                          <p style={{ fontFamily: 'var(--font-display)', fontSize: '0.65rem', fontWeight: 600, letterSpacing: '0.08em', textTransform: 'uppercase', color: '#6b7280', margin: '0 0 0.4rem 0' }}>Payment History</p>
                          {payments.map(pay => (
                            <div key={pay.id} style={{ display: 'flex', justifyContent: 'space-between', fontFamily: 'var(--font-body)', fontSize: '0.8rem', marginBottom: '0.2rem' }}>
                              <span style={{ color: '#374151' }}>{pay.payment_method || pay.payment_types?.label} · {new Date(pay.paid_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}</span>
                              <span style={{ fontWeight: 600, color: parseFloat(pay.amount) < 0 ? '#b40000' : '#16a34a' }}>{fmt(pay.amount)}</span>
                            </div>
                          ))}
                          <div style={{ display: 'flex', justifyContent: 'space-between', fontFamily: 'var(--font-body)', fontSize: '0.8rem', fontWeight: 600, marginTop: '0.4rem', paddingTop: '0.4rem', borderTop: '1px solid #fecaca' }}>
                            <span style={{ color: '#374151' }}>Total Paid</span>
                            <span style={{ color: '#111' }}>{fmt(reg.amount_paid)}</span>
                          </div>
                        </div>
                      )}

                      {/* Refund amount */}
                      <div style={{ marginBottom: '0.75rem' }}>
                        <label style={{ fontFamily: 'var(--font-display)', fontSize: '0.65rem', fontWeight: 600, letterSpacing: '0.08em', textTransform: 'uppercase', color: '#6b7280', display: 'block', marginBottom: '0.3rem' }}>
                          Refund Amount <span style={{ color: '#9ca3af', fontWeight: 400, textTransform: 'none', letterSpacing: 0 }}>max {fmt(reg.amount_paid)}</span>
                        </label>
                        <div style={{ position: 'relative' }}>
                          <span style={{ position: 'absolute', left: '0.75rem', top: '50%', transform: 'translateY(-50%)', fontFamily: 'var(--font-body)', fontSize: '0.875rem', color: '#6b7280' }}>$</span>
                          <input
                            type="number"
                            value={refundAmount}
                            onChange={e => setRefundAmount(e.target.value)}
                            step="0.01"
                            min="0"
                            max={reg.amount_paid}
                            placeholder="0.00"
                            style={{ ...inputStyle, paddingLeft: '1.5rem' }}
                          />
                        </div>
                        <p style={{ fontFamily: 'var(--font-body)', fontSize: '0.75rem', color: '#6b7280', margin: '4px 0 0 0' }}>Enter 0 for no refund. Leave blank to refund nothing.</p>
                      </div>

                      {/* What will happen */}
                      <div style={{ background: '#fff', border: '1px solid #fecaca', borderRadius: '4px', padding: '0.75rem', marginBottom: '0.75rem', fontFamily: 'var(--font-body)', fontSize: '0.78rem', color: '#374151' }}>
                        <p style={{ fontWeight: 600, margin: '0 0 0.3rem 0' }}>This will:</p>
                        <p style={{ margin: '0 0 0.2rem 0' }}>✓ Set registration status to Cancelled</p>
                        {parseFloat(refundAmount) > 0 && <p style={{ margin: '0 0 0.2rem 0' }}>✓ Issue Stripe refund of {fmt(refundAmount)}</p>}
                        <p style={{ margin: '0 0 0.2rem 0' }}>✓ Void any outstanding Stripe invoice</p>
                        <p style={{ margin: 0 }}>✓ Send cancellation email to family</p>
                      </div>

                      <div style={{ display: 'flex', gap: '0.5rem' }}>
                        <button onClick={confirmCancellation} disabled={cancelling} style={{ ...btnPrimary, background: '#b40000', opacity: cancelling ? 0.7 : 1 }}>
                          {cancelling ? 'Processing...' : 'Confirm Cancellation'}
                        </button>
                        <button onClick={() => { setEditingRegStatus(false); setNewRegStatusId(reg.registration_statuses?.id || ''); }} style={btnSecondary}>
                          Go Back
                        </button>
                      </div>

                      {/* Release spot — shown after cancellation */}
                      {cancelDone && !spotReleased && (
                        <div style={{ marginTop: '1rem', paddingTop: '1rem', borderTop: '1px solid #fecaca' }}>
                          <p style={{ fontFamily: 'var(--font-display)', fontSize: '0.7rem', fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase', color: '#d97706', margin: '0 0 0.5rem 0' }}>
                            Release Spot?
                          </p>
                          <p style={{ fontFamily: 'var(--font-body)', fontSize: '0.8rem', color: '#374151', margin: '0 0 0.75rem 0' }}>
                            The cancelled spot is currently held. Click below to make it available for new registrations.
                          </p>
                          <div style={{ display: 'flex', gap: '0.5rem' }}>
                            <button
                              onClick={() => setSpotReleased(true)}
                              style={{ ...btnPrimary, background: '#d97706' }}
                            >
                              Release Spot
                            </button>
                            <button onClick={() => setSpotReleased(true)} style={btnSecondary}>
                              Keep Spot Held
                            </button>
                          </div>
                        </div>
                      )}
                      {cancelDone && spotReleased && (
                        <p style={{ fontFamily: 'var(--font-body)', fontSize: '0.8rem', color: '#16a34a', margin: '0.75rem 0 0 0' }}>
                          ✓ Spot released — enrollment count updated
                        </p>
                      )}
                    </div>
                  ) : (
                    <div style={{ display: 'flex', gap: '0.5rem' }}>
                      <button onClick={saveRegStatus} disabled={saving} style={btnPrimary}>{saving ? 'Saving...' : 'Save'}</button>
                      <button onClick={() => setEditingRegStatus(false)} style={btnSecondary}>Cancel</button>
                    </div>
                  )}
                </div>
              ) : (
                <StatusBadge label={reg.registration_statuses?.label} />
              )}
            </div>
          </div>

        {/* Contacts */}
        <div style={card}>
          <SectionHeader title="Contacts" />

          {/* Guardians */}
          {contacts.filter(c => c.priority <= 2).map(c => (
            <div key={c.priority} style={{ marginBottom: '0.875rem', paddingBottom: '0.875rem', borderBottom: '1px solid #f3f4f6' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: '0.2rem' }}>
                <p style={{ fontFamily: 'var(--font-body)', fontSize: '0.875rem', fontWeight: 600, color: '#111', margin: 0 }}>
                  {c.first_name} {c.last_name}
                </p>
                <span style={{ fontFamily: 'var(--font-display)', fontSize: '0.6rem', fontWeight: 600, letterSpacing: '0.08em', textTransform: 'uppercase', color: '#e0bf5c', background: '#1a1200', border: '1px solid #e0bf5c30', borderRadius: '3px', padding: '0.15rem 0.4rem' }}>
                  {c.priority === 1 ? 'Primary Guardian' : 'Secondary Guardian'}
                </span>
              </div>
              {c.relationships?.label && <p style={{ fontFamily: 'var(--font-body)', fontSize: '0.78rem', color: '#6b7280', margin: '0 0 0.25rem 0' }}>{c.relationships.label}</p>}
              {c.phone && <p style={{ fontFamily: 'var(--font-body)', fontSize: '0.8rem', color: '#374151', margin: 0 }}>📞 {c.phone}</p>}
              {c.email && <p style={{ fontFamily: 'var(--font-body)', fontSize: '0.8rem', color: '#374151', margin: 0 }}>✉ {c.email}</p>}
            </div>
          ))}

          {/* Emergency contacts */}
          {contacts.filter(c => c.priority >= 3).length > 0 && (
            <div style={{ marginTop: '0.5rem' }}>
              <p style={{ fontFamily: 'var(--font-display)', fontSize: '0.65rem', fontWeight: 600, letterSpacing: '0.1em', textTransform: 'uppercase', color: '#9ca3af', margin: '0 0 0.75rem 0' }}>Emergency Contacts</p>
              {contacts.filter(c => c.priority >= 3).map(c => (
                <div key={c.priority} style={{ marginBottom: '0.75rem' }}>
                  <p style={{ fontFamily: 'var(--font-body)', fontSize: '0.875rem', fontWeight: 600, color: '#111', margin: '0 0 0.2rem 0' }}>
                    {c.first_name} {c.last_name}
                  </p>
                  {c.phone && <p style={{ fontFamily: 'var(--font-body)', fontSize: '0.8rem', color: '#374151', margin: 0 }}>📞 {c.phone}</p>}
                </div>
              ))}
            </div>
          )}

          {contacts.length === 0 && (
            <p style={{ fontFamily: 'var(--font-body)', fontSize: '0.875rem', color: '#9ca3af', fontStyle: 'italic' }}>No contacts on file.</p>
          )}
        </div>

        </div>

        {/* RIGHT COLUMN */}
        <div>

          {/* Financial summary */}
          <div style={card}>
            <SectionHeader title="Financial Summary" />
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '0.75rem', marginBottom: '1rem' }}>
              {[
                { label: 'Total Fee',   value: fmt(reg.total_fee),   color: '#111' },
                { label: 'Paid',        value: fmt(reg.amount_paid), color: '#16a34a' },
                { label: 'Balance Due', value: fmt(balance),         color: balance > 0.01 ? '#b40000' : '#16a34a' },
              ].map(item => (
                <div key={item.label} style={{ background: '#f9fafb', borderRadius: '6px', padding: '0.75rem', textAlign: 'center' }}>
                  <p style={{ fontFamily: 'var(--font-display)', fontSize: '0.6rem', fontWeight: 600, letterSpacing: '0.1em', textTransform: 'uppercase', color: '#9ca3af', margin: '0 0 0.25rem 0' }}>{item.label}</p>
                  <p style={{ fontFamily: 'var(--font-display)', fontSize: '1.1rem', fontWeight: 800, color: item.color, margin: 0, lineHeight: 1 }}>{item.value}</p>
                </div>
              ))}
            </div>
            {program?.balance_due_date && balance > 0.01 && (
              <p style={{ fontFamily: 'var(--font-body)', fontSize: '0.8rem', color: '#6b7280', margin: 0 }}>
                Balance due by {fmtDateOnly(program.balance_due_date)} + 5% processing fee
              </p>
            )}
          </div>

          {/* Payment history */}
          <div style={card}>
            <SectionHeader title="Payment History" />
            {payments.length === 0 ? (
              <p style={{ fontFamily: 'var(--font-body)', fontSize: '0.875rem', color: '#9ca3af', fontStyle: 'italic' }}>No payments recorded.</p>
            ) : payments.map(pay => (
              <div key={pay.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '0.5rem 0', borderBottom: '1px solid #f3f4f6' }}>
                <div>
                  <p style={{ fontFamily: 'var(--font-body)', fontSize: '0.875rem', color: '#111', margin: 0 }}>{fmt(pay.amount)}</p>
                  <p style={{ fontFamily: 'var(--font-body)', fontSize: '0.75rem', color: '#9ca3af', margin: 0 }}>
                      {fmtDate(pay.paid_at)} · {pay.payment_method || pay.payment_types?.label}
                      {pay.reference_number ? ` · #${pay.reference_number}` : ''}
                    </p>
                </div>
                <span style={{ fontFamily: 'var(--font-display)', fontSize: '0.65rem', fontWeight: 600, letterSpacing: '0.06em', textTransform: 'uppercase', color: pay.payment_statuses?.label === 'Paid' ? '#16a34a' : '#d97706', background: pay.payment_statuses?.label === 'Paid' ? '#f0fdf4' : '#fffbeb', border: `1px solid ${pay.payment_statuses?.label === 'Paid' ? '#bbf7d0' : '#fde68a'}`, borderRadius: '3px', padding: '0.2rem 0.5rem' }}>
                  {pay.payment_statuses?.label}
                </span>
              </div>
            ))}
          </div>
        
         {/* Offline Payment */}
          <OfflinePaymentCard
            registrationId={regId}
            totalFee={reg.total_fee}
            amountPaid={reg.amount_paid}
            onPaymentSaved={reloadPayments}
          />

          {/* Health summary */}
          <div style={card}>
            <SectionHeader title="Health Information" />
            {!health ? (
              <p style={{ fontFamily: 'var(--font-body)', fontSize: '0.875rem', color: '#9ca3af', fontStyle: 'italic' }}>No health record found.</p>
            ) : (
              <div>
                {[
                  { label: 'Academic Considerations', flag: health.academic_flag,   notes: health.academic_notes },
                  { label: 'Behavioral Considerations', flag: health.behavioral_flag, notes: health.behavioral_notes },
                  { label: 'Allergies',               flag: health.allergies_flag,  notes: health.allergies_notes, extra: health.epipen ? 'EpiPen: Yes' : null },
                  { label: 'Asthma',                  flag: health.asthma },
                  { label: 'Concussion History',      flag: health.concussion_flag, notes: health.concussion_date ? `Date: ${fmtDateOnly(health.concussion_date)}` : null },
                ].map(item => (
                  <div key={item.label} style={{ display: 'flex', gap: '0.5rem', marginBottom: '0.5rem', alignItems: 'flex-start' }}>
                    <span style={{ fontFamily: 'var(--font-display)', fontSize: '0.6rem', fontWeight: 700, letterSpacing: '0.06em', padding: '0.15rem 0.4rem', borderRadius: '3px', flexShrink: 0, border: `1px solid ${item.flag ? '#b40000' : '#e5e7eb'}`, color: item.flag ? '#b40000' : '#9ca3af', background: item.flag ? '#fff5f5' : 'transparent' }}>
                      {item.flag ? 'YES' : 'NO'}
                    </span>
                    <div>
                      <p style={{ fontFamily: 'var(--font-body)', fontSize: '0.8rem', color: '#374151', margin: 0 }}>{item.label}</p>
                      {item.flag && item.notes && <p style={{ fontFamily: 'var(--font-body)', fontSize: '0.75rem', color: '#6b7280', margin: '2px 0 0 0' }}>{item.notes}</p>}
                      {item.flag && item.extra && <p style={{ fontFamily: 'var(--font-body)', fontSize: '0.75rem', color: '#6b7280', margin: '2px 0 0 0' }}>{item.extra}</p>}
                    </div>
                  </div>
                ))}
                {health.general_comments && (
                  <div style={{ marginTop: '0.5rem', padding: '0.5rem 0.75rem', background: '#f9fafb', borderRadius: '6px' }}>
                    <p style={{ fontFamily: 'var(--font-display)', fontSize: '0.6rem', fontWeight: 600, letterSpacing: '0.08em', textTransform: 'uppercase', color: '#9ca3af', margin: '0 0 0.25rem 0' }}>Additional Comments</p>
                    <p style={{ fontFamily: 'var(--font-body)', fontSize: '0.8rem', color: '#374151', margin: 0 }}>{health.general_comments}</p>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Agreements */}
          <div style={card}>
            <SectionHeader title="Agreements" />
            {agreements.length === 0 ? (
              <p style={{ fontFamily: 'var(--font-body)', fontSize: '0.875rem', color: '#9ca3af', fontStyle: 'italic' }}>No agreements recorded.</p>
            ) : agreements.map(ag => {
              const typeLabel = {
                payment_agreement: 'Registration Fee Policy',
                participant_rules: 'Participation Policy',
                liability_waiver:  'Liability Waiver',
              }[ag.policy_documents?.type] || ag.policy_documents?.type;
              return (
                <div key={ag.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '0.5rem 0', borderBottom: '1px solid #f3f4f6' }}>
                  <div>
                    <p style={{ fontFamily: 'var(--font-body)', fontSize: '0.8rem', color: '#111', margin: 0 }}>{typeLabel}</p>
                    <p style={{ fontFamily: 'var(--font-body)', fontSize: '0.75rem', color: '#9ca3af', margin: 0 }}>Signed by {ag.agreed_by} · {fmtDate(ag.agreed_at)}</p>
                  </div>
                  <span style={{ color: '#16a34a', fontSize: '1rem' }}>✓</span>
                </div>
              );
            })}
          </div>

        </div>
      </div>
    </div>
  );
}