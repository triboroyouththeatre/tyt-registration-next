'use client';

import { useEffect, useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import { useRouter } from 'next/navigation';
import Image from 'next/image';

export default function ConfirmPage() {
  const [status, setStatus] = useState('verifying');
  const [debugInfo, setDebugInfo] = useState('');
  const router = useRouter();

  useEffect(() => {
    async function handleConfirmation() {
      const supabase = createClient();
      const params = new URLSearchParams(window.location.search);
      const code = params.get('code');
      const tokenHash = params.get('token_hash');
      const type = params.get('type');
      const errorParam = params.get('error');
      const errorDescription = params.get('error_description');

      const debug = {
        fullUrl: window.location.href,
        search: window.location.search,
        hash: window.location.hash,
        code: code ? code.substring(0, 12) + '...' : null,
        tokenHash: tokenHash ? tokenHash.substring(0, 12) + '...' : null,
        type,
        errorParam,
        errorDescription,
      };
      setDebugInfo(JSON.stringify(debug, null, 2));

      if (errorParam) {
        setStatus('error');
        return;
      }

      if (code) {
        const { data, error } = await supabase.auth.exchangeCodeForSession(code);
        if (error) {
          setDebugInfo(prev => prev + '\n\nExchange error: ' + JSON.stringify(error, null, 2));
          setStatus('error');
          return;
        }
        setDebugInfo(prev => prev + '\n\nExchange success: ' + JSON.stringify({ user: data?.user?.email }, null, 2));
        setStatus('success');
        await supabase.auth.signOut();
        setTimeout(() => router.push('/login'), 3000);
        return;
      }

      if (tokenHash && type) {
        const { error } = await supabase.auth.verifyOtp({ token_hash: tokenHash, type });
        if (error) {
          setDebugInfo(prev => prev + '\n\nVerifyOtp error: ' + JSON.stringify(error, null, 2));
          setStatus('error');
          return;
        }
        setStatus('success');
        await supabase.auth.signOut();
        setTimeout(() => router.push('/login'), 3000);
        return;
      }

      setDebugInfo(prev => prev + '\n\nNo code or token_hash found in URL');
      setStatus('error');
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
      <div style={{ width: '100%', maxWidth: '560px', textAlign: 'center' }}>

        <Image
          src="/images/tyt-logo.png"
          alt="Triboro Youth Theatre"
          width={140}
          height={140}
          style={{ objectFit: 'contain', marginBottom: '1.5rem' }}
          priority
        />

        {status === 'verifying' && (
          <>
            <h1 style={{ fontFamily: 'var(--font-display)', fontSize: '1.8rem', fontWeight: 800, letterSpacing: '0.08em', textTransform: 'uppercase', color: 'var(--text-primary)', marginBottom: '0.5rem' }}>
              Verifying...
            </h1>
            <p style={{ fontFamily: 'var(--font-accent)', fontStyle: 'italic', color: 'var(--text-muted)' }}>
              Please wait while we confirm your email address.
            </p>
          </>
        )}

        {status === 'success' && (
          <>
            <div style={{ fontSize: '3rem', marginBottom: '1rem' }}>✓</div>
            <h1 style={{ fontFamily: 'var(--font-display)', fontSize: '1.8rem', fontWeight: 800, letterSpacing: '0.08em', textTransform: 'uppercase', color: 'var(--gold)', marginBottom: '0.5rem' }}>
              Email Confirmed!
            </h1>
            <p style={{ fontFamily: 'var(--font-accent)', fontStyle: 'italic', color: 'var(--text-muted)', marginBottom: '1.5rem' }}>
              Your account is ready. Redirecting you to sign in...
            </p>
          </>
        )}

        {status === 'error' && (
          <>
            <div style={{ fontSize: '3rem', marginBottom: '1rem' }}>✗</div>
            <h1 style={{ fontFamily: 'var(--font-display)', fontSize: '1.8rem', fontWeight: 800, letterSpacing: '0.08em', textTransform: 'uppercase', color: 'var(--red)', marginBottom: '0.5rem' }}>
              Link Expired
            </h1>
            <div style={{ display: 'flex', gap: '1rem', justifyContent: 'center', flexWrap: 'wrap', marginBottom: '1.5rem' }}>
              <a href="/signup" className="tyt-btn tyt-btn-primary">Sign Up Again</a>
              <a href="/login" className="tyt-btn tyt-btn-secondary">Back to Login</a>
            </div>
          </>
        )}

        {debugInfo && (
          <div style={{
            background: '#0a0a0a',
            border: '1px solid var(--border)',
            borderRadius: 'var(--radius-sm)',
            padding: '1rem',
            marginTop: '1.5rem',
            textAlign: 'left',
          }}>
            <p style={{ fontFamily: 'var(--font-display)', fontSize: '0.7rem', letterSpacing: '0.1em', textTransform: 'uppercase', color: 'var(--gold)', marginBottom: '0.5rem' }}>
              Debug Info
            </p>
            <pre style={{ fontFamily: 'monospace', fontSize: '0.72rem', color: 'var(--text-muted)', whiteSpace: 'pre-wrap', wordBreak: 'break-all' }}>
              {debugInfo}
            </pre>
          </div>
        )}

        <p style={{ textAlign: 'center', color: 'var(--text-faint)', fontSize: '0.75rem', marginTop: '2rem', fontFamily: 'var(--font-body)' }}>
          &copy; {new Date().getFullYear()} Triboro Youth Theatre
        </p>

      </div>
    </main>
  );
}