'use client';

import { useState, useEffect } from 'react';
import { createClient } from '@/lib/supabase/client';
import { validateContacts } from '@/lib/contact-validation';
import Image from 'next/image';

const CONTACT_SLOTS = [
  { priority: 1, label: 'Primary Guardian', required: true, description: 'First contact in any situation', isGuardian: true },
  { priority: 2, label: 'Secondary Guardian', required: false, description: 'Second guardian or co-parent', isGuardian: true },
  { priority: 3, label: 'Primary Emergency Contact', required: true, description: 'Must not be a parent or guardian', isGuardian: false },
  { priority: 4, label: 'Secondary Emergency Contact', required: false, description: 'Additional emergency contact', isGuardian: false },
];

function ContactCard({ slot, contact, relationships, familyId, onSaved, allContacts, participants }) {
  const [editing, setEditing] = useState(!contact);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const initialForm = contact ? {
    first_name: contact.first_name || '',
    last_name: contact.last_name || '',
    relationship_id: contact.relationship_id || '',
    phone: contact.phone || '',
    email: contact.email || '',
  } : { first_name: '', last_name: '', relationship_id: '', phone: '', email: '' };

  const [form, setForm] = useState(initialForm);

  function handleChange(e) { setForm(f => ({ ...f, [e.target.name]: e.target.value })); }
  function handlePhone(e) { setForm(f => ({ ...f, phone: e.target.value.replace(/\D/g, '').slice(0, 10) })); }

  function handleCancel() {
    setForm(initialForm);
    setEditing(false);
    setError('');
  }

  async function handleSave(e) {
    e.preventDefault();
    setError('');

    if (!form.first_name.trim() || !form.last_name.trim()) { setError('First and last name are required.'); return; }
    if (slot.isGuardian && !form.relationship_id) { setError('Please select a relationship.'); return; }
    if (!form.phone || form.phone.length !== 10) { setError('A valid 10-digit phone number is required.'); return; }

    // Build the updated contact list for validation
    const updatedContact = {
      first_name: form.first_name.trim(),
      last_name: form.last_name.trim(),
      phone: form.phone,
      email: form.email.trim() || null,
      priority: slot.priority,
    };

    // Replace this slot in allContacts with the updated version
    const updatedContacts = [
      ...allContacts.filter(c => c.priority !== slot.priority),
      updatedContact,
    ];

    const guardians = updatedContacts.filter(c => c.priority <= 2);
    const emergencyContacts = updatedContacts.filter(c => c.priority >= 3);

    const validationErrors = validateContacts({ guardians, emergencyContacts, participants });
    if (validationErrors.length > 0) {
      setError(validationErrors[0]);
      return;
    }

    setSaving(true);
    const supabase = createClient();

    const payload = {
      family_id: familyId, priority: slot.priority,
      first_name: form.first_name.trim(), last_name: form.last_name.trim(),
      relationship_id: slot.isGuardian ? form.relationship_id : null,
      phone: form.phone,
      email: slot.isGuardian ? (form.email.trim() || null) : null,
      authorized_pickup: false,
    };

    let err;
    if (contact) {
      ({ error: err } = await supabase.from('contacts').update(payload).eq('id', contact.id));
    } else {
      ({ error: err } = await supabase.from('contacts').insert(payload));
    }

    if (err) { setError(err.message); setSaving(false); return; }
    setSaving(false);
    setEditing(false);
    onSaved();
  }

  const relationship = relationships.find(r => r.id === contact?.relationship_id);

  return (
    <div style={{ background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 'var(--radius-md)', overflow: 'hidden', marginBottom: '1rem' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0.875rem 1.25rem', borderBottom: '1px solid var(--border)', background: 'var(--bg-hover)' }}>
        <div>
          <span style={{ fontFamily: 'var(--font-display)', fontSize: '0.8rem', fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase', color: slot.isGuardian ? 'var(--gold)' : 'var(--text-muted)' }}>
            {slot.label}
          </span>
          {slot.required && <span style={{ color: 'var(--red)', marginLeft: '0.3rem', fontSize: '0.75rem' }}>*</span>}
          <p style={{ fontFamily: 'var(--font-body)', fontSize: '0.75rem', color: 'var(--text-faint)', marginTop: '0.1rem' }}>{slot.description}</p>
        </div>
        {contact && !editing && (
          <button onClick={() => setEditing(true)} style={{ background: 'none', border: '1px solid var(--border)', borderRadius: 'var(--radius-sm)', padding: '0.3rem 0.75rem', color: 'var(--text-muted)', fontFamily: 'var(--font-display)', fontSize: '0.7rem', fontWeight: 600, letterSpacing: '0.1em', textTransform: 'uppercase', cursor: 'pointer' }}>
            Edit
          </button>
        )}
      </div>

      <div style={{ padding: '1.25rem' }}>
        {!editing && contact ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.6rem' }}>
            {[
              { label: 'Name', value: `${contact.first_name} ${contact.last_name}` },
              slot.isGuardian && { label: 'Relationship', value: relationship?.label || '—' },
              { label: 'Phone', value: contact.phone || '—' },
              slot.isGuardian && { label: 'Email', value: contact.email || '—' },
            ].filter(Boolean).map(item => (
              <div key={item.label} style={{ display: 'flex', justifyContent: 'space-between', gap: '1rem' }}>
                <span style={{ fontFamily: 'var(--font-display)', fontSize: '0.7rem', fontWeight: 600, letterSpacing: '0.1em', textTransform: 'uppercase', color: 'var(--text-muted)', flexShrink: 0 }}>{item.label}</span>
                <span style={{ fontFamily: 'var(--font-body)', fontSize: '0.9rem', color: item.value === '—' ? 'var(--text-faint)' : 'var(--text-primary)', textAlign: 'right' }}>{item.value}</span>
              </div>
            ))}
          </div>
        ) : !editing && !contact ? (
          <div style={{ textAlign: 'center', padding: '0.5rem 0' }}>
            <p style={{ fontFamily: 'var(--font-accent)', fontStyle: 'italic', color: 'var(--text-faint)', fontSize: '0.875rem', marginBottom: '0.75rem' }}>
              {slot.required ? 'Required — not yet added.' : 'Optional — not yet added.'}
            </p>
            <button onClick={() => setEditing(true)} className="tyt-btn tyt-btn-secondary" style={{ fontSize: '0.8rem', padding: '0.5rem 1.25rem' }}>
              + Add {slot.label}
            </button>
          </div>
        ) : (
          <form onSubmit={handleSave}>
            {error && <div className="tyt-error">{error}</div>}

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

            {slot.isGuardian && (
              <div style={{ marginBottom: '1rem' }}>
                <label className="tyt-label">Relationship <span style={{ color: 'var(--red)' }}>*</span></label>
                <select name="relationship_id" value={form.relationship_id} onChange={handleChange} required className="tyt-input">
                  <option value="">Select relationship</option>
                  {relationships.map(r => <option key={r.id} value={r.id}>{r.label}</option>)}
                </select>
              </div>
            )}

            <div style={{ marginBottom: '1rem' }}>
              <label className="tyt-label">Phone <span style={{ color: 'var(--red)' }}>*</span></label>
              <input type="tel" name="phone" value={form.phone} onChange={handlePhone} placeholder="10 digits" maxLength={10} className="tyt-input" />
              {form.phone.length > 0 && form.phone.length < 10 && (
                <p style={{ fontFamily: 'var(--font-body)', fontSize: '0.75rem', color: 'var(--text-faint)', marginTop: '0.3rem' }}>{10 - form.phone.length} more digit{10 - form.phone.length !== 1 ? 's' : ''} needed</p>
              )}
            </div>

            {slot.isGuardian && (
              <div style={{ marginBottom: '1.25rem' }}>
                <label className="tyt-label">Email <span style={{ color: 'var(--text-faint)', fontWeight: 400, textTransform: 'none', letterSpacing: 0 }}>(optional)</span></label>
                <input type="email" name="email" value={form.email} onChange={handleChange} className="tyt-input" />
              </div>
            )}

            <div style={{ display: 'flex', gap: '0.75rem' }}>
              <button type="submit" disabled={saving} className="tyt-btn tyt-btn-primary" style={{ flex: 1 }}>
                {saving ? 'Saving...' : contact ? 'Save Changes' : `Add ${slot.label}`}
              </button>
              {contact && (
                <button type="button" onClick={handleCancel} className="tyt-btn tyt-btn-secondary" style={{ flex: 1 }}>Cancel</button>
              )}
            </div>
          </form>
        )}
      </div>
    </div>
  );
}

export default function ContactsPage() {
  const [loading, setLoading] = useState(true);
  const [familyId, setFamilyId] = useState(null);
  const [contacts, setContacts] = useState([]);
  const [participants, setParticipants] = useState([]);
  const [relationships, setRelationships] = useState([]);

  async function loadData() {
    const supabase = createClient();
    const { data: { user } } = await supabase.auth.getUser();
    const { data: profile } = await supabase.from('profiles').select('family_id').eq('id', user.id).single();

    const [{ data: contactData }, { data: relData }, { data: participantData }] = await Promise.all([
      supabase.from('contacts').select('*, relationships(label)').eq('family_id', profile.family_id).order('priority'),
      supabase.from('relationships').select('id, label').order('label'),
      supabase.from('participants').select('first_name, last_name, phone, email').eq('family_id', profile.family_id),
    ]);

    setFamilyId(profile.family_id);
    setContacts(contactData || []);
    setRelationships(relData || []);
    setParticipants(participantData || []);
    setLoading(false);
  }

  useEffect(() => { loadData(); }, []);

  if (loading) {
    return (
      <div style={{ minHeight: '100vh', background: 'var(--bg-dark)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <p style={{ fontFamily: 'var(--font-accent)', fontStyle: 'italic', color: 'var(--text-muted)' }}>Loading...</p>
      </div>
    );
  }

  return (
    <div style={{ minHeight: '100vh', background: 'var(--bg-dark)' }}>
      <nav style={{ background: 'var(--bg-card)', borderBottom: '1px solid var(--border)', padding: '0 1.5rem', display: 'flex', alignItems: 'center', justifyContent: 'space-between', height: '64px', position: 'sticky', top: 0, zIndex: 100 }}>
        <a href="/dashboard" style={{ display: 'flex', alignItems: 'center', textDecoration: 'none' }}>
          <Image src="/images/tyt-logo.png" alt="Triboro Youth Theatre" width={48} height={48} style={{ objectFit: 'contain' }} />
        </a>
        <span style={{ fontFamily: 'var(--font-display)', fontSize: '1.1rem', fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase', color: 'var(--text-primary)' }}>Contacts</span>
        <a href="/dashboard" style={{ fontFamily: 'var(--font-display)', fontSize: '0.75rem', fontWeight: 600, letterSpacing: '0.1em', textTransform: 'uppercase', color: 'var(--gold)', textDecoration: 'none', border: '1px solid var(--gold)', borderRadius: 'var(--radius-sm)', padding: '0.35rem 0.85rem' }}>← Back</a>
      </nav>

      <main style={{ maxWidth: '680px', margin: '0 auto', padding: '2rem 1.5rem' }}>
        <div style={{ marginBottom: '2rem' }}>
          <h1 style={{ fontFamily: 'var(--font-display)', fontSize: '2rem', fontWeight: 800, letterSpacing: '0.05em', textTransform: 'uppercase', color: 'var(--text-primary)', marginBottom: '0.25rem' }}>Contacts</h1>
          <p style={{ fontFamily: 'var(--font-accent)', fontStyle: 'italic', color: 'var(--text-muted)', fontSize: '1rem' }}>
            Guardians are contacted first. Emergency contacts are reached only if guardians are unavailable.
          </p>
        </div>

        <h2 style={{ fontFamily: 'var(--font-display)', fontSize: '1rem', fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase', color: 'var(--gold)', marginBottom: '0.75rem' }}>
          Parent / Guardian
        </h2>
        {CONTACT_SLOTS.filter(s => s.isGuardian).map(slot => (
          <ContactCard
            key={slot.priority}
            slot={slot}
            contact={contacts.find(c => c.priority === slot.priority) || null}
            relationships={relationships}
            familyId={familyId}
            allContacts={contacts}
            participants={participants}
            onSaved={loadData}
          />
        ))}

        <h2 style={{ fontFamily: 'var(--font-display)', fontSize: '1rem', fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase', color: 'var(--text-muted)', marginTop: '1.5rem', marginBottom: '0.75rem' }}>
          Emergency Contacts
        </h2>
        <p style={{ fontFamily: 'var(--font-body)', fontWeight: 600, fontSize: '0.825rem', color: 'var(--text-faint)', marginBottom: '0.75rem' }}>
          Emergency contacts must not be a parent or guardian listed above.
        </p>
        {CONTACT_SLOTS.filter(s => !s.isGuardian).map(slot => (
          <ContactCard
            key={slot.priority}
            slot={slot}
            contact={contacts.find(c => c.priority === slot.priority) || null}
            relationships={relationships}
            familyId={familyId}
            allContacts={contacts}
            participants={participants}
            onSaved={loadData}
          />
        ))}
      </main>
    </div>
  );
}