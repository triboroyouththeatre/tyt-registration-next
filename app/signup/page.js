'use client';

import { useState, Suspense } from 'react';
import Image from 'next/image';

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
      body: JSON.stringify({
        email,
        password,
        emailRedirectTo: `${window.location.origin}/auth/callback`,
      }),
    });

    const data = await res.json();

    if (!res.ok) {
      setError(data.error || 'Something went wrong. Please try again.');
      setErrorCode(data.code || '');
      setLoading(false);
      return;
    }

    setSuccess(true);
    setLoading(false);
  }

  if (success) {
    return (
      <div style={{ textAlign: 'center', padding: '1rem 0' }}>
        <div style={{
          fontSize: '3rem',
          marginBottom: '1rem',
        }}>
          ✉️
        </div>
        <h2 style={{
          fontFamily: 'var(--font-display)',
          fontSize: '1.6rem',
          fontWeight: 700,
          letterSpacing: '0.05em',
          textTransform: 'uppercase',
          marginBottom: '0.75rem',
        }}>
          Check Your Email
        </h2>
        <p style={{
          fontFamily: 'var(--font-accent)',
          fontStyle: 'italic',
          color: 'var(--text-muted)',
          fontSize: '0.95rem',
          lineHeight: 1.7,
          marginBottom: '1.5rem',
        }}>
          We sent a confirmation link to <strong style={{ color: 'var(--gold)' }}>{email}</strong>.
          Please click the link to activate your account before signing in.
        </p>
        <p style={{
          fontFamily: 'var(--font-body)',
          color: 'var(--text-faint)',
          fontSize: '0.8rem',
        }}>
          Didn&apos;t receive it? Check your spam folder or{' '}
          <button
            onClick={() => setSuccess(false)}
            style={{
              background: 'none',
              border: 'none',
              color: 'var(--gold)',
              cursor: 'pointer',
              fontFamily: 'var(--font-body)',
              fontSize: '0.8rem',
              padding: 0,
              textDecoration: 'underline',
            }}
          >
            try again
          </button>.
        </p>
      </div>
    );
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
        <a href="/terms" style={{ color: 'var(--gold)' }}>Terms of Service</a>
        {' '}and{' '}
        <a href="/privacy" style={{ color: 'var(--gold)' }}>Privacy Policy</a>.
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
            Create Account
          </h1>
          <p style={{
            fontFamily: 'var(--font-accent)',
            fontStyle: 'italic',
            color: 'var(--text-muted)',
            fontSize: '1rem',
          }}>
            Join the Triboro Youth Theatre family
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