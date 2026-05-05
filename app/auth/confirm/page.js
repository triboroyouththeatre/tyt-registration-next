'use client';

import { useState, useEffect, Suspense } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import Image from 'next/image';
import { createClient } from '@/lib/supabase/client';

// Separated into a child component so Suspense can wrap useSearchParams
function ConfirmForm() {
  const searchParams = useSearchParams();
  const router = useRouter();

  const tokenHash = searchParams.get('token_hash');
  const type      = searchParams.get('type') || 'email';

  const [status, setStatus] = useState('idle'); // idle | confirming | success | error
  const [errorMsg, setErrorMsg] = useState('');

  // If the URL has no token_hash at all, bail out immediately
  useEffect(() => {
    if (!tokenHash) {
      setStatus('error');
      setErrorMsg('This confirmation link is missing required parameters.');
    }
  }, [tokenHash]);

  async function handleConfirm() {
    setStatus('confirming');
    setErrorMsg('');

    const supabase = createClient();
    const { error } = await supabase.auth.verifyOtp({
      token_hash: tokenHash,
      type,
    });

    if (error) {
      setStatus('error');
      setErrorMsg(
        error.message?.toLowerCase().includes('expired') || error.message?.toLowerCase().includes('invalid')
          ? 'This confirmation link has already been used or has expired. Please sign up again.'
          : error.message || 'Something went wrong. Please try again.'
      );
    } else {
      setStatus('success');
      // Give the browser a moment to settle the session, then redirect
      setTimeout(() => router.replace('/confirm/success'), 800);
    }
  }

  if (status === 'success') {
    return (
      <>
        <div style={{ fontSize: '3rem', marginBottom: '1rem' }}>✓</div>
        <h1 style={{
          fontFamily: 'var(--font-display)',
          fontSize: '1.8rem',
          fontWeight: 800,
          letterSpacing: '0.08em',
          textTransform: 'uppercase',
          color: 'var(--gold)',
          marginBottom: '0.5rem',
        }}>
          Email Confirmed!
        </h1>
        <p style={{
          fontFamily: 'var(--font-accent)',
          fontStyle: 'italic',
          color: 'var(--text-muted)',
        }}>
          Redirecting you to sign in…
        </p>
      </>
    );
  }

  if (status === 'error') {
    return (
      <>
        <div style={{ fontSize: '3rem', marginBottom: '1rem' }}>✗</div>
        <h1 style={{
          fontFamily: 'var(--font-display)',
          fontSize: '1.8rem',
          fontWeight: 800,
          letterSpacing: '0.08em',
          textTransform: 'uppercase',
          color: 'var(--red)',
          marginBottom: '0.5rem',
        }}>
          Link Expired
        </h1>
        <p style={{
          fontFamily: 'var(--font-accent)',
          fontStyle: 'italic',
          color: 'var(--text-muted)',
          marginBottom: '1.5rem',
        }}>
          {errorMsg}
        </p>
        <div style={{ display: 'flex', gap: '1rem', justifyContent: 'center', flexWrap: 'wrap' }}>
          <a href="/signup" className="tyt-btn tyt-btn-primary">Sign Up Again</a>
          <a href="/login" className="tyt-btn tyt-btn-secondary">Back to Login</a>
        </div>
      </>
    );
  }

  // idle or confirming — show the confirmation button
  return (
    <>
      <div style={{ fontSize: '3rem', marginBottom: '1rem' }}>✉️</div>
      <h1 style={{
        fontFamily: 'var(--font-display)',
        fontSize: '1.8rem',
        fontWeight: 800,
        letterSpacing: '0.08em',
        textTransform: 'uppercase',
        color: 'var(--text-primary)',
        marginBottom: '0.5rem',
      }}>
        Confirm Your Email
      </h1>
      <p style={{
        fontFamily: 'var(--font-accent)',
        fontStyle: 'italic',
        color: 'var(--text-muted)',
        marginBottom: '1.75rem',
        lineHeight: 1.7,
      }}>
        Click the button below to activate your TYT Family Portal account.
      </p>
      <button
        onClick={handleConfirm}
        disabled={status === 'confirming'}
        className="tyt-btn tyt-btn-primary"
        style={{ display: 'inline-flex', minWidth: '200px', justifyContent: 'center' }}
      >
        {status === 'confirming' ? 'Confirming…' : 'Confirm Email Address'}
      </button>
    </>
  );
}

export default function AuthConfirmPage() {
  return (
    <main style={{
      minHeight: '100vh',
      background: 'var(--bg-dark)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      padding: '1.5rem',
    }}>
      <div style={{ width: '100%', maxWidth: '440px', textAlign: 'center' }}>
        <Image
          src="/images/tyt-logo.png"
          alt="Triboro Youth Theatre"
          width={160}
          height={160}
          style={{ objectFit: 'contain', marginBottom: '1.5rem' }}
          priority
        />

        <Suspense fallback={
          <p style={{ color: 'var(--text-muted)', fontFamily: 'var(--font-body)' }}>
            Loading…
          </p>
        }>
          <ConfirmForm />
        </Suspense>

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
