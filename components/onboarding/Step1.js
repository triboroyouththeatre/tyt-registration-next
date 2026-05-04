'use client';

import { useState, useEffect } from 'react';
import { createClient } from '@/lib/supabase/client';
import { US_STATES } from './constants';
import NavButtons from './NavButtons';

export default function Step1({ onComplete, familyId }) {
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
