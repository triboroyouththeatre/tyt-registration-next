'use client';

import { useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import Image from 'next/image';

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState('');
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e) {
    e.preventDefault();
    setError('');
    setLoading(true);

    const supabase = createClient();
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/reset-password`,
    });

    if (error) {
      setError(error.message);
      setLoading(false);
      return;
    }

    setSuccess(true);
    setLoading(false);
  }

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
            Reset Password
          </h1>
          <p style={{
            fontFamily: 'var(--font-accent)',
            fontStyle: 'italic',
            color: 'var(--text-muted)',
            fontSize: '1rem',
          }}>
            We&apos;ll send you a reset link
          </p>
        </div>

        {/* Card */}
        <div className="tyt-card">
          {success ? (
            <div style={{ textAlign: 'center', padding: '1rem 0' }}>
              <div style={{ fontSize: '3rem', marginBottom: '1rem' }}>✉️</div>
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
              }}>
                If an account exists for <strong style={{ color: 'var(--gold)' }}>{email}</strong>,
                you will receive a password reset link shortly.
              </p>
            </div>
          ) : (
            <form onSubmit={handleSubmit}>
              {error && <div className="tyt-error">{error}</div>}

              <p style={{
                fontFamily: 'var(--font-body)',
                color: 'var(--text-muted)',
                fontSize: '0.9rem',
                marginBottom: '1.5rem',
                lineHeight: 1.6,
              }}>
                Enter the email address associated with your account and we&apos;ll
                send you a link to reset your password.
              </p>

              <div style={{ marginBottom: '1.75rem' }}>
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

              <button
                type="submit"
                disabled={loading}
                className="tyt-btn tyt-btn-primary tyt-btn-full"
              >
                {loading ? 'Sending...' : 'Send Reset Link'}
              </button>
            </form>
          )}
        </div>

        {/* Back to login */}
        <p style={{
          textAlign: 'center',
          color: 'var(--text-muted)',
          fontSize: '0.9rem',
          marginTop: '1.5rem',
          fontFamily: 'var(--font-body)',
        }}>
          <a href="/login" style={{
            fontFamily: 'var(--font-accent)',
            fontStyle: 'italic',
            color: 'var(--gold)',
          }}>
            Back to sign in
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