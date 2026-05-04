'use client';

import { useState, Suspense } from 'react';
import { createClient } from '@/lib/supabase/client';
import { useSearchParams } from 'next/navigation';
import Image from 'next/image';

function LoginForm() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const searchParams = useSearchParams();
  const redirectTo = searchParams.get('redirectTo') || '/dashboard';

  async function handleLogin(e) {
    e.preventDefault();
    setLoading(true);
    setError('');

    const res = await fetch('/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password }),
    });

    const data = await res.json();

    if (!res.ok) {
      setError(data.error || 'Invalid email or password.');
      setLoading(false);
      return;
    }

    const supabase = createClient();
    await supabase.auth.setSession({
      access_token: data.accessToken,
      refresh_token: data.refreshToken,
    });

    if (!data.onboardingComplete) {
      window.location.href = '/onboarding';
    } else {
      window.location.href = redirectTo;
    }
  }

  return (
    <form onSubmit={handleLogin}>
      {error && <div className="tyt-error">{error}</div>}

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

      <div style={{ marginBottom: '0.5rem' }}>
        <label className="tyt-label">Password</label>
        <input
          type="password"
          value={password}
          onChange={e => setPassword(e.target.value)}
          required
          placeholder="••••••••"
          className="tyt-input"
        />
      </div>

      {/* Forgot password moved below the field */}
      <div style={{ textAlign: 'right', marginBottom: '1.75rem' }}>
        <a href="/forgot-password" style={{
          fontFamily: 'var(--font-accent)',
          fontStyle: 'italic',
          fontSize: '0.85rem',
          color: 'var(--gold)',
          textDecoration: 'none',
        }}>
          Forgot password?
        </a>
      </div>

      <button
        type="submit"
        disabled={loading}
        className="tyt-btn tyt-btn-primary tyt-btn-full"
      >
        {loading ? 'Signing in...' : 'Sign In'}
      </button>
    </form>
  );
}

export default function LoginPage() {
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

        <div style={{ textAlign: 'center', marginBottom: '2rem' }}>
          <Image
            src="/images/tyt-logo.png"
            alt="Triboro Youth Theatre"
            width={200}
            height={200}
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
            Family Portal
          </h1>
          <p style={{
            fontFamily: 'var(--font-accent)',
            fontStyle: 'italic',
            color: 'var(--text-muted)',
            fontSize: '1rem',
          }}>
            Sign in to manage your registrations
          </p>
        </div>

        {/* Prominent signup CTA — first-time families must create an account */}
        <div style={{
          background: 'rgba(224, 191, 92, 0.08)',
          border: '1px solid var(--gold)',
          borderRadius: 'var(--radius-md)',
          padding: '1.25rem 1.5rem',
          marginBottom: '1.5rem',
          textAlign: 'center',
        }}>
          <p style={{
            fontFamily: 'var(--font-display)',
            fontSize: '1rem',
            fontWeight: 700,
            letterSpacing: '0.1em',
            textTransform: 'uppercase',
            color: 'var(--text-primary)',
            marginBottom: '0.85rem',
          }}>
            New to TYT?
          </p>
          <a href="/signup" className="tyt-btn tyt-btn-gold tyt-btn-full" style={{
            fontSize: '1rem',
          }}>
            Create an Account
          </a>
          <p style={{
            fontFamily: 'var(--font-accent)',
            fontStyle: 'italic',
            fontSize: '0.85rem',
            color: 'var(--text-muted)',
            marginTop: '0.85rem',
          }}>
            First-time families: please sign up before signing in.
          </p>
        </div>

        <div className="tyt-card">
          <Suspense fallback={
            <div style={{ textAlign: 'center', color: 'var(--text-muted)', padding: '1rem' }}>
              Loading...
            </div>
          }>
            <LoginForm />
          </Suspense>
        </div>

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