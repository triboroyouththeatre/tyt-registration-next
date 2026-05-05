'use client';

import { useState, useEffect } from 'react';
import { useParams } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import Link from 'next/link';
import { fmtPhone } from '@/lib/format';

const labelStyle = { fontFamily: 'var(--font-display)', fontSize: '0.65rem', fontWeight: 600, letterSpacing: '0.08em', textTransform: 'uppercase', color: '#6b7280', display: 'block', marginBottom: '0.3rem' };
const inputStyle = { fontFamily: 'var(--font-body)', fontSize: '0.875rem', color: '#111', border: '1px solid #d1d5db', borderRadius: '6px', padding: '0.5rem 0.75rem', width: '100%', boxSizing: 'border-box', background: '#fff' };
const cardStyle = { background: '#fff', border: '1px solid #e5e7eb', borderRadius: '8px', padding: '1.25rem', marginBottom: '1rem' };
const sectionTitle = { fontFamily: 'var(--font-display)', fontSize: '0.7rem', fontWeight: 700, letterSpacing: '0.12em', textTransform: 'uppercase', color: '#6b7280', margin: '0 0 1rem 0', paddingBottom: '0.5rem', borderBottom: '1px solid #e5e7eb' };
const btnPrimary = { fontFamily: 'var(--font-display)', fontSize: '0.7rem', fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase', background: '#111', color: '#fff', border: 'none', borderRadius: '6px', padding: '0.5rem 1.25rem', cursor: 'pointer' };
const btnSecondary = { fontFamily: 'var(--font-display)', fontSize: '0.7rem', fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase', background: '#fff', color: '#374151', border: '1px solid #d1d5db', borderRadius: '6px', padding: '0.5rem 1.25rem', cursor: 'pointer' };

function Row({ label, value }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', gap: '1rem', marginBottom: '0.5rem' }}>
      <span style={{ fontFamily: 'var(--font-display)', fontSize: '0.7rem', fontWeight: 600, letterSpacing: '0.08em', textTransform: 'uppercase', color: '#9ca3af', flexShrink: 0 }}>{label}</span>
      <span style={{ fontFamily: 'var(--font-body)', fontSize: '0.875rem', color: '#111', textAlign: 'right' }}>{value || '—'}</span>
    </div>
  );
}

export default function ParticipantDetailPage() {
  const params = useParams();
  const participantId = params?.id;

  const [loading, setLoading]           = useState(true);
  const [participant, setParticipant]   = useState(null);
  const [family, setFamily]             = useState(null);
  const [registrations, setRegistrations] = useState([]);
  const [genders, setGenders]           = useState([]);
  const [gradeLevels, setGradeLevels]   = useState([]);
  const [editing, setEditing]           = useState(false);
  const [saving, setSaving]             = useState(false);
  const [saveMsg, setSaveMsg]           = useState('');
  const [form, setForm]                 = useState({});

  useEffect(() => {
    async function load() {
      const supabase = createClient();

      const [{ data: p }, { data: gd }, { data: gl }] = await Promise.all([
        supabase.from('participants').select('*, genders(label), families(id, email)').eq('id', participantId).single(),
        supabase.from('genders').select('id, label').order('label'),
        supabase.from('grade_levels').select('yog, label, seasons!inner(is_active)').eq('seasons.is_active', true),
      ]);

      const { data: regs } = await supabase
        .from('registrations')
        .select(`
          id, registration_number, registered_at, amount_paid, total_fee,
          registration_statuses(label),
          carts(programs(label, sessions(seasons(display_name, name))))
        `)
        .eq('participant_id', participantId)
        .order('registered_at', { ascending: false });

      setParticipant(p);
      setFamily(p?.families);
      setRegistrations(regs || []);
      setGenders(gd || []);
      setGradeLevels(gl || []);

      if (p) setForm({
        first_name:    p.first_name    || '',
        last_name:     p.last_name     || '',
        nickname:      p.nickname      || '',
        date_of_birth: p.date_of_birth || '',
        gender_id:     p.gender_id     || '',
        phone:         p.phone         || '',
        email:         p.email         || '',
        is_active:     p.is_active     ?? true,
      });

      setLoading(false);
    }
    load();
  }, [participantId]);

  async function saveParticipant() {
    setSaving(true);
    const supabase = createClient();
    await supabase.from('participants').update({
      first_name:    form.first_name.trim(),
      last_name:     form.last_name.trim(),
      nickname:      form.nickname.trim() || null,
      date_of_birth: form.date_of_birth   || null,
      gender_id:     form.gender_id       || null,
      phone:         form.phone.trim()    || null,
      email:         form.email.trim()    || null,
      is_active:     form.is_active,
      updated_at:    new Date().toISOString(),
    }).eq('id', participantId);

    setParticipant(p => ({ ...p, ...form }));
    setEditing(false);
    setSaving(false);
    setSaveMsg('Participant updated.');
    setTimeout(() => setSaveMsg(''), 3000);
  }

  function getGrade(yog) {
    return gradeLevels?.find(g => g.yog === yog)?.label || `YOG ${yog}`;
  }

  function fmt(amount) {
    return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(Number(amount) || 0);
  }

  function fmtDate(str) {
    if (!str) return '—';
    return new Date(str).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
  }

  function fmtDateOnly(str) {
    if (!str) return '—';
    return new Date(str + 'T00:00:00').toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' });
  }

  if (loading) return <div style={{ padding: '3rem', textAlign: 'center', fontFamily: 'var(--font-body)', color: '#9ca3af', fontStyle: 'italic' }}>Loading...</div>;
  if (!participant) return <div style={{ padding: '2rem' }}><Link href="/backstage/participants" style={{ color: '#b40000' }}>← Participants</Link><p>Participant not found.</p></div>;

  const displayName = participant.nickname
    ? `${participant.nickname} ${participant.last_name}`
    : `${participant.first_name} ${participant.last_name}`;

  return (
    <div>
      <div style={{ marginBottom: '1.25rem' }}>
        <Link href="/backstage/participants" style={{ fontFamily: 'var(--font-display)', fontSize: '0.7rem', fontWeight: 600, letterSpacing: '0.08em', textTransform: 'uppercase', color: '#6b7280', textDecoration: 'none' }}>← Participants</Link>
        <h1 style={{ fontFamily: 'var(--font-display)', fontSize: '1.5rem', fontWeight: 800, letterSpacing: '0.05em', textTransform: 'uppercase', color: '#111', margin: '4px 0 0 0' }}>
          {displayName}
        </h1>
        <p style={{ fontFamily: 'var(--font-body)', fontSize: '0.875rem', color: '#6b7280', margin: '2px 0 0 0' }}>
          {getGrade(participant.yog)} · {family?.email || '—'}
          {family?.id && (
            <Link href={`/backstage/families/${family.id}`} style={{ marginLeft: '0.5rem', color: '#b40000', fontSize: '0.8rem' }}>View Family →</Link>
          )}
        </p>
      </div>

      {saveMsg && <div style={{ background: '#f0fdf4', border: '1px solid #bbf7d0', borderRadius: '6px', padding: '0.75rem 1rem', marginBottom: '1rem', fontFamily: 'var(--font-body)', fontSize: '0.875rem', color: '#16a34a' }}>✓ {saveMsg}</div>}

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>

        {/* LEFT — Participant info */}
        <div>
          <div style={cardStyle}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
              <p style={sectionTitle}>Participant Info</p>
              {!editing && <button onClick={() => setEditing(true)} style={{ ...btnSecondary, padding: '0.3rem 0.75rem', fontSize: '0.65rem' }}>Edit</button>}
            </div>

            {editing ? (
              <div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.5rem', marginBottom: '0.75rem' }}>
                  <div>
                    <label style={labelStyle}>First Name</label>
                    <input type="text" value={form.first_name} onChange={e => setForm(f => ({ ...f, first_name: e.target.value }))} style={inputStyle} />
                  </div>
                  <div>
                    <label style={labelStyle}>Last Name</label>
                    <input type="text" value={form.last_name} onChange={e => setForm(f => ({ ...f, last_name: e.target.value }))} style={inputStyle} />
                  </div>
                </div>
                <div style={{ marginBottom: '0.75rem' }}>
                  <label style={labelStyle}>Nickname</label>
                  <input type="text" value={form.nickname} onChange={e => setForm(f => ({ ...f, nickname: e.target.value }))} style={inputStyle} />
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.5rem', marginBottom: '0.75rem' }}>
                  <div>
                    <label style={labelStyle}>Date of Birth</label>
                    <input type="date" value={form.date_of_birth} onChange={e => setForm(f => ({ ...f, date_of_birth: e.target.value }))} style={{ ...inputStyle, colorScheme: 'light' }} />
                  </div>
                  <div>
                    <label style={labelStyle}>Gender</label>
                    <select value={form.gender_id} onChange={e => setForm(f => ({ ...f, gender_id: e.target.value }))} style={inputStyle}>
                      <option value="">Select gender</option>
                      {genders.map(g => <option key={g.id} value={g.id}>{g.label}</option>)}
                    </select>
                  </div>
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.5rem', marginBottom: '0.75rem' }}>
                  <div>
                    <label style={labelStyle}>Phone</label>
                    <input type="tel" value={form.phone} onChange={e => setForm(f => ({ ...f, phone: e.target.value }))} style={inputStyle} />
                  </div>
                  <div>
                    <label style={labelStyle}>Email</label>
                    <input type="email" value={form.email} onChange={e => setForm(f => ({ ...f, email: e.target.value }))} style={inputStyle} />
                  </div>
                </div>
                <div style={{ marginBottom: '1rem' }}>
                  <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', cursor: 'pointer' }}>
                    <input type="checkbox" checked={form.is_active} onChange={e => setForm(f => ({ ...f, is_active: e.target.checked }))} style={{ width: '16px', height: '16px', accentColor: '#16a34a' }} />
                    <span style={{ fontFamily: 'var(--font-body)', fontSize: '0.875rem', color: '#374151' }}>Active participant</span>
                  </label>
                </div>
                <div style={{ display: 'flex', gap: '0.5rem' }}>
                  <button onClick={saveParticipant} disabled={saving} style={btnPrimary}>{saving ? 'Saving...' : 'Save'}</button>
                  <button onClick={() => setEditing(false)} style={btnSecondary}>Cancel</button>
                </div>
              </div>
            ) : (
              <div>
                <Row label="First Name"    value={participant.first_name} />
                <Row label="Last Name"     value={participant.last_name} />
                <Row label="Nickname"      value={participant.nickname} />
                <Row label="Date of Birth" value={fmtDateOnly(participant.date_of_birth)} />
                <Row label="Grade"         value={getGrade(participant.yog)} />
                <Row label="Gender"        value={participant.genders?.label} />
                {participant.phone && <Row label="Phone" value={fmtPhone(participant.phone)} />}
                {participant.email && <Row label="Email" value={participant.email} />}
                <Row label="Status" value={participant.is_active ? 'Active' : 'Inactive'} />
              </div>
            )}
          </div>
        </div>

        {/* RIGHT — Registration history */}
        <div>
          <div style={cardStyle}>
            <p style={sectionTitle}>Registration History ({registrations.length})</p>
            {registrations.length === 0 ? (
              <p style={{ fontFamily: 'var(--font-body)', fontSize: '0.875rem', color: '#9ca3af', fontStyle: 'italic' }}>No registrations.</p>
            ) : registrations.map(r => {
              const regStatus = r.registration_statuses?.label;
              const balance   = (parseFloat(r.total_fee) || 0) - (parseFloat(r.amount_paid) || 0);
              const payStatus = balance <= 0.01 ? 'Paid' : (parseFloat(r.amount_paid) || 0) > 0 ? 'Partially Paid' : 'Unpaid';
              const regColor  = regStatus === 'Active' ? '#16a34a' : regStatus === 'Cancelled' ? '#b40000' : '#d97706';
              const payColor  = payStatus === 'Paid'   ? '#16a34a' : payStatus === 'Unpaid'    ? '#b40000' : '#d97706';
              const season    = r.carts?.programs?.sessions?.seasons;
              const seasonStr = season?.display_name || season?.name || '';

              return (
                <div key={r.id} style={{ padding: '0.75rem 0', borderBottom: '1px solid #f3f4f6' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                    <div>
                      <p style={{ fontFamily: 'var(--font-body)', fontSize: '0.875rem', fontWeight: 600, color: '#111', margin: 0 }}>{r.carts?.programs?.label || '—'}</p>
                      <p style={{ fontFamily: 'var(--font-body)', fontSize: '0.75rem', color: '#9ca3af', margin: 0 }}>
                        {seasonStr} · #{r.registration_number} · {fmtDate(r.registered_at)}
                      </p>
                    </div>
                    <div style={{ textAlign: 'right' }}>
                      <p style={{ fontFamily: 'var(--font-body)', fontSize: '0.875rem', color: '#111', margin: 0 }}>{fmt(r.amount_paid)}</p>
                      {balance > 0.01 && <p style={{ fontFamily: 'var(--font-body)', fontSize: '0.75rem', color: '#b40000', margin: 0 }}>{fmt(balance)} due</p>}
                    </div>
                  </div>
                  <div style={{ display: 'flex', gap: '0.4rem', marginTop: '0.4rem' }}>
                    <span style={{ fontFamily: 'var(--font-display)', fontSize: '0.6rem', fontWeight: 600, letterSpacing: '0.06em', textTransform: 'uppercase', color: regColor, background: `${regColor}15`, border: `1px solid ${regColor}30`, borderRadius: '3px', padding: '0.15rem 0.4rem' }}>{regStatus}</span>
                    {payStatus && <span style={{ fontFamily: 'var(--font-display)', fontSize: '0.6rem', fontWeight: 600, letterSpacing: '0.06em', textTransform: 'uppercase', color: payColor, background: `${payColor}15`, border: `1px solid ${payColor}30`, borderRadius: '3px', padding: '0.15rem 0.4rem' }}>{payStatus}</span>}
                    <Link href={`/backstage/registrations/${r.id}`} style={{ fontFamily: 'var(--font-display)', fontSize: '0.6rem', fontWeight: 600, letterSpacing: '0.06em', textTransform: 'uppercase', color: '#6b7280', textDecoration: 'none', border: '1px solid #e5e7eb', borderRadius: '3px', padding: '0.15rem 0.4rem' }}>View →</Link>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}