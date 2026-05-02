'use client';

import { useState } from 'react';

// Inherits shared style constants from settings page scope via props,
// but defines its own since it's a standalone component file.
const cardStyle = {
  background: '#fff',
  border: '1px solid #e5e7eb',
  borderRadius: '8px',
  padding: '1.25rem',
  marginBottom: '1rem',
};

const sectionTitle = {
  fontFamily: 'var(--font-display)',
  fontSize: '0.7rem',
  fontWeight: 700,
  letterSpacing: '0.12em',
  textTransform: 'uppercase',
  color: '#6b7280',
  margin: '0 0 1rem 0',
  paddingBottom: '0.5rem',
  borderBottom: '1px solid #e5e7eb',
};

const btnPrimary = {
  fontFamily: 'var(--font-display)',
  fontSize: '0.7rem',
  fontWeight: 700,
  letterSpacing: '0.08em',
  textTransform: 'uppercase',
  background: '#111',
  color: '#fff',
  border: 'none',
  borderRadius: '6px',
  padding: '0.5rem 1.25rem',
  cursor: 'pointer',
};

const btnSecondary = {
  fontFamily: 'var(--font-display)',
  fontSize: '0.7rem',
  fontWeight: 700,
  letterSpacing: '0.08em',
  textTransform: 'uppercase',
  background: '#fff',
  color: '#374151',
  border: '1px solid #d1d5db',
  borderRadius: '6px',
  padding: '0.5rem 1.25rem',
  cursor: 'pointer',
};

const btnDanger = {
  fontFamily: 'var(--font-display)',
  fontSize: '0.7rem',
  fontWeight: 700,
  letterSpacing: '0.08em',
  textTransform: 'uppercase',
  background: '#b40000',
  color: '#fff',
  border: 'none',
  borderRadius: '6px',
  padding: '0.5rem 1.25rem',
  cursor: 'pointer',
};

function fmtDate(str) {
  if (!str) return '—';
  return new Date(str + 'T00:00:00').toLocaleDateString('en-US', {
    month: 'long', day: 'numeric', year: 'numeric',
  });
}

export default function SeasonRolloverCard() {
  const [step, setStep] = useState('idle'); // idle | loading | confirm | executing | done | error
  const [preview, setPreview] = useState(null);
  const [result, setResult] = useState(null);
  const [errorMsg, setErrorMsg] = useState('');

  async function handleOpenModal() {
    setStep('loading');
    setErrorMsg('');
    try {
      const res = await fetch('/api/season-rollover', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'preview' }),
      });
      const data = await res.json();
      if (!res.ok) {
        setErrorMsg(data.error || 'Could not load rollover preview.');
        setStep('error');
        return;
      }
      setPreview(data);
      setStep('confirm');
    } catch (err) {
      setErrorMsg('Unexpected error loading preview.');
      setStep('error');
    }
  }

  async function handleExecute() {
    setStep('executing');
    setErrorMsg('');
    try {
      const res = await fetch('/api/season-rollover', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'execute' }),
      });
      const data = await res.json();
      if (!res.ok) {
        setErrorMsg(data.error || 'Rollover failed.');
        setStep('error');
        return;
      }
      setResult(data);
      setStep('done');
    } catch (err) {
      setErrorMsg('Unexpected error executing rollover.');
      setStep('error');
    }
  }

  function handleClose() {
    setStep('idle');
    setPreview(null);
    setResult(null);
    setErrorMsg('');
  }

  return (
    <>
      {/* ── Card ── */}
      <div style={cardStyle}>
        <p style={sectionTitle}>Season Rollover</p>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '2rem', flexWrap: 'wrap' }}>
          <div style={{ flex: 1, minWidth: '240px' }}>
            <p style={{ fontFamily: 'var(--font-body)', fontSize: '0.875rem', color: '#374151', lineHeight: 1.6, margin: 0 }}>
              Advances the active season to the next year. Creates the new season, generates grade level mappings,
              retires graduating participants, and clears old waitlists.
            </p>
            <p style={{ fontFamily: 'var(--font-body)', fontSize: '0.8rem', color: '#9ca3af', marginTop: '0.5rem', marginBottom: 0 }}>
              Run this in mid-August before opening registration for the new season.
            </p>
          </div>
          <button
            onClick={handleOpenModal}
            disabled={step === 'loading'}
            style={{ ...btnPrimary, background: '#7c3aed', whiteSpace: 'nowrap', flexShrink: 0, opacity: step === 'loading' ? 0.7 : 1 }}
          >
            {step === 'loading' ? 'Loading…' : 'Start New Season →'}
          </button>
        </div>

        {/* Inline error if modal never opened */}
        {step === 'error' && !preview && (
          <div style={{ marginTop: '0.75rem', padding: '0.6rem 0.875rem', background: '#fff5f5', border: '1px solid #fecaca', borderRadius: '6px', fontFamily: 'var(--font-body)', fontSize: '0.8rem', color: '#b40000' }}>
            {errorMsg}
          </div>
        )}
      </div>

      {/* ── Modal ── */}
      {(step === 'confirm' || step === 'executing' || step === 'done' || (step === 'error' && preview)) && (
        <div style={{
          position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          zIndex: 1000, padding: '1rem',
        }}>
          <div style={{
            background: '#fff', borderRadius: '10px', maxWidth: '520px', width: '100%',
            padding: '1.75rem', boxShadow: '0 20px 60px rgba(0,0,0,0.25)',
          }}>

            {/* ── Confirm step ── */}
            {step === 'confirm' && preview && (
              <>
                <h3 style={{ fontFamily: 'var(--font-display)', fontSize: '1.1rem', fontWeight: 800, letterSpacing: '0.04em', textTransform: 'uppercase', color: '#111', margin: '0 0 1.25rem 0' }}>
                  Confirm Season Rollover
                </h3>

                {/* What's being replaced */}
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem', marginBottom: '1.25rem' }}>
                  <div style={{ background: '#fafafa', border: '1px solid #e5e7eb', borderRadius: '6px', padding: '0.875rem 1rem' }}>
                    <p style={{ fontFamily: 'var(--font-display)', fontSize: '0.6rem', fontWeight: 600, letterSpacing: '0.1em', textTransform: 'uppercase', color: '#9ca3af', margin: '0 0 0.25rem 0' }}>Current Season</p>
                    <p style={{ fontFamily: 'var(--font-display)', fontSize: '1.1rem', fontWeight: 800, color: '#374151', margin: 0 }}>{preview.currentSeason.displayName}</p>
                    <p style={{ fontFamily: 'var(--font-body)', fontSize: '0.75rem', color: '#9ca3af', marginTop: '0.15rem' }}>→ Will be deactivated</p>
                  </div>
                  <div style={{ background: '#f0fdf4', border: '1px solid #bbf7d0', borderRadius: '6px', padding: '0.875rem 1rem' }}>
                    <p style={{ fontFamily: 'var(--font-display)', fontSize: '0.6rem', fontWeight: 600, letterSpacing: '0.1em', textTransform: 'uppercase', color: '#9ca3af', margin: '0 0 0.25rem 0' }}>New Season</p>
                    <p style={{ fontFamily: 'var(--font-display)', fontSize: '1.1rem', fontWeight: 800, color: '#16a34a', margin: 0 }}>{preview.newSeason.displayName}</p>
                    <p style={{ fontFamily: 'var(--font-body)', fontSize: '0.75rem', color: '#9ca3af', marginTop: '0.15rem' }}>
                      {fmtDate(preview.newSeason.startDate)} – {fmtDate(preview.newSeason.endDate)}
                    </p>
                  </div>
                </div>

                {/* What will happen */}
                <div style={{ background: '#fafafa', border: '1px solid #e5e7eb', borderRadius: '6px', padding: '0.875rem 1rem', marginBottom: '1.25rem' }}>
                  <p style={{ fontFamily: 'var(--font-display)', fontSize: '0.65rem', fontWeight: 600, letterSpacing: '0.1em', textTransform: 'uppercase', color: '#6b7280', margin: '0 0 0.625rem 0' }}>What will happen</p>
                  <ul style={{ margin: 0, padding: '0 0 0 1.125rem', fontFamily: 'var(--font-body)', fontSize: '0.85rem', color: '#374151', lineHeight: 1.75 }}>
                    <li>Create season <strong>{preview.newSeason.displayName}</strong> and set it as active</li>
                    <li>Generate <strong>{preview.gradeLevelsCount} grade level mappings</strong> for the new season</li>
                    <li>
                      Mark <strong>{preview.graduatingCount} graduating participant{preview.graduatingCount !== 1 ? 's' : ''}</strong> (Class of {preview.currentSeason.name}) inactive
                    </li>
                    {preview.waitlistCount > 0 && (
                      <li>Clear <strong>{preview.waitlistCount} waitlist entr{preview.waitlistCount !== 1 ? 'ies' : 'y'}</strong> from the current season</li>
                    )}
                    {preview.waitlistCount === 0 && (
                      <li style={{ color: '#9ca3af' }}>No active waitlist entries to clear</li>
                    )}
                  </ul>
                </div>

                {/* What stays */}
                <div style={{ background: '#fffbeb', border: '1px solid #fde68a', borderRadius: '6px', padding: '0.75rem 1rem', marginBottom: '1.5rem' }}>
                  <p style={{ fontFamily: 'var(--font-body)', fontSize: '0.82rem', color: '#92400e', margin: 0, lineHeight: 1.6 }}>
                    ⚠️ This action cannot be undone. Registrations, payments, families, and contacts are not affected.
                    Programs and sessions from the current season remain in the database for historical reference.
                  </p>
                </div>

                <div style={{ display: 'flex', gap: '0.5rem', justifyContent: 'flex-end' }}>
                  <button onClick={handleClose} style={btnSecondary}>Cancel</button>
                  <button onClick={handleExecute} style={btnDanger}>
                    Confirm Rollover to {preview.newSeason.displayName}
                  </button>
                </div>
              </>
            )}

            {/* ── Executing step ── */}
            {step === 'executing' && (
              <div style={{ textAlign: 'center', padding: '1rem 0' }}>
                <p style={{ fontFamily: 'var(--font-display)', fontSize: '1rem', fontWeight: 700, letterSpacing: '0.05em', textTransform: 'uppercase', color: '#374151', marginBottom: '0.5rem' }}>
                  Running rollover…
                </p>
                <p style={{ fontFamily: 'var(--font-body)', fontSize: '0.875rem', color: '#9ca3af' }}>
                  Please wait. Do not close this window.
                </p>
              </div>
            )}

            {/* ── Done step ── */}
            {step === 'done' && result && (
              <>
                <div style={{ textAlign: 'center', marginBottom: '1.25rem' }}>
                  <div style={{ fontSize: '2.5rem', marginBottom: '0.5rem' }}>✓</div>
                  <h3 style={{ fontFamily: 'var(--font-display)', fontSize: '1.1rem', fontWeight: 800, letterSpacing: '0.04em', textTransform: 'uppercase', color: '#16a34a', margin: 0 }}>
                    Season Rollover Complete
                  </h3>
                </div>
                <div style={{ background: '#f0fdf4', border: '1px solid #bbf7d0', borderRadius: '6px', padding: '0.875rem 1rem', marginBottom: '1.25rem' }}>
                  <ul style={{ margin: 0, padding: '0 0 0 1.125rem', fontFamily: 'var(--font-body)', fontSize: '0.875rem', color: '#374151', lineHeight: 1.75 }}>
                    <li>Active season is now <strong>{result.newSeason.displayName}</strong></li>
                    <li>13 grade level mappings created</li>
                    <li>{result.graduatingCount} graduating participant{result.graduatingCount !== 1 ? 's' : ''} marked inactive</li>
                    {result.waitlistCount > 0 && (
                      <li>{result.waitlistCount} waitlist entr{result.waitlistCount !== 1 ? 'ies' : 'y'} cleared</li>
                    )}
                  </ul>
                </div>
                <p style={{ fontFamily: 'var(--font-body)', fontSize: '0.82rem', color: '#6b7280', marginBottom: '1.25rem', lineHeight: 1.5 }}>
                  You can now create programs and sessions for <strong>{result.newSeason.displayName}</strong> and open registration when ready.
                </p>
                <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
                  <button onClick={() => { handleClose(); window.location.reload(); }} style={btnPrimary}>
                    Done
                  </button>
                </div>
              </>
            )}

            {/* ── Error step (modal open) ── */}
            {step === 'error' && preview && (
              <>
                <h3 style={{ fontFamily: 'var(--font-display)', fontSize: '1rem', fontWeight: 700, color: '#b40000', margin: '0 0 0.75rem 0' }}>
                  Rollover Failed
                </h3>
                <div style={{ background: '#fff5f5', border: '1px solid #fecaca', borderRadius: '6px', padding: '0.75rem 1rem', marginBottom: '1.25rem', fontFamily: 'var(--font-body)', fontSize: '0.875rem', color: '#b40000' }}>
                  {errorMsg}
                </div>
                <p style={{ fontFamily: 'var(--font-body)', fontSize: '0.82rem', color: '#6b7280', marginBottom: '1.25rem' }}>
                  No changes were made. Please check the error above and try again, or contact support if the problem persists.
                </p>
                <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
                  <button onClick={handleClose} style={btnSecondary}>Close</button>
                </div>
              </>
            )}

          </div>
        </div>
      )}
    </>
  );
}