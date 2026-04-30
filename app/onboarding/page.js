'use client';

import { useState, useEffect, useCallback } from 'react';
import { createClient } from '@/lib/supabase/client';
import { validateContacts } from '@/lib/contact-validation';
import Image from 'next/image';

const US_STATES = [
  'AL','AK','AZ','AR','CA','CO','CT','DE','FL','GA',
  'HI','ID','IL','IN','IA','KS','KY','LA','ME','MD',
  'MA','MI','MN','MS','MO','MT','NE','NV','NH','NJ',
  'NM','NY','NC','ND','OH','OK','OR','PA','RI','SC',
  'SD','TN','TX','UT','VT','VA','WA','WV','WI','WY'
];

const STEPS = [
  { number: 1, label: 'Your Info' },
  { number: 2, label: 'Participant' },
  { number: 3, label: 'Secondary Guardian' },
  { number: 4, label: 'Emergency Contacts' },
];

function StepIndicator({ currentStep }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: '2rem' }}>
      {STEPS.map((step, i) => (
        <div key={step.number} style={{ display: 'flex', alignItems: 'center' }}>
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '0.3rem' }}>
            <div style={{
              width: '32px', height: '32px', borderRadius: '50%',
              background: currentStep === step.number ? 'var(--red)' : currentStep > step.number ? 'var(--gold)' : 'var(--bg-hover)',
              border: `2px solid ${currentStep === step.number ? 'var(--red)' : currentStep > step.number ? 'var(--gold)' : 'var(--border)'}`,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontFamily: 'var(--font-display)', fontSize: '0.8rem', fontWeight: 700,
              color: currentStep >= step.number ? '#111' : 'var(--text-faint)',
            }}>
              {currentStep > step.number ? '✓' : step.number}
            </div>
            <span style={{
              fontFamily: 'var(--font-display)', fontSize: '0.6rem', fontWeight: 600,
              letterSpacing: '0.08em', textTransform: 'uppercase', whiteSpace: 'nowrap',
              color: currentStep === step.number ? 'var(--text-primary)' : 'var(--text-faint)',
            }}>
              {step.label}
            </span>
          </div>
          {i < STEPS.length - 1 && (
            <div style={{
              width: '48px', height: '2px',
              background: currentStep > step.number ? 'var(--gold)' : 'var(--border)',
              margin: '0 4px', marginBottom: '18px',
            }} />
          )}
        </div>
      ))}
    </div>
  );
}

function NavButtons({ onBack, onSubmit, saving, submitLabel = 'Continue →', showBack = true }) {
  return (
    <div style={{ display: 'flex', gap: '1rem', marginTop: '0.5rem' }}>
      {showBack && (
        <button type="button" onClick={onBack} className="tyt-btn tyt-btn-secondary" style={{ flex: 1 }}>
          ← Back
        </button>
      )}
      <button type="submit" disabled={saving} className="tyt-btn tyt-btn-primary" style={{ flex: showBack ? 1 : undefined, width: showBack ? undefined : '100%' }}>
        {saving ? 'Saving...' : submitLabel}
      </button>
    </div>
  );
}

// ── Step 1 ────────────────────────────────────────────────────────────────────
function Step1({ onComplete, familyId }) {
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [relationships, setRelationships] = useState([]);
  const [accountEmail, setAccountEmail] = useState('');
  const [existingContactId, setExistingContactId] = useState(null);
  const [form, setForm] = useState({
    first_name: '', last_name: '', relationship_id: '', phone: '',
    street: '', street2: '', city: '', state: '', zip: '',
  });

  useEffect(() => {
    async function load() {
      const supabase = createClient();
      const [{ data: rels }, { data: { user } }, { data: existingContact }, { data: family }] = await Promise.all([
        supabase.from('relationships').select('id, label').order('label'),
        supabase.auth.getUser(),
        supabase.from('contacts').select('*').eq('family_id', familyId).eq('priority', 1).single(),
        supabase.from('families').select('street, street2, city, state, zip').eq('id', familyId).single(),
      ]);
      setRelationships(rels || []);
      setAccountEmail(user?.email || '');
      if (existingContact) {
        setExistingContactId(existingContact.id);
        setForm({
          first_name: existingContact.first_name || '',
          last_name: existingContact.last_name || '',
          relationship_id: existingContact.relationship_id || '',
          phone: existingContact.phone || '',
          street: family?.street || '',
          street2: family?.street2 || '',
          city: family?.city || '',
          state: family?.state || '',
          zip: family?.zip || '',
        });
      }
    }
    load();
  }, [familyId]);

  function handleChange(e) { setForm(f => ({ ...f, [e.target.name]: e.target.value })); }
  function handlePhone(e) { setForm(f => ({ ...f, phone: e.target.value.replace(/\D/g, '').slice(0, 10) })); }

  async function handleSubmit(e) {
    e.preventDefault();
    setError('');
    if (form.phone.length !== 10) { setError('Phone must be 10 digits.'); return; }
    if (!form.street || !form.city || !form.state || !form.zip) { setError('Please complete all address fields.'); return; }

    setSaving(true);
    const supabase = createClient();

    await supabase.from('families').update({
      street: form.street.trim(), street2: form.street2.trim() || null,
      city: form.city.trim(), state: form.state, zip: form.zip.trim(),
    }).eq('id', familyId);

    const contactPayload = {
      family_id: familyId, priority: 1,
      first_name: form.first_name.trim(), last_name: form.last_name.trim(),
      relationship_id: form.relationship_id || null, phone: form.phone,
      email: accountEmail || null, authorized_pickup: false,
      street: form.street.trim(), street2: form.street2.trim() || null,
      city: form.city.trim(), state: form.state, zip: form.zip.trim(),
    };

    let contactError;
    if (existingContactId) {
      ({ error: contactError } = await supabase.from('contacts').update(contactPayload).eq('id', existingContactId));
    } else {
      ({ error: contactError } = await supabase.from('contacts').insert(contactPayload));
    }

    if (contactError) { setError(contactError.message); setSaving(false); return; }
    onComplete();
  }

  return (
    <form onSubmit={handleSubmit}>
      {error && <div className="tyt-error">{error}</div>}
      <h2 style={{ fontFamily: 'var(--font-display)', fontSize: '1.4rem', fontWeight: 700, letterSpacing: '0.05em', textTransform: 'uppercase', color: 'var(--text-primary)', marginBottom: '0.25rem' }}>
        Primary Parent / Guardian Information
      </h2>
      <p style={{ fontFamily: 'var(--font-accent)', fontStyle: 'italic', color: 'var(--text-muted)', fontSize: '0.9rem', marginBottom: '1.5rem' }}>
        This will become your primary contact on file for all participants in your family.
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
        <label className="tyt-label">Relationship <span style={{ color: 'var(--red)' }}>*</span></label>
        <select name="relationship_id" value={form.relationship_id} onChange={handleChange} required className="tyt-input">
          <option value="">Select relationship</option>
          {relationships.map(r => <option key={r.id} value={r.id}>{r.label}</option>)}
        </select>
      </div>

      <div style={{ marginBottom: '1rem' }}>
        <label className="tyt-label">Mobile Phone <span style={{ color: 'var(--red)' }}>*</span></label>
        <input type="tel" name="phone" value={form.phone} onChange={handlePhone} placeholder="10 digits" maxLength={10} className="tyt-input" />
        {form.phone.length > 0 && form.phone.length < 10 && (
          <p style={{ fontFamily: 'var(--font-body)', fontSize: '0.75rem', color: 'var(--text-faint)', marginTop: '0.3rem' }}>{10 - form.phone.length} more digit{10 - form.phone.length !== 1 ? 's' : ''} needed</p>
        )}
      </div>

      <div style={{ marginBottom: '1.5rem' }}>
        <label className="tyt-label">Account Email</label>
        <div style={{ width: '100%', background: 'var(--bg-dark)', border: '1px solid var(--border)', borderRadius: 'var(--radius-sm)', padding: '0.75rem 1rem', color: 'var(--text-muted)', fontFamily: 'var(--font-body)', fontSize: '0.95rem', display: 'flex', alignItems: 'center', justifyContent: 'space-between', boxSizing: 'border-box' }}>
          <span>{accountEmail}</span>
          <span style={{ fontFamily: 'var(--font-display)', fontSize: '0.6rem', fontWeight: 600, letterSpacing: '0.1em', textTransform: 'uppercase', color: 'var(--text-faint)', border: '1px solid var(--border)', borderRadius: '3px', padding: '0.15rem 0.4rem' }}>Account Email</span>
        </div>
      </div>

      <hr className="tyt-divider" />

      <h3 style={{ fontFamily: 'var(--font-display)', fontSize: '1rem', fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase', color: 'var(--text-primary)', marginBottom: '0.25rem', marginTop: '1.5rem' }}>
        Mailing / Physical Address
      </h3>
      <p style={{ fontFamily: 'var(--font-body)', fontSize: '0.825rem', color: 'var(--text-muted)', marginBottom: '1rem' }}>
        This address will be used for all participants in your family.
      </p>

      <div style={{ marginBottom: '1rem' }}>
        <label className="tyt-label">Street Address <span style={{ color: 'var(--red)' }}>*</span></label>
        <input type="text" name="street" value={form.street} onChange={handleChange} required placeholder="123 Main St" className="tyt-input" />
      </div>
      <div style={{ marginBottom: '1rem' }}>
        <label className="tyt-label">Apt / Suite <span style={{ color: 'var(--text-faint)', fontWeight: 400, textTransform: 'none', letterSpacing: 0 }}>(optional)</span></label>
        <input type="text" name="street2" value={form.street2} onChange={handleChange} placeholder="Apt 2B" className="tyt-input" />
      </div>
      <div style={{ marginBottom: '1rem' }}>
        <label className="tyt-label">City <span style={{ color: 'var(--red)' }}>*</span></label>
        <input type="text" name="city" value={form.city} onChange={handleChange} required className="tyt-input" />
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 2fr', gap: '1rem', marginBottom: '1.75rem' }}>
        <div>
          <label className="tyt-label">State <span style={{ color: 'var(--red)' }}>*</span></label>
          <select name="state" value={form.state} onChange={handleChange} required className="tyt-input">
            <option value="">State</option>
            {US_STATES.map(s => <option key={s} value={s}>{s}</option>)}
          </select>
        </div>
        <div>
          <label className="tyt-label">ZIP Code <span style={{ color: 'var(--red)' }}>*</span></label>
          <input type="text" name="zip" value={form.zip} onChange={handleChange} required placeholder="02901" maxLength={10} className="tyt-input" />
        </div>
      </div>

      <NavButtons showBack={false} saving={saving} submitLabel="Continue →" />
    </form>
  );
}

// ── Step 2 ────────────────────────────────────────────────────────────────────
function Step2({ onComplete, onBack, familyId }) {
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
      const match = gradeLevels.find(g => g.yog === yog);
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

// REPLACEMENT for the Step3 function in app/onboarding/page.js
// Replace everything from "function Step3(" to the closing "}" before "// ── Step 4"

function Step3({ onComplete, onBack, onSkip, familyId }) {
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [relationships, setRelationships] = useState([]);
  const [sameAddress, setSameAddress] = useState(true);
  const [existingContactId, setExistingContactId] = useState(null);
  const [hasExisting, setHasExisting] = useState(false);
  const [form, setForm] = useState({
    first_name: '', last_name: '', relationship_id: '',
    phone: '', email: '', street: '', street2: '', city: '', state: '', zip: '',
  });

  useEffect(() => {
    async function load() {
      const supabase = createClient();
      const [{ data: rels }, { data: existing }] = await Promise.all([
        supabase.from('relationships').select('id, label').order('label'),
        supabase.from('contacts').select('*').eq('family_id', familyId).eq('priority', 2).maybeSingle(),
      ]);
      setRelationships(rels || []);
      if (existing) {
        setExistingContactId(existing.id);
        setHasExisting(true);
        setForm({
          first_name: existing.first_name || '',
          last_name: existing.last_name || '',
          relationship_id: existing.relationship_id || '',
          phone: existing.phone || '',
          email: existing.email || '',
          street: existing.street || '',
          street2: existing.street2 || '',
          city: existing.city || '',
          state: existing.state || '',
          zip: existing.zip || '',
        });
      }
    }
    load();
  }, [familyId]);

  function handleChange(e) { setForm(f => ({ ...f, [e.target.name]: e.target.value })); }
  function handlePhone(e) { setForm(f => ({ ...f, phone: e.target.value.replace(/\D/g, '').slice(0, 10) })); }

  async function handleSubmit(e) {
    e.preventDefault();
    setError('');

    // Only validate if the user has entered something
    const hasData = form.first_name.trim() || form.last_name.trim() || form.phone;
    if (!hasData && !hasExisting) { onSkip(); return; }

    if (form.phone && form.phone.length !== 10) { setError('Phone must be 10 digits.'); return; }
    if (!sameAddress && (!form.street || !form.city || !form.state || !form.zip)) {
      setError('Please complete all address fields.'); return;
    }

    setSaving(true);
    const supabase = createClient();

    let addressFields = {};
    if (!sameAddress) {
      addressFields = {
        street: form.street.trim(), street2: form.street2.trim() || null,
        city: form.city.trim(), state: form.state, zip: form.zip.trim(),
      };
    } else {
      const { data: family } = await supabase.from('families').select('street, street2, city, state, zip').eq('id', familyId).single();
      addressFields = { street: family.street, street2: family.street2, city: family.city, state: family.state, zip: family.zip };
    }

    const payload = {
      family_id: familyId, priority: 2,
      first_name: form.first_name.trim(), last_name: form.last_name.trim(),
      relationship_id: form.relationship_id || null, phone: form.phone,
      email: form.email.trim() || null, authorized_pickup: false, ...addressFields,
    };

    let err;
    if (existingContactId) {
      ({ error: err } = await supabase.from('contacts').update(payload).eq('id', existingContactId));
    } else {
      ({ error: err } = await supabase.from('contacts').insert(payload));
    }

    if (err) { setError(err.message); setSaving(false); return; }
    onComplete();
  }

  return (
    <form onSubmit={handleSubmit}>
      {error && <div className="tyt-error">{error}</div>}

      <h2 style={{ fontFamily: 'var(--font-display)', fontSize: '1.4rem', fontWeight: 700, letterSpacing: '0.05em', textTransform: 'uppercase', color: 'var(--text-primary)', marginBottom: '0.25rem' }}>
        Secondary Guardian
      </h2>
      <p style={{ fontFamily: 'var(--font-accent)', fontStyle: 'italic', color: 'var(--text-muted)', fontSize: '0.9rem', marginBottom: '1.5rem' }}>
        Optional — add a second parent or guardian to your account.
      </p>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem', marginBottom: '1rem' }}>
        <div>
          <label className="tyt-label">First Name</label>
          <input type="text" name="first_name" value={form.first_name} onChange={handleChange} className="tyt-input" />
        </div>
        <div>
          <label className="tyt-label">Last Name</label>
          <input type="text" name="last_name" value={form.last_name} onChange={handleChange} className="tyt-input" />
        </div>
      </div>

      <div style={{ marginBottom: '1rem' }}>
        <label className="tyt-label">Relationship</label>
        <select name="relationship_id" value={form.relationship_id} onChange={handleChange} className="tyt-input">
          <option value="">Select relationship</option>
          {relationships.map(r => <option key={r.id} value={r.id}>{r.label}</option>)}
        </select>
      </div>

      <div style={{ marginBottom: '1rem' }}>
        <label className="tyt-label">Mobile Phone</label>
        <input type="tel" name="phone" value={form.phone} onChange={handlePhone} placeholder="10 digits" maxLength={10} className="tyt-input" />
        {form.phone.length > 0 && form.phone.length < 10 && (
          <p style={{ fontFamily: 'var(--font-body)', fontSize: '0.75rem', color: 'var(--text-faint)', marginTop: '0.3rem' }}>
            {10 - form.phone.length} more digit{10 - form.phone.length !== 1 ? 's' : ''} needed
          </p>
        )}
      </div>

      <div style={{ marginBottom: '1.5rem' }}>
        <label className="tyt-label">Email <span style={{ color: 'var(--text-faint)', fontWeight: 400, textTransform: 'none', letterSpacing: 0 }}>(optional)</span></label>
        <input type="email" name="email" value={form.email} onChange={handleChange} className="tyt-input" />
      </div>

      <hr className="tyt-divider" />

      <div style={{ background: 'var(--bg-hover)', border: '1px solid var(--border)', borderRadius: 'var(--radius-md)', padding: '1rem 1.25rem', marginBottom: sameAddress ? '1.5rem' : '1rem' }}>
        <p style={{ fontFamily: 'var(--font-display)', fontSize: '0.8rem', fontWeight: 600, letterSpacing: '0.08em', textTransform: 'uppercase', color: 'var(--text-muted)', marginBottom: '0.75rem' }}>Address</p>
        <div style={{ display: 'flex', gap: '1rem' }}>
          <button type="button" onClick={() => setSameAddress(true)} className={sameAddress ? 'tyt-btn tyt-btn-gold' : 'tyt-btn tyt-btn-secondary'} style={{ flex: 1, fontSize: '0.8rem', padding: '0.5rem' }}>Same as primary</button>
          <button type="button" onClick={() => setSameAddress(false)} className={!sameAddress ? 'tyt-btn tyt-btn-primary' : 'tyt-btn tyt-btn-secondary'} style={{ flex: 1, fontSize: '0.8rem', padding: '0.5rem' }}>Different address</button>
        </div>
      </div>

      {!sameAddress && (
        <>
          <div style={{ marginBottom: '1rem' }}>
            <label className="tyt-label">Street Address <span style={{ color: 'var(--red)' }}>*</span></label>
            <input type="text" name="street" value={form.street} onChange={handleChange} required className="tyt-input" />
          </div>
          <div style={{ marginBottom: '1rem' }}>
            <label className="tyt-label">Apt / Suite <span style={{ color: 'var(--text-faint)', fontWeight: 400, textTransform: 'none', letterSpacing: 0 }}>(optional)</span></label>
            <input type="text" name="street2" value={form.street2} onChange={handleChange} className="tyt-input" />
          </div>
          <div style={{ marginBottom: '1rem' }}>
            <label className="tyt-label">City <span style={{ color: 'var(--red)' }}>*</span></label>
            <input type="text" name="city" value={form.city} onChange={handleChange} required className="tyt-input" />
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 2fr', gap: '1rem', marginBottom: '1.5rem' }}>
            <div>
              <label className="tyt-label">State <span style={{ color: 'var(--red)' }}>*</span></label>
              <select name="state" value={form.state} onChange={handleChange} required className="tyt-input">
                <option value="">State</option>
                {US_STATES.map(s => <option key={s} value={s}>{s}</option>)}
              </select>
            </div>
            <div>
              <label className="tyt-label">ZIP <span style={{ color: 'var(--red)' }}>*</span></label>
              <input type="text" name="zip" value={form.zip} onChange={handleChange} required maxLength={10} className="tyt-input" />
            </div>
          </div>
        </>
      )}

      <div style={{ display: 'flex', gap: '1rem' }}>
        <button type="button" onClick={onBack} className="tyt-btn tyt-btn-secondary" style={{ flex: 1 }}>← Back</button>
        <button type="submit" disabled={saving} className="tyt-btn tyt-btn-primary" style={{ flex: 1 }}>
          {saving ? 'Saving...' : 'Continue →'}
        </button>
        {!hasExisting && (
          <button type="button" onClick={onSkip} className="tyt-btn tyt-btn-secondary" style={{ flex: 1 }}>Skip</button>
        )}
      </div>
    </form>
  );
}

// ── Step 4 ────────────────────────────────────────────────────────────────────
function Step4({ onComplete, onBack, familyId }) {
  const [saving, setSaving] = useState(false);
  const [errors, setErrors] = useState([]);
  const [existingEcIds, setExistingEcIds] = useState([null, null]);
  const [forms, setForms] = useState([
    { first_name: '', last_name: '', phone: '' },
    { first_name: '', last_name: '', phone: '' },
  ]);

  useEffect(() => {
    async function load() {
      const supabase = createClient();
      const { data: existing } = await supabase
        .from('contacts')
        .select('*')
        .eq('family_id', familyId)
        .in('priority', [3, 4])
        .order('priority');

      if (existing?.length) {
        const newForms = [
          { first_name: '', last_name: '', phone: '' },
          { first_name: '', last_name: '', phone: '' },
        ];
        const newIds = [null, null];
        existing.forEach((ec, i) => {
          if (i < 2) {
            newForms[i] = { first_name: ec.first_name || '', last_name: ec.last_name || '', phone: ec.phone || '' };
            newIds[i] = ec.id;
          }
        });
        setForms(newForms);
        setExistingEcIds(newIds);
      }
    }
    load();
  }, [familyId]);

  function handleChange(idx, e) {
    const { name, value } = e.target;
    setForms(f => f.map((item, i) => i === idx ? { ...item, [name]: value } : item));
  }

  function handlePhone(idx, e) {
    const digits = e.target.value.replace(/\D/g, '').slice(0, 10);
    setForms(f => f.map((item, i) => i === idx ? { ...item, phone: digits } : item));
  }

  async function handleSubmit(e) {
    e.preventDefault();
    setErrors([]);

    const primary = forms[0];
    const secondary = forms[1];

    if (!primary.first_name.trim() || !primary.last_name.trim()) {
      setErrors(['Primary emergency contact name is required.']); return;
    }
    if (primary.phone.length !== 10) {
      setErrors(['Primary emergency contact phone must be 10 digits.']); return;
    }

    const hasSecondary = secondary.first_name.trim() || secondary.last_name.trim() || secondary.phone;
    if (hasSecondary && secondary.phone.length !== 10) {
      setErrors(['Secondary emergency contact phone must be 10 digits.']); return;
    }

    // Run full cross-contact validation
    const supabase = createClient();
    const [{ data: guardians }, { data: participants }] = await Promise.all([
      supabase.from('contacts').select('first_name, last_name, phone, email').eq('family_id', familyId).in('priority', [1, 2]),
      supabase.from('participants').select('first_name, last_name, phone, email').eq('family_id', familyId),
    ]);

    const ecList = [{ ...primary }];
    if (hasSecondary && secondary.first_name.trim()) ecList.push({ ...secondary });

    const validationErrors = validateContacts({
      guardians: guardians || [],
      emergencyContacts: ecList,
      participants: participants || [],
    });

    if (validationErrors.length > 0) {
      setErrors(validationErrors);
      return;
    }

    setSaving(true);

    // Save/update each EC
    for (let i = 0; i < 2; i++) {
      const f = forms[i];
      const isSecond = i === 1;
      const skip = isSecond && !f.first_name.trim() && !f.last_name.trim() && !f.phone;
      if (skip) continue;

      const payload = {
        family_id: familyId, priority: i === 0 ? 3 : 4,
        first_name: f.first_name.trim(), last_name: f.last_name.trim(),
        phone: f.phone, relationship_id: null, authorized_pickup: false,
      };

      if (existingEcIds[i]) {
        await supabase.from('contacts').update(payload).eq('id', existingEcIds[i]);
      } else {
        await supabase.from('contacts').insert(payload);
      }
    }

    await supabase.from('families').update({ is_onboarding_complete: true }).eq('id', familyId);
    onComplete();
  }

  return (
    <form onSubmit={handleSubmit}>
      {errors.length > 0 && (
        <div className="tyt-error" style={{ marginBottom: '1.25rem' }}>
          {errors.map((err, i) => (
            <p key={i} style={{ marginBottom: i < errors.length - 1 ? '0.5rem' : 0 }}>{err}</p>
          ))}
          {errors.length > 0 && (
            <p style={{ marginTop: '0.75rem', fontWeight: 600, fontSize: '0.8rem' }}>
              Please use the Back button to correct the information above.
            </p>
          )}
        </div>
      )}

      <h2 style={{ fontFamily: 'var(--font-display)', fontSize: '1.4rem', fontWeight: 700, letterSpacing: '0.05em', textTransform: 'uppercase', color: 'var(--text-primary)', marginBottom: '0.25rem' }}>
        Emergency Contacts
      </h2>
      <p style={{ fontFamily: 'var(--font-accent)', fontStyle: 'italic', color: 'var(--text-muted)', fontSize: '0.9rem', marginBottom: '0.5rem' }}>
        Emergency contacts must not be a parent or guardian already listed.
      </p>
      <p style={{ fontFamily: 'var(--font-body)', fontWeight: 600, fontSize: '0.825rem', color: 'var(--text-faint)', marginBottom: '1.5rem' }}>
        One emergency contact is required. A second is optional.
      </p>

      {[0, 1].map(idx => (
        <div key={idx} style={{ background: 'var(--bg-hover)', border: '1px solid var(--border)', borderRadius: 'var(--radius-md)', padding: '1.25rem', marginBottom: '1rem' }}>
          <p style={{ fontFamily: 'var(--font-display)', fontSize: '0.75rem', fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase', color: idx === 0 ? 'var(--gold)' : 'var(--text-muted)', marginBottom: '1rem' }}>
            {idx === 0 ? 'Primary Emergency Contact *' : 'Secondary Emergency Contact (optional)'}
          </p>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem', marginBottom: '1rem' }}>
            <div>
              <label className="tyt-label">First Name {idx === 0 && <span style={{ color: 'var(--red)' }}>*</span>}</label>
              <input type="text" name="first_name" value={forms[idx].first_name} onChange={e => handleChange(idx, e)} required={idx === 0} className="tyt-input" />
            </div>
            <div>
              <label className="tyt-label">Last Name {idx === 0 && <span style={{ color: 'var(--red)' }}>*</span>}</label>
              <input type="text" name="last_name" value={forms[idx].last_name} onChange={e => handleChange(idx, e)} required={idx === 0} className="tyt-input" />
            </div>
          </div>
          <div>
            <label className="tyt-label">Phone {idx === 0 && <span style={{ color: 'var(--red)' }}>*</span>}</label>
            <input type="tel" name="phone" value={forms[idx].phone} onChange={e => handlePhone(idx, e)} placeholder="10 digits" maxLength={10} className="tyt-input" />
            {forms[idx].phone.length > 0 && forms[idx].phone.length < 10 && (
              <p style={{ fontFamily: 'var(--font-body)', fontSize: '0.75rem', color: 'var(--text-faint)', marginTop: '0.3rem' }}>{10 - forms[idx].phone.length} more digit{10 - forms[idx].phone.length !== 1 ? 's' : ''} needed</p>
            )}
          </div>
        </div>
      ))}

      <NavButtons onBack={onBack} saving={saving} submitLabel="Complete Setup →" />
    </form>
  );
}

// ── Main ──────────────────────────────────────────────────────────────────────
export default function OnboardingPage() {
  const [step, setStep] = useState(1);
  const [familyId, setFamilyId] = useState(null);

  useEffect(() => {
    async function load() {
      const supabase = createClient();
      const { data: { user } } = await supabase.auth.getUser();
      const { data: profile } = await supabase.from('profiles').select('family_id').eq('id', user.id).single();
      setFamilyId(profile?.family_id || null);
    }
    load();
  }, []);

  function next() { setStep(s => Math.min(s + 1, 4)); }
  function back() { setStep(s => Math.max(s - 1, 1)); }

  if (!familyId) {
    return (
      <div style={{ minHeight: '100vh', background: 'var(--bg-dark)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <p style={{ fontFamily: 'var(--font-accent)', fontStyle: 'italic', color: 'var(--text-muted)' }}>Loading...</p>
      </div>
    );
  }

  return (
    <div style={{ minHeight: '100vh', background: 'var(--bg-dark)', display: 'flex', flexDirection: 'column' }}>
      <div style={{ textAlign: 'center', padding: '2rem 1.5rem 0' }}>
        <Image src="/images/tyt-logo.png" alt="Triboro Youth Theatre" width={80} height={80} style={{ objectFit: 'contain' }} priority />
        <h1 style={{ fontFamily: 'var(--font-display)', fontSize: '1.4rem', fontWeight: 800, letterSpacing: '0.08em', textTransform: 'uppercase', color: 'var(--text-primary)', marginTop: '0.5rem', marginBottom: '0.25rem' }}>
          Welcome to TYT
        </h1>
        <p style={{ fontFamily: 'var(--font-accent)', fontStyle: 'italic', color: 'var(--text-muted)', fontSize: '0.9rem', marginBottom: '1.5rem' }}>
          Let&apos;s get your account set up.
        </p>
      </div>

      <div style={{ padding: '0 1.5rem' }}>
        <StepIndicator currentStep={step} />
      </div>

      <main style={{ maxWidth: '560px', width: '100%', margin: '0 auto', padding: '0 1.5rem 3rem' }}>
        <div className="tyt-card">
          {step === 1 && <Step1 onComplete={next} familyId={familyId} />}
          {step === 2 && <Step2 onComplete={next} onBack={back} familyId={familyId} />}
          {step === 3 && <Step3 onComplete={next} onBack={back} onSkip={next} familyId={familyId} />}
          {step === 4 && <Step4 onComplete={() => { window.location.href = '/dashboard'; }} onBack={back} familyId={familyId} />}
        </div>
      </main>
    </div>
  );
}