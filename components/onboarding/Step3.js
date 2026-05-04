'use client';

import { useState, useEffect } from 'react';
import { createClient } from '@/lib/supabase/client';
import { US_STATES } from './constants';

export default function Step3({ onComplete, onBack, onSkip, familyId }) {
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
