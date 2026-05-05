'use client';

import { useState, Suspense } from 'react';
import Image from 'next/image';
import Link from 'next/link';

function SignupForm() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [error, setError] = useState('');
  const [errorCode, setErrorCode] = useState('');
  const [success, setSuccess] = useState(false);
  const [loading, setLoading] = useState(false);

  async function handleSignup(e) {
    e.preventDefault();
    setError('');
    setErrorCode('');

    if (password !== confirm) {
      setError('Passwords do not match.');
      return;
    }

    if (password.length < 8) {
      setError('Password must be at least 8 characters.');
      return;
    }

    setLoading(true);

    const res = await fetch('/api/auth/signup', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password }),
    });

    const data = await res.json();

    if (!res.ok) {
      setError(data.error || 'Something went wrong. Please try again.');
      setErrorCode(data.code || '');
      setLoading(false);
      return;
    }

    // Redirect straight to login — no email confirmation step
    window.location.href = '/login';
  }

  return (
    <form onSubmit={handleSignup}>
      {error && (
        errorCode === 'already_registered' ? (
          <div className="tyt-error" style={{ textAlign: 'left' }}>
            <strong style={{ display: 'block', marginBottom: '0.4rem' }}>
              {error}
            </strong>
            <span style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>
              Please{' '}
              <a href="/login" style={{ color: 'var(--gold)', textDecoration: 'underline' }}>
                sign in
              </a>
              {' '}to your existing account.
            </span>
          </div>
        ) : (
          <div className="tyt-error">{error}</div>
        )
      )}

      <div style={{ marginBottom: '1.25rem' }}>
        <label className="tyt-label">Email Address</label>
        <input
          type="email"
          value={email}
          onChange={e => setEmail(e.target.value)}
          required
          placeholder="you@example.com"
          className="tyt-input"
        />
      </div>

      <div style={{ marginBottom: '1.25rem' }}>
        <label className="tyt-label">Password</label>
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
        <label className="tyt-label">Confirm Password</label>
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
        {loading ? 'Creating account...' : 'Create Account'}
      </button>

      <p style={{
        fontFamily: 'var(--font-body)',
        fontSize: '0.78rem',
        color: 'var(--text-faint)',
        textAlign: 'center',
        marginTop: '1.25rem',
        lineHeight: 1.6,
      }}>
        By creating an account you agree to our{' '}
        <Link href="/terms" style={{ color: 'var(--gold)' }}>Terms of Service</Link>
        {' '}and{' '}
        <Link href="/privacy" style={{ color: 'var(--gold)' }}>Privacy Policy</Link>.
      </p>
    </form>
  );
}

export default function SignupPage() {
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
            width={100}
            height={100}
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
            Create Account
          </h1>
          <p style={{
            fontFamily: 'var(--font-accent)',
            fontStyle: 'italic',
            color: 'var(--text-muted)',
            fontSize: '1rem',
          }}>
            Join the TYT Family Portal
          </p>
        </div>

        {/* Card */}
        <div className="tyt-card">
          <Suspense fallback={
            <div style={{ textAlign: 'center', color: 'var(--text-muted)', padding: '1rem' }}>
              Loading...
            </div>
          }>
            <SignupForm />
          </Suspense>
        </div>

        {/* Sign in link */}
        <p style={{
          textAlign: 'center',
          color: 'var(--text-muted)',
          fontSize: '0.9rem',
          marginTop: '1.5rem',
          fontFamily: 'var(--font-body)',
        }}>
          Already have an account?{' '}
          <a href="/login" style={{
            fontFamily: 'var(--font-accent)',
            fontStyle: 'italic',
            color: 'var(--gold)',
          }}>
            Sign in
          </a>
        </p>

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