'use client';

import { useEffect, useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import { useRouter } from 'next/navigation';
import Image from 'next/image';

export default function ConfirmPage() {
  const [status, setStatus] = useState('verifying');
  const router = useRouter();

  useEffect(() => {
    async function handleConfirmation() {
      const supabase = createClient();

      // Supabase sends confirmation tokens in the URL hash as:
      // #access_token=...&type=signup  (older flow)
      // or as ?token_hash=...&type=email  (newer PKCE flow)
      const hash = window.location.hash;
      const params = new URLSearchParams(window.location.search);
      const hashParams = new URLSearchParams(hash.replace('#', ''));

      const tokenHash = params.get('token_hash');
      const type = params.get('type') || hashParams.get('type');
      const accessToken = hashParams.get('access_token');
      const refreshToken = hashParams.get('refresh_token');

      let error = null;

      if (tokenHash && type) {
        // PKCE flow — newer Supabase
        const result = await supabase.auth.verifyOtp({
          token_hash: tokenHash,
          type: type,
        });
        error = result.error;
      } else if (accessToken) {
        // Hash-based flow — older Supabase / magic link
        const result = await supabase.auth.setSession({
          access_token: accessToken,
          refresh_token: refreshToken || '',
        });
        error = result.error;
      } else {
        // No recognizable token — likely already verified or bad link
        error = { message: 'No token found' };
      }

      if (error) {
        setStatus('error');
        return;
      }

      setStatus('success');

      // Sign out so they land on login fresh
      await supabase.auth.signOut();
      setTimeout(() => router.push('/login'), 2500);
    }

    handleConfirmation();
  }, [router]);

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

        {status === 'verifying' && (
          <>
            <h1 style={{
              fontFamily: 'var(--font-display)',
              fontSize: '1.8rem',
              fontWeight: 800,
              letterSpacing: '0.08em',
              textTransform: 'uppercase',
              color: 'var(--text-primary)',
              marginBottom: '0.5rem',
            }}>
              Verifying...
            </h1>
            <p style={{
              fontFamily: 'var(--font-accent)',
              fontStyle: 'italic',
              color: 'var(--text-muted)',
            }}>
              Please wait while we confirm your email address.
            </p>
          </>
        )}

        {status === 'success' && (
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
              marginBottom: '1.5rem',
            }}>
              Your account is ready. Redirecting you to sign in...
            </p>
            <a href="/login" style={{
              fontFamily: 'var(--font-display)',
              fontSize: '0.8rem',
              fontWeight: 600,
              letterSpacing: '0.1em',
              textTransform: 'uppercase',
              color: 'var(--gold)',
              textDecoration: 'none',
            }}>
              Sign in now →
            </a>
          </>
        )}

        {status === 'error' && (
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
              This confirmation link is invalid or has expired.
              Please sign up again or request a new link.
            </p>
            <div style={{ display: 'flex', gap: '1rem', justifyContent: 'center', flexWrap: 'wrap' }}>
              <a href="/signup" className="tyt-btn tyt-btn-primary">
                Sign Up Again
              </a>
              <a href="/login" className="tyt-btn tyt-btn-secondary">
                Back to Login
              </a>
            </div>
          </>
        )}

        <p style={{
          textAlign: 'center',
          color: 'var(--text-faint)',
          fontSize: '0.75rem',
          marginTop: '2.5rem',
          fontFamily: 'var(--font-body)',
        }}>
          &copy; {new Date().getFullYear()} Triboro Youth Theatre
        </p>

      </div>
    </main>
  );
}