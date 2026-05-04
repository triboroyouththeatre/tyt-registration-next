'use client';

import { useState, useEffect } from 'react';
import { createClient } from '@/lib/supabase/client';
import NavButtons from './NavButtons';

export default function Step2({ onComplete, onBack, familyId }) {
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [genders, setGenders] = useState([]);
  const [gradeLevels, setGradeLevels] = useState([]);
  const [existingParticipantId, setExistingParticipantId] = useState(null);
  const [yogLabel, setYogLabel] = useState('');
  const [yogConfirmed, setYogConfirmed] = useState(false);
  const [form, setForm] = useState({
    first_name: '', last_name: '', nickname: '',
    date_of_birth: '', yog: '', gender_id: '', phone: '', email: '',
  });

  useEffect(() => {
    async function load() {
      const supabase = createClient();
      const [{ data: g }, { data: gl }, { data: existing }] = await Promise.all([
        supabase.from('genders').select('id, label').order('label'),
        supabase.from('grade_levels').select('id, yog, label, seasons!inner(is_active)').eq('seasons.is_active', true).order('yog'),
        supabase.from('participants').select('*').eq('family_id', familyId).order('created_at').limit(1).single(),
      ]);
      setGenders(g || []);
      setGradeLevels(gl || []);
      if (existing) {
        setExistingParticipantId(existing.id);
        setForm({
          first_name: existing.first_name || '', last_name: existing.last_name || '',
          nickname: existing.nickname || '', date_of_birth: existing.date_of_birth || '',
          yog: existing.yog || '', gender_id: existing.gender_id || '',
          phone: existing.phone || '', email: existing.email || '',
        });
        const match = (gl || []).find(gr => gr.yog === existing.yog);
        setYogLabel(match?.label || `Class of ${existing.yog}`);
        setYogConfirmed(true);
      }
    }
    load();
  }, [familyId]);

  useEffect(() => {
    if (!form.date_of_birth || !gradeLevels.length) return;
    if (yogConfirmed) return;
    const dob = new Date(form.date_of_birth);
    const today = new Date();
    const sYS = today.getMonth() >= 8 ? today.getFullYear() : today.getFullYear() - 1;
    const sept1 = new Date(sYS, 8, 1);
    let age = sept1.getFullYear() - dob.getFullYear();
    const m = sept1.getMonth() - dob.getMonth();
    if (m < 0 || (m === 0 && sept1.getDate() < dob.getDate())) age--;
    const grade = age - 5;
    if (grade >= 0 && grade <= 12) {
      const yog = sYS + 1 + (12 - grade);
      setForm(f => ({ ...f, yog }));
      const match = gradeLevels.find(gr => gr.yog === yog);
      setYogLabel(match?.label || `Class of ${yog}`);
    }
  }, [form.date_of_birth, gradeLevels]);

  function handleChange(e) { setForm(f => ({ ...f, [e.target.name]: e.target.value })); }
  function handlePhone(e) { setForm(f => ({ ...f, phone: e.target.value.replace(/\D/g, '').slice(0, 10) })); }

  async function handleSubmit(e) {
    e.preventDefault();
    setError('');
    if (!yogConfirmed) { setError('Please confirm the year of graduation.'); return; }
    if (form.phone && form.phone.length !== 10) { setError('Phone must be 10 digits.'); return; }

    setSaving(true);
    const supabase = createClient();

    const payload = {
      family_id: familyId,
      first_name: form.first_name.trim(), last_name: form.last_name.trim(),
      nickname: form.nickname.trim() || null, date_of_birth: form.date_of_birth,
      yog: parseInt(form.yog), gender_id: form.gender_id,
      phone: form.phone || null, email: form.email.trim() || null,
    };

    let err;
    if (existingParticipantId) {
      ({ error: err } = await supabase.from('participants').update(payload).eq('id', existingParticipantId));
    } else {
      ({ error: err } = await supabase.from('participants').insert(payload));
    }

    if (err) { setError(err.message); setSaving(false); return; }
    onComplete();
  }

  return (
    <form onSubmit={handleSubmit}>
      {error && <div className="tyt-error">{error}</div>}
      <h2 style={{ fontFamily: 'var(--font-display)', fontSize: '1.4rem', fontWeight: 700, letterSpacing: '0.05em', textTransform: 'uppercase', color: 'var(--text-primary)', marginBottom: '0.25rem' }}>
        Add Your First Participant
      </h2>
      <p style={{ fontFamily: 'var(--font-accent)', fontStyle: 'italic', color: 'var(--text-muted)', fontSize: '0.9rem', marginBottom: '1.5rem' }}>
        Tell us about the person who will be participating in TYT programs.
      </p>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem', marginBottom: '1rem' }}>
        <div>
          <label className="tyt-label">First Name <span style={{ color: 'var(--red)' }}>*</span></label>
          <input type="text" name="first_name" value={form.first_name} onChange={handleChange} required className="tyt-input" />
        </div>
        <div>
          <label className="tyt-label">Last Name <span style={{ color: 'var(--red)' }}>*</span></label>
          <input type="text" name="last_name" value={form.last_name} onChange={handleChange} required className="tyt-input" />
        </div>
      </div>

      <div style={{ marginBottom: '1rem' }}>
        <label className="tyt-label">Preferred Name / Nickname <span style={{ color: 'var(--text-faint)', fontWeight: 400, textTransform: 'none', letterSpacing: 0 }}>(optional)</span></label>
        <input type="text" name="nickname" value={form.nickname} onChange={handleChange} placeholder="What do they like to be called?" className="tyt-input" />
      </div>

      <div style={{ marginBottom: '1rem' }}>
        <label className="tyt-label">Date of Birth <span style={{ color: 'var(--red)' }}>*</span></label>
        <input type="date" name="date_of_birth" value={form.date_of_birth} onChange={handleChange} required className="tyt-input" style={{ colorScheme: 'dark' }} />
      </div>

      {form.yog && (
        <div style={{ background: yogConfirmed ? '#0d1a0a' : '#1a1400', border: '1px solid var(--gold)', borderRadius: 'var(--radius-sm)', padding: '0.875rem 1rem', marginBottom: '1rem', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '1rem', flexWrap: 'wrap' }}>
          <div>
            <p style={{ fontFamily: 'var(--font-display)', fontSize: '0.65rem', fontWeight: 600, letterSpacing: '0.12em', textTransform: 'uppercase', color: 'var(--text-muted)', marginBottom: '0.2rem' }}>Year of Graduation</p>
            <p style={{ fontFamily: 'var(--font-display)', fontSize: '1.2rem', fontWeight: 800, color: 'var(--gold)', lineHeight: 1, marginBottom: '0.15rem' }}>{form.yog}</p>
            <p style={{ fontFamily: 'var(--font-accent)', fontStyle: 'italic', color: 'var(--text-muted)', fontSize: '0.8rem' }}>Current Grade: {yogLabel}</p>
          </div>
          {!yogConfirmed ? (
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: '0.4rem' }}>
              <button type="button" onClick={() => setYogConfirmed(true)} className="tyt-btn tyt-btn-gold" style={{ fontSize: '0.75rem', padding: '0.4rem 1rem' }}>Confirm</button>
              <button type="button" onClick={() => { setForm(f => ({ ...f, date_of_birth: '', yog: '' })); setYogLabel(''); setYogConfirmed(false); }} style={{ background: 'none', border: 'none', color: 'var(--text-faint)', cursor: 'pointer', fontFamily: 'var(--font-body)', fontSize: '0.75rem', padding: 0, textDecoration: 'underline' }}>Not right? Re-enter</button>
            </div>
          ) : (
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <span style={{ color: 'var(--gold)', fontSize: '1rem' }}>✓</span>
              <span style={{ fontFamily: 'var(--font-body)', fontSize: '0.8rem', color: 'var(--gold)' }}>Confirmed</span>
              <button type="button" onClick={() => setYogConfirmed(false)} style={{ background: 'none', border: 'none', color: 'var(--text-faint)', cursor: 'pointer', fontFamily: 'var(--font-body)', fontSize: '0.75rem', padding: 0, textDecoration: 'underline' }}>Change</button>
            </div>
          )}
        </div>
      )}

      <div style={{ marginBottom: '1rem' }}>
        <label className="tyt-label">Gender <span style={{ color: 'var(--red)' }}>*</span></label>
        <select name="gender_id" value={form.gender_id} onChange={handleChange} required className="tyt-input">
          <option value="">Select gender</option>
          {genders.map(g => <option key={g.id} value={g.id}>{g.label}</option>)}
        </select>
      </div>

      <hr className="tyt-divider" />

      <h3 style={{ fontFamily: 'var(--font-display)', fontSize: '1rem', fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase', color: 'var(--text-primary)', marginBottom: '0.5rem' }}>
        Optional Participant Contact Information
      </h3>
      <p style={{ fontFamily: 'var(--font-body)', fontWeight: 600, color: 'var(--text-muted)', fontSize: '0.875rem', marginBottom: '1.25rem' }}>
        Fill out these fields only if different than their parents/guardians.
      </p>

      <div style={{ marginBottom: '1rem' }}>
        <label className="tyt-label">Participant Mobile</label>
        <input type="tel" name="phone" value={form.phone} onChange={handlePhone} placeholder="10 digits" maxLength={10} className="tyt-input" />
        {form.phone.length > 0 && form.phone.length < 10 && (
          <p style={{ fontFamily: 'var(--font-body)', fontSize: '0.75rem', color: 'var(--text-faint)', marginTop: '0.3rem' }}>{10 - form.phone.length} more digit{10 - form.phone.length !== 1 ? 's' : ''} needed</p>
        )}
      </div>

      <div style={{ marginBottom: '1.75rem' }}>
        <label className="tyt-label">Participant Email</label>
        <input type="email" name="email" value={form.email} onChange={handleChange} placeholder="participant@example.com" className="tyt-input" />
      </div>

      <NavButtons onBack={onBack} saving={saving} submitLabel="Continue →" />
    </form>
  );
}
