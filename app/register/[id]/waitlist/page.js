'use client';

import { useState, useEffect } from 'react';
import { useRouter, useParams, useSearchParams } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import Image from 'next/image';

function fmt(amount) {
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(Number(amount) || 0);
}

export default function WaitlistJoinPage() {
  const params = useParams();
  const searchParams = useSearchParams();
  const router = useRouter();
  const programId = params?.id;
  const participantId = searchParams?.get('participant');

  const [loading, setLoading] = useState(true);
  const [program, setProgram] = useState(null);
  const [participant, setParticipant] = useState(null);
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [success, setSuccess] = useState(false);

  useEffect(() => {
    async function load() {
      if (!programId || !participantId) {
        setError('Missing program or participant.');
        setLoading(false);
        return;
      }

      const supabase = createClient();

      const { data: prog } = await supabase
        .from('programs')
        .select(`
          id, label, fee, deposit_amount, schedule, enrollment_limit,
          sessions(name, seasons(name, display_name))
        `)
        .eq('id', programId)
        .single();

      const { data: part } = await supabase
        .from('participants')
        .select('id, first_name, last_name, nickname, yog')
        .eq('id', participantId)
        .single();

      if (!prog) { setError('Program not found.'); setLoading(false); return; }
      if (!part) { setError('Participant not found.'); setLoading(false); return; }

      setProgram(prog);
      setParticipant(part);
      setLoading(false);
    }
    load();
  }, [programId, participantId]);

  async function handleSubmit() {
    setSubmitting(true);
    setError('');
    try {
      const res = await fetch('/api/join-waitlist', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ programId, participantId }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || 'Failed to join waitlist.');
        setSubmitting(false);
        return;
      }
      setSuccess(true);
      setSubmitting(false);
    } catch (err) {
      setError('Unexpected error. Please try again.');
      setSubmitting(false);
    }
  }

  const participantDisplayName = participant?.nickname
    ? `${participant.nickname} ${participant.last_name}`
    : `${participant?.first_name || ''} ${participant?.last_name || ''}`;

  const seasonDisplay = program?.sessions?.seasons?.display_name || program?.sessions?.seasons?.name;

  return (
    <div style={{ minHeight: '100vh', background: 'var(--bg-dark)' }}>
      <nav style={{ background: 'var(--bg-card)', borderBottom: '1px solid var(--border)', padding: '0 1.5rem', display: 'flex', alignItems: 'center', justifyContent: 'space-between', height: '64px', position: 'sticky', top: 0, zIndex: 100 }}>
        <a href="/dashboard" style={{ display: 'flex', alignItems: 'center', textDecoration: 'none' }}>
          <Image src="/images/tyt-logo.png" alt="Triboro Youth Theatre" width={48} height={48} style={{ objectFit: 'contain' }} />
        </a>
        <span style={{ fontFamily: 'var(--font-display)', fontSize: '1.1rem', fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase', color: 'var(--text-primary)' }}>Waitlist</span>
        <div style={{ width: '80px' }} />
      </nav>

      <main style={{ maxWidth: '600px', margin: '0 auto', padding: '2rem 1.5rem' }}>

        {loading && (
          <p style={{ fontFamily: 'var(--font-body)', color: 'var(--text-muted)', textAlign: 'center', padding: '3rem 0' }}>
            Loading...
          </p>
        )}

        {!loading && error && !success && (
          <>
            <div className="tyt-error" style={{ marginBottom: '1rem' }}>{error}</div>
            <a href="/register" className="tyt-btn tyt-btn-secondary" style={{ display: 'inline-flex' }}>← Back to Programs</a>
          </>
        )}

        {!loading && !success && program && participant && (
          <>
            <h1 style={{ fontFamily: 'var(--font-display)', fontSize: '1.75rem', fontWeight: 800, letterSpacing: '0.05em', textTransform: 'uppercase', color: 'var(--text-primary)', marginBottom: '0.25rem' }}>
              Join Waitlist
            </h1>
            <p style={{ fontFamily: 'var(--font-accent)', fontStyle: 'italic', color: 'var(--text-muted)', fontSize: '0.95rem', marginBottom: '2rem' }}>
              This program is currently full. Joining the waitlist means you&apos;ll be contacted if a spot opens up.
            </p>

            {/* Program summary card */}
            <div style={{
              background: 'var(--bg-card)',
              border: '1px solid var(--border)',
              borderRadius: 'var(--radius-md)',
              padding: '1.5rem',
              marginBottom: '1.5rem',
            }}>
              <p style={{ fontFamily: 'var(--font-display)', fontSize: '0.7rem', fontWeight: 600, letterSpacing: '0.1em', textTransform: 'uppercase', color: 'var(--text-faint)', marginBottom: '0.5rem' }}>
                Program
              </p>
              <h2 style={{ fontFamily: 'var(--font-display)', fontSize: '1.4rem', fontWeight: 800, letterSpacing: '0.04em', textTransform: 'uppercase', color: 'var(--text-primary)', marginBottom: '0.25rem' }}>
                {program.label}
              </h2>
              <p style={{ fontFamily: 'var(--font-body)', fontSize: '0.85rem', color: 'var(--text-muted)', marginBottom: '1rem' }}>
                {seasonDisplay} Season &middot; {program.sessions?.name} Session
              </p>

              <div style={{ borderTop: '1px solid var(--border)', paddingTop: '1rem', display: 'flex', gap: '2rem', flexWrap: 'wrap' }}>
                <div>
                  <p style={{ fontFamily: 'var(--font-display)', fontSize: '0.65rem', fontWeight: 600, letterSpacing: '0.1em', textTransform: 'uppercase', color: 'var(--text-faint)', marginBottom: '0.15rem' }}>Schedule</p>
                  <p style={{ fontFamily: 'var(--font-body)', fontSize: '0.875rem', color: 'var(--text-primary)' }}>{program.schedule || 'TBD'}</p>
                </div>
                <div>
                  <p style={{ fontFamily: 'var(--font-display)', fontSize: '0.65rem', fontWeight: 600, letterSpacing: '0.1em', textTransform: 'uppercase', color: 'var(--text-faint)', marginBottom: '0.15rem' }}>Registration Fee</p>
                  <p style={{ fontFamily: 'var(--font-body)', fontSize: '0.875rem', color: 'var(--text-primary)' }}>{fmt(program.fee)}</p>
                </div>
              </div>
            </div>

            {/* Participant card */}
            <div style={{
              background: 'var(--bg-card)',
              border: '1px solid var(--border)',
              borderRadius: 'var(--radius-md)',
              padding: '1.5rem',
              marginBottom: '1.5rem',
            }}>
              <p style={{ fontFamily: 'var(--font-display)', fontSize: '0.7rem', fontWeight: 600, letterSpacing: '0.1em', textTransform: 'uppercase', color: 'var(--text-faint)', marginBottom: '0.5rem' }}>
                Participant
              </p>
              <p style={{ fontFamily: 'var(--font-display)', fontSize: '1.2rem', fontWeight: 700, color: 'var(--text-primary)' }}>
                {participantDisplayName}
              </p>
              <p style={{ fontFamily: 'var(--font-body)', fontSize: '0.85rem', color: 'var(--text-muted)' }}>
                Class of {participant.yog}
              </p>
            </div>

            {/* What happens next */}
            <div style={{
              background: 'var(--bg-hover)',
              borderRadius: 'var(--radius-sm)',
              padding: '1rem 1.25rem',
              marginBottom: '1.5rem',
            }}>
              <p style={{ fontFamily: 'var(--font-display)', fontSize: '0.7rem', fontWeight: 600, letterSpacing: '0.1em', textTransform: 'uppercase', color: 'var(--text-faint)', marginBottom: '0.5rem' }}>
                What happens next
              </p>
              <ul style={{ fontFamily: 'var(--font-body)', fontSize: '0.85rem', color: 'var(--text-muted)', lineHeight: 1.6, paddingLeft: '1.25rem', margin: 0 }}>
                <li>You will receive a confirmation email shortly.</li>
                <li>If a spot opens, we will email you a special link to complete registration.</li>
                <li>No payment is required to join the waitlist.</li>
              </ul>
            </div>

            {error && <div className="tyt-error" style={{ marginBottom: '1rem' }}>{error}</div>}

            <div style={{ display: 'flex', gap: '0.75rem' }}>
              <button
                onClick={handleSubmit}
                disabled={submitting}
                className="tyt-btn tyt-btn-primary"
                style={{ flex: 1, opacity: submitting ? 0.7 : 1 }}
              >
                {submitting ? 'Joining...' : 'Join Waitlist'}
              </button>
              <button
                type="button"
                onClick={() => router.push('/register')}
                className="tyt-btn tyt-btn-secondary"
              >
                Cancel
              </button>
            </div>
          </>
        )}

        {success && (
          <div style={{ textAlign: 'center', padding: '2rem 0' }}>
            <div style={{
              fontSize: '3rem',
              color: 'var(--gold)',
              marginBottom: '1rem',
            }}>✓</div>
            <h1 style={{ fontFamily: 'var(--font-display)', fontSize: '1.75rem', fontWeight: 800, letterSpacing: '0.05em', textTransform: 'uppercase', color: 'var(--text-primary)', marginBottom: '0.5rem' }}>
              You&apos;re on the waitlist
            </h1>
            <p style={{ fontFamily: 'var(--font-accent)', fontStyle: 'italic', color: 'var(--text-muted)', fontSize: '0.95rem', marginBottom: '2rem' }}>
              We&apos;ve sent a confirmation email. We&apos;ll be in touch if a spot opens.
            </p>
            <a href="/dashboard" className="tyt-btn tyt-btn-primary">Back to Dashboard</a>
          </div>
        )}

      </main>
    </div>
  );
}