'use client';

import { useState, useEffect, Suspense } from 'react';
import { createClient } from '@/lib/supabase/client';
import { useRouter, useSearchParams } from 'next/navigation';
import Image from 'next/image';

function ResetForm() {
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);
  const [loading, setLoading] = useState(false);
  const [validSession, setValidSession] = useState(false);
  const [checking, setChecking] = useState(true);
  const router = useRouter();
  const searchParams = useSearchParams();

  useEffect(() => {
    async function checkSession() {
      const supabase = createClient();
      const { data: { session } } = await supabase.auth.getSession();
      setValidSession(!!session);
      setChecking(false);
    }
    checkSession();
  }, []);

  async function handleReset(e) {
    e.preventDefault();
    setError('');

    if (password !== confirm) {
      setError('Passwords do not match.');
      return;
    }

    if (password.length < 8) {
      setError('Password must be at least 8 characters.');
      return;
    }

    setLoading(true);

    const supabase = createClient();
    const { error } = await supabase.auth.updateUser({ password });

    if (error) {
      setError(error.message);
      setLoading(false);
      return;
    }

    setSuccess(true);
    setLoading(false);

    setTimeout(() => router.push('/login'), 3000);
  }

  if (checking) {
    return (
      <div style={{ textAlign: 'center', color: 'var(--text-muted)', padding: '1rem' }}>
        Verifying your reset link...
      </div>
    );
  }

  if (!validSession) {
    return (
      <div style={{ textAlign: 'center', padding: '1rem 0' }}>
        <p style={{
          fontFamily: 'var(--font-body)',
          color: 'var(--text-muted)',
          marginBottom: '1.25rem',
          lineHeight: 1.6,
        }}>
          This reset link is invalid or has expired. Please request a new one.
        </p>
        <a href="/forgot-password" className="tyt-btn tyt-btn-primary">
          Request New Link
        </a>
      </div>
    );
  }

  if (success) {
    return (
      <div style={{ textAlign: 'center', padding: '1rem 0' }}>
        <div style={{ fontSize: '3rem', marginBottom: '1rem' }}>✓</div>
        <h2 style={{
          fontFamily: 'var(--font-display)',
          fontSize: '1.6rem',
          fontWeight: 700,
          letterSpacing: '0.05em',
          textTransform: 'uppercase',
          color: 'var(--gold)',
          marginBottom: '0.75rem',
        }}>
          Password Updated
        </h2>
        <p style={{
          fontFamily: 'var(--font-accent)',
          fontStyle: 'italic',
          color: 'var(--text-muted)',
          fontSize: '0.95rem',
        }}>
          Redirecting you to sign in...
        </p>
      </div>
    );
  }

  return (
    <form onSubmit={handleReset}>
      {error && <div className="tyt-error">{error}</div>}

      <div style={{ marginBottom: '1.25rem' }}>
        <label className="tyt-label">New Password</label>
        <input
          type="password"
          value={password}
          onChange={e => setPassword(e.target.value)}
          required
          placeholder="At least 8 characters"
          className="tyt-input"
        />
      </div>

      <div style={{ marginBottom: '1.75rem' }}>
        <label className="tyt-label">Confirm New Password</label>
        <input
          type="password"
          value={confirm}
          onChange={e => setConfirm(e.target.value)}
          required
          placeholder="••••••••"
          className="tyt-input"
        />
      </div>

      <button
        type="submit"
        disabled={loading}
        className="tyt-btn tyt-btn-primary tyt-btn-full"
      >
        {loading ? 'Updating...' : 'Update Password'}
      </button>
    </form>
  );
}

export default function ResetPasswordPage() {
  return (
    <main style={{
      minHeight: '100vh',
      background: 'var(--bg-dark)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      padding: '1.5rem',
    }}>
      <div style={{ width: '100%', maxWidth: '440px' }}>

        {/* Logo */}
        <div style={{ textAlign: 'center', marginBottom: '2rem' }}>
          <Image
            src="/images/tyt-logo.png"
            alt="Triboro Youth Theatre"
            width={180}
            height={180}
            style={{ objectFit: 'contain' }}
            priority
          />
          <h1 style={{
            fontFamily: 'var(--font-display)',
            fontSize: '2.2rem',
            fontWeight: 800,
            letterSpacing: '0.08em',
            textTransform: 'uppercase',
            color: 'var(--text-primary)',
            marginTop: '0.5rem',
            marginBottom: '0.25rem',
          }}>
            New Password
          </h1>
          <p style={{
            fontFamily: 'var(--font-accent)',
            fontStyle: 'italic',
            color: 'var(--text-muted)',
            fontSize: '1rem',
          }}>
            Choose a strong password for your account
          </p>
        </div>

        {/* Card */}
        <div className="tyt-card">
          <Suspense fallback={
            <div style={{ textAlign: 'center', color: 'var(--text-muted)', padding: '1rem' }}>
              Loading...
            </div>
          }>
            <ResetForm />
          </Suspense>
        </div>

        {/* Footer */}
        <p style={{
          textAlign: 'center',
          color: 'var(--text-faint)',
          fontSize: '0.75rem',
          marginTop: '2rem',
          fontFamily: 'var(--font-body)',
        }}>
          &copy; {new Date().getFullYear()} Triboro Youth Theatre
        </p>

      </div>
    </main>
  );
}