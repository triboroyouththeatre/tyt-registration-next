'use client';

import { useState, Suspense } from 'react';
import { createClient } from '@/lib/supabase/client';
import { useRouter, useSearchParams } from 'next/navigation';

function LoginForm() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const router = useRouter();
  const searchParams = useSearchParams();
  const redirectTo = searchParams.get('redirectTo') || '/dashboard';

  async function handleLogin(e) {
    e.preventDefault();
    setLoading(true);
    setError('');

    const supabase = createClient();
    const { error } = await supabase.auth.signInWithPassword({ email, password });

    if (error) {
      setError(error.message);
      setLoading(false);
      return;
    }

    router.push(redirectTo);
    router.refresh();
  }

  return (
    <form onSubmit={handleLogin}>

      {error && (
        <div style={{
          background: '#2d1a1a',
          border: '1px solid #c0392b',
          borderRadius: '3px',
          padding: '0.75rem 1rem',
          marginBottom: '1.5rem',
          color: '#e74c3c',
          fontSize: '0.875rem',
          fontFamily: 'Georgia, serif',
        }}>
          {error}
        </div>
      )}

      <div style={{ marginBottom: '1.25rem' }}>
        <label style={{
          display: 'block',
          color: '#8a9ab0',
          fontSize: '0.75rem',
          letterSpacing: '0.15em',
          textTransform: 'uppercase',
          marginBottom: '0.5rem',
          fontFamily: 'Georgia, serif',
        }}>
          Email Address
        </label>
        <input
          type="email"
          value={email}
          onChange={e => setEmail(e.target.value)}
          required
          placeholder="you@example.com"
          style={{
            width: '100%',
            background: '#0f1923',
            border: '1px solid #2a3a50',
            borderRadius: '3px',
            padding: '0.75rem 1rem',
            color: '#ffffff',
            fontSize: '0.95rem',
            fontFamily: 'Georgia, serif',
            outline: 'none',
            boxSizing: 'border-box',
            transition: 'border-color 0.2s',
          }}
          onFocus={e => e.target.style.borderColor = '#c9a84c'}
          onBlur={e => e.target.style.borderColor = '#2a3a50'}
        />
      </div>

      <div style={{ marginBottom: '1.75rem' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem' }}>
          <label style={{
            color: '#8a9ab0',
            fontSize: '0.75rem',
            letterSpacing: '0.15em',
            textTransform: 'uppercase',
            fontFamily: 'Georgia, serif',
          }}>
            Password
          </label>
          <a href="/forgot-password" style={{
            color: '#c9a84c',
            fontSize: '0.8rem',
            textDecoration: 'none',
            fontFamily: 'Georgia, serif',
            fontStyle: 'italic',
          }}>
            Forgot password?
          </a>
        </div>
        <input
          type="password"
          value={password}
          onChange={e => setPassword(e.target.value)}
          required
          placeholder="••••••••"
          style={{
            width: '100%',
            background: '#0f1923',
            border: '1px solid #2a3a50',
            borderRadius: '3px',
            padding: '0.75rem 1rem',
            color: '#ffffff',
            fontSize: '0.95rem',
            fontFamily: 'Georgia, serif',
            outline: 'none',
            boxSizing: 'border-box',
            transition: 'border-color 0.2s',
          }}
          onFocus={e => e.target.style.borderColor = '#c9a84c'}
          onBlur={e => e.target.style.borderColor = '#2a3a50'}
        />
      </div>

      <button
        type="submit"
        disabled={loading}
        style={{
          width: '100%',
          background: loading ? '#8a7030' : '#c9a84c',
          border: 'none',
          borderRadius: '3px',
          padding: '0.85rem',
          color: '#0f1923',
          fontSize: '0.85rem',
          fontWeight: 'bold',
          letterSpacing: '0.15em',
          textTransform: 'uppercase',
          fontFamily: 'Georgia, serif',
          cursor: loading ? 'not-allowed' : 'pointer',
          transition: 'background 0.2s',
        }}
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
      background: '#0f1923',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      fontFamily: "'Georgia', serif",
      padding: '1rem',
    }}>
      <div style={{
        width: '100%',
        maxWidth: '420px',
      }}>

        <div style={{ textAlign: 'center', marginBottom: '2.5rem' }}>
          <div style={{
            display: 'inline-block',
            border: '2px solid #c9a84c',
            padding: '0.4rem 1.2rem',
            marginBottom: '1rem',
          }}>
            <span style={{
              color: '#c9a84c',
              fontSize: '0.7rem',
              letterSpacing: '0.3em',
              textTransform: 'uppercase',
              fontFamily: "'Georgia', serif",
            }}>
              Triboro Youth Theatre
            </span>
          </div>
          <h1 style={{
            color: '#ffffff',
            fontSize: '1.8rem',
            fontWeight: 'normal',
            margin: '0 0 0.4rem',
            letterSpacing: '0.02em',
          }}>
            Family Portal
          </h1>
          <p style={{
            color: '#8a9ab0',
            fontSize: '0.9rem',
            margin: 0,
            fontFamily: "'Georgia', serif",
            fontStyle: 'italic',
          }}>
            Sign in to manage your registrations
          </p>
        </div>

        <div style={{
          background: '#1a2535',
          border: '1px solid #2a3a50',
          borderRadius: '4px',
          padding: '2rem',
        }}>
          <Suspense fallback={
            <div style={{ color: '#8a9ab0', textAlign: 'center', fontFamily: 'Georgia, serif' }}>
              Loading...
            </div>
          }>
            <LoginForm />
          </Suspense>
        </div>

        <p style={{
          textAlign: 'center',
          color: '#8a9ab0',
          fontSize: '0.875rem',
          marginTop: '1.5rem',
          fontFamily: 'Georgia, serif',
        }}>
          New to TYT?{' '}
          <a href="/signup" style={{
            color: '#c9a84c',
            textDecoration: 'none',
            fontStyle: 'italic',
          }}>
            Create an account
          </a>
        </p>

        <p style={{
          textAlign: 'center',
          color: '#4a5a6a',
          fontSize: '0.75rem',
          marginTop: '2rem',
          fontFamily: 'Georgia, serif',
          fontStyle: 'italic',
        }}>
          &copy; {new Date().getFullYear()} Triboro Youth Theatre
        </p>

      </div>
    </main>
  );
}