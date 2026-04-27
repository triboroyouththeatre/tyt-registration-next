'use client';

import { useState, useEffect } from 'react';
import { createClient } from '@/lib/supabase/client';
import Image from 'next/image';

const US_STATES = [
  'AL','AK','AZ','AR','CA','CO','CT','DE','FL','GA',
  'HI','ID','IL','IN','IA','KS','KY','LA','ME','MD',
  'MA','MI','MN','MS','MO','MT','NE','NV','NH','NJ',
  'NM','NY','NC','ND','OH','OK','OR','PA','RI','SC',
  'SD','TN','TX','UT','VT','VA','WA','WV','WI','WY'
];

export default function AccountPage() {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [editing, setEditing] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [accountEmail, setAccountEmail] = useState('');
  const [familyId, setFamilyId] = useState(null);
  const [form, setForm] = useState({
    street: '', street2: '', city: '', state: '', zip: '',
  });
  const [saved, setSaved] = useState({ ...form });

  useEffect(() => {
    async function load() {
      const supabase = createClient();
      const { data: { user } } = await supabase.auth.getUser();
      const { data: profile } = await supabase
        .from('profiles').select('family_id').eq('id', user.id).single();
      const { data: family } = await supabase
        .from('families').select('street, street2, city, state, zip')
        .eq('id', profile.family_id).single();

      setAccountEmail(user.email || '');
      setFamilyId(profile.family_id);

      const data = {
        street: family?.street || '',
        street2: family?.street2 || '',
        city: family?.city || '',
        state: family?.state || '',
        zip: family?.zip || '',
      };
      setForm(data);
      setSaved(data);
      setLoading(false);
    }
    load();
  }, []);

  function handleChange(e) {
    setForm(f => ({ ...f, [e.target.name]: e.target.value }));
  }

  function handleCancel() {
    setForm(saved);
    setEditing(false);
    setError('');
  }

  async function handleSave(e) {
    e.preventDefault();
    setError('');
    setSuccess('');

    if (!form.street || !form.city || !form.state || !form.zip) {
      setError('Please complete all required address fields.');
      return;
    }

    setSaving(true);
    const supabase = createClient();

    const { error: updateError } = await supabase
      .from('families')
      .update({
        street: form.street.trim(),
        street2: form.street2.trim() || null,
        city: form.city.trim(),
        state: form.state,
        zip: form.zip.trim(),
      })
      .eq('id', familyId);

    if (updateError) {
      setError(updateError.message);
      setSaving(false);
      return;
    }

    setSaved({ ...form });
    setEditing(false);
    setSuccess('Account information updated successfully.');
    setSaving(false);
  }

  if (loading) {
    return (
      <div style={{ minHeight: '100vh', background: 'var(--bg-dark)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <p style={{ fontFamily: 'var(--font-accent)', fontStyle: 'italic', color: 'var(--text-muted)' }}>Loading...</p>
      </div>
    );
  }

  return (
    <div style={{ minHeight: '100vh', background: 'var(--bg-dark)' }}>
      <nav style={{
        background: 'var(--bg-card)', borderBottom: '1px solid var(--border)',
        padding: '0 1.5rem', display: 'flex', alignItems: 'center',
        justifyContent: 'space-between', height: '64px', position: 'sticky', top: 0, zIndex: 100,
      }}>
        <a href="/dashboard" style={{ display: 'flex', alignItems: 'center', textDecoration: 'none' }}>
          <Image src="/images/tyt-logo.png" alt="Triboro Youth Theatre" width={48} height={48} style={{ objectFit: 'contain' }} />
        </a>
        <span style={{ fontFamily: 'var(--font-display)', fontSize: '1.1rem', fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase', color: 'var(--text-primary)' }}>
          Account Information
        </span>
        <a href="/dashboard" style={{ fontFamily: 'var(--font-display)', fontSize: '0.75rem', fontWeight: 600, letterSpacing: '0.1em', textTransform: 'uppercase', color: 'var(--text-muted)', textDecoration: 'none' }}>
          Back
        </a>
      </nav>

      <main style={{ maxWidth: '600px', margin: '0 auto', padding: '2rem 1.5rem' }}>

        <div style={{ marginBottom: '2rem' }}>
          <h1 style={{ fontFamily: 'var(--font-display)', fontSize: '2rem', fontWeight: 800, letterSpacing: '0.05em', textTransform: 'uppercase', color: 'var(--text-primary)', marginBottom: '0.25rem' }}>
            Account Information
          </h1>
          <p style={{ fontFamily: 'var(--font-accent)', fontStyle: 'italic', color: 'var(--text-muted)', fontSize: '1rem' }}>
            Manage your account email and mailing address.
          </p>
        </div>

        {success && <div className="tyt-success">{success}</div>}

        {/* Account Email — read only */}
        <div className="tyt-card" style={{ marginBottom: '1.5rem' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.75rem' }}>
            <h2 style={{ fontFamily: 'var(--font-display)', fontSize: '0.85rem', fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase', color: 'var(--text-muted)' }}>
              Account Email
            </h2>
            <span style={{ fontFamily: 'var(--font-display)', fontSize: '0.65rem', fontWeight: 600, letterSpacing: '0.1em', textTransform: 'uppercase', color: 'var(--text-faint)', border: '1px solid var(--border)', borderRadius: '3px', padding: '0.15rem 0.5rem' }}>
              Read Only
            </span>
          </div>
          <p style={{ fontFamily: 'var(--font-body)', fontSize: '1rem', color: 'var(--text-primary)' }}>
            {accountEmail}
          </p>
          <p style={{ fontFamily: 'var(--font-body)', fontSize: '0.8rem', color: 'var(--text-faint)', marginTop: '0.5rem' }}>
            To change your account email, please contact TYT directly.
          </p>
        </div>

        {/* Address */}
        <div className="tyt-card">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.25rem' }}>
            <h2 style={{ fontFamily: 'var(--font-display)', fontSize: '0.85rem', fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase', color: 'var(--text-muted)' }}>
              Mailing / Physical Address
            </h2>
            {!editing && (
              <button
                onClick={() => setEditing(true)}
                style={{ background: 'none', border: '1px solid var(--border)', borderRadius: 'var(--radius-sm)', padding: '0.3rem 0.75rem', color: 'var(--text-muted)', fontFamily: 'var(--font-display)', fontSize: '0.7rem', fontWeight: 600, letterSpacing: '0.1em', textTransform: 'uppercase', cursor: 'pointer' }}
              >
                Edit
              </button>
            )}
          </div>

          {!editing ? (
            // Read-only view
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
              {saved.street ? (
                <>
                  <p style={{ fontFamily: 'var(--font-body)', fontSize: '0.95rem', color: 'var(--text-primary)' }}>
                    {saved.street}{saved.street2 ? `, ${saved.street2}` : ''}
                  </p>
                  <p style={{ fontFamily: 'var(--font-body)', fontSize: '0.95rem', color: 'var(--text-primary)' }}>
                    {saved.city}, {saved.state} {saved.zip}
                  </p>
                </>
              ) : (
                <p style={{ fontFamily: 'var(--font-accent)', fontStyle: 'italic', color: 'var(--text-faint)' }}>
                  No address on file.
                </p>
              )}
            </div>
          ) : (
            // Edit form
            <form onSubmit={handleSave}>
              {error && <div className="tyt-error">{error}</div>}

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

              <div style={{ display: 'flex', gap: '1rem' }}>
                <button type="submit" disabled={saving} className="tyt-btn tyt-btn-primary" style={{ flex: 1 }}>
                  {saving ? 'Saving...' : 'Save Changes'}
                </button>
                <button type="button" onClick={handleCancel} className="tyt-btn tyt-btn-secondary" style={{ flex: 1 }}>
                  Cancel
                </button>
              </div>
            </form>
          )}
        </div>

      </main>
    </div>
  );
}