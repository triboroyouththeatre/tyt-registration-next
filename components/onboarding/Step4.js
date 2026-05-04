'use client';

import { useState, useEffect } from 'react';
import { createClient } from '@/lib/supabase/client';
import { validateContacts } from '@/lib/contact-validation';
import NavButtons from './NavButtons';

export default function Step4({ onComplete, onBack, familyId, ecForms, setEcForms }) {
  const [saving, setSaving] = useState(false);
  const [errors, setErrors] = useState([]);
  const [existingEcIds, setExistingEcIds] = useState([null, null]);
  const [forms, setForms] = useState(ecForms || [
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
    setForms(f => {
      const updated = f.map((item, i) => i === idx ? { ...item, [name]: value } : item);
      setEcForms(updated);
      return updated;
    });
  }

  function handlePhone(idx, e) {
    const digits = e.target.value.replace(/\D/g, '').slice(0, 10);
    setForms(f => {
      const updated = f.map((item, i) => i === idx ? { ...item, phone: digits } : item);
      setEcForms(updated);
      return updated;
    });
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

    if (validationErrors.length > 0) { setErrors(validationErrors); return; }

    setSaving(true);

    for (let i = 0; i < 2; i++) {
      const f = forms[i];
      const skip = i === 1 && !f.first_name.trim() && !f.last_name.trim() && !f.phone;
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
          <p style={{ marginTop: '0.75rem', fontWeight: 600, fontSize: '0.8rem' }}>
            Please use the Back button to correct the information above.
          </p>
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
