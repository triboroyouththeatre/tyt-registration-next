'use client';

import { useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import Image from 'next/image';

export default function ChangePasswordPage() {
  const [form, setForm] = useState({
    current_password: '',
    new_password: '',
    confirm_password: '',
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  function handleChange(e) {
    setForm(f => ({ ...f, [e.target.name]: e.target.value }));
  }

  async function handleSubmit(e) {
    e.preventDefault();
    setError('');
    setSuccess('');

    if (form.new_password.length < 8) {
      setError('New password must be at least 8 characters.');
      return;
    }

    if (form.new_password !== form.confirm_password) {
      setError('New passwords do not match.');
      return;
    }

    if (form.current_password === form.new_password) {
      setError('New password must be different from your current password.');
      return;
    }

    setSaving(true);
    const supabase = createClient();

    // Re-authenticate with current password first
    const { data: { user } } = await supabase.auth.getUser();
    const { error: signInError } = await supabase.auth.signInWithPassword({
      email: user.email,
      password: form.current_password,
    });

    if (signInError) {
      setError('Current password is incorrect.');
      setSaving(false);
      return;
    }

    // Update to new password
    const { error: updateError } = await supabase.auth.updateUser({
      password: form.new_password,
    });

    if (updateError) {
      setError(updateError.message);
      setSaving(false);
      return;
    }

    setSuccess('Password updated successfully.');
    setForm({ current_password: '', new_password: '', confirm_password: '' });
    setSaving(false);
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
          Change Password
        </span>
        <a href="/dashboard" style={{ fontFamily: 'var(--font-display)', fontSize: '0.75rem', fontWeight: 600, letterSpacing: '0.1em', textTransform: 'uppercase', color: 'var(--text-muted)', textDecoration: 'none' }}>
          Back
        </a>
      </nav>

      <main style={{ maxWidth: '480px', margin: '0 auto', padding: '2rem 1.5rem' }}>

        <div style={{ marginBottom: '2rem' }}>
          <h1 style={{ fontFamily: 'var(--font-display)', fontSize: '2rem', fontWeight: 800, letterSpacing: '0.05em', textTransform: 'uppercase', color: 'var(--text-primary)', marginBottom: '0.25rem' }}>
            Change Password
          </h1>
          <p style={{ fontFamily: 'var(--font-accent)', fontStyle: 'italic', color: 'var(--text-muted)', fontSize: '1rem' }}>
            Choose a strong password of at least 8 characters.
          </p>
        </div>

        <div className="tyt-card">
          {success && <div className="tyt-success" style={{ marginBottom: '1.25rem' }}>{success}</div>}

          <form onSubmit={handleSubmit}>
            {error && <div className="tyt-error">{error}</div>}

            <div style={{ marginBottom: '1.25rem' }}>
              <label className="tyt-label">Current Password <span style={{ color: 'var(--red)' }}>*</span></label>
              <input
                type="password"
                name="current_password"
                value={form.current_password}
                onChange={handleChange}
                required
                placeholder="••••••••"
                className="tyt-input"
              />
            </div>

            <hr className="tyt-divider" />

            <div style={{ marginBottom: '1.25rem', marginTop: '1.25rem' }}>
              <label className="tyt-label">New Password <span style={{ color: 'var(--red)' }}>*</span></label>
              <input
                type="password"
                name="new_password"
                value={form.new_password}
                onChange={handleChange}
                required
                placeholder="At least 8 characters"
                className="tyt-input"
              />
              {form.new_password.length > 0 && form.new_password.length < 8 && (
                <p style={{ fontFamily: 'var(--font-body)', fontSize: '0.75rem', color: 'var(--text-faint)', marginTop: '0.3rem' }}>
                  {8 - form.new_password.length} more character{8 - form.new_password.length !== 1 ? 's' : ''} needed
                </p>
              )}
            </div>

            <div style={{ marginBottom: '1.75rem' }}>
              <label className="tyt-label">Confirm New Password <span style={{ color: 'var(--red)' }}>*</span></label>
              <input
                type="password"
                name="confirm_password"
                value={form.confirm_password}
                onChange={handleChange}
                required
                placeholder="••••••••"
                className="tyt-input"
              />
              {form.confirm_password.length > 0 && form.new_password !== form.confirm_password && (
                <p style={{ fontFamily: 'var(--font-body)', fontSize: '0.75rem', color: 'var(--error)', marginTop: '0.3rem' }}>
                  Passwords do not match
                </p>
              )}
              {form.confirm_password.length > 0 && form.new_password === form.confirm_password && form.new_password.length >= 8 && (
                <p style={{ fontFamily: 'var(--font-body)', fontSize: '0.75rem', color: 'var(--gold)', marginTop: '0.3rem' }}>
                  ✓ Passwords match
                </p>
              )}
            </div>

            <button
              type="submit"
              disabled={saving}
              className="tyt-btn tyt-btn-primary tyt-btn-full"
            >
              {saving ? 'Updating...' : 'Update Password'}
            </button>
          </form>
        </div>

      </main>
    </div>
  );
}