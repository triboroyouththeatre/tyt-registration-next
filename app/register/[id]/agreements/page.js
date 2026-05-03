'use client';

import { useState, useEffect, useRef } from 'react';
import { createClient } from '@/lib/supabase/client';
import { useRouter, useSearchParams, useParams } from 'next/navigation';
import Image from 'next/image';

const DOC_ORDER = ['payment_agreement', 'participant_rules', 'liability_waiver'];

const DOC_TITLES = {
  payment_agreement: 'Registration Fee Policy',
  participant_rules: 'Participation Policy & Behavior Standards',
  liability_waiver:  'Health & Safety — Liability Waiver and Release of Claims',
};

const STEP_INDICATOR = [
  { n: 1, label: 'Health',     done: true,  active: false },
  { n: 2, label: 'Agreements', done: false, active: true  },
  { n: 3, label: 'Review',     done: false, active: false },
  { n: 4, label: 'Payment',    done: false, active: false },
];

// ─── Step Bar ──────────────────────────────────────────────────────────────────

function StepBar() {
  return (
    <div style={{ background: 'var(--bg-card)', borderBottom: '1px solid var(--border)', padding: '0.75rem 1.5rem' }}>
      <div style={{ maxWidth: '680px', margin: '0 auto', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        {STEP_INDICATOR.map((s, i, arr) => (
          <div key={s.n} style={{ display: 'flex', alignItems: 'center' }}>
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '0.2rem' }}>
              <div style={{
                width: '28px', height: '28px', borderRadius: '50%',
                background: s.done ? 'var(--gold)' : s.active ? 'var(--red)' : 'var(--bg-hover)',
                border: `2px solid ${s.done ? 'var(--gold)' : s.active ? 'var(--red)' : 'var(--border)'}`,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontFamily: 'var(--font-display)', fontSize: '0.75rem', fontWeight: 700,
                color: s.done ? '#111' : s.active ? '#fff' : 'var(--text-faint)',
              }}>
                {s.done ? '✓' : s.n}
              </div>
              <span style={{ fontFamily: 'var(--font-display)', fontSize: '0.55rem', fontWeight: 600, letterSpacing: '0.08em', textTransform: 'uppercase', whiteSpace: 'nowrap', color: s.done || s.active ? 'var(--text-primary)' : 'var(--text-faint)' }}>
                {s.label}
              </span>
            </div>
            {i < arr.length - 1 && (
              <div style={{ width: '40px', height: '2px', background: s.done ? 'var(--gold)' : 'var(--border)', margin: '0 4px', marginBottom: '16px' }} />
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

// ─── Print Button ──────────────────────────────────────────────────────────────

function PrintButton({ doc, programId }) {
  // Link to the dedicated print page — no popups, no Blob URLs,
  // works on all browsers including mobile Safari.
  const href = `/register/${programId}/agreements/print?doc=${doc.type}`;
  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      style={{
        background: 'none', border: '1px solid var(--border)', borderRadius: 'var(--radius-sm)',
        padding: '0.25rem 0.65rem', color: 'var(--text-faint)',
        fontFamily: 'var(--font-display)', fontSize: '0.65rem', fontWeight: 600,
        letterSpacing: '0.08em', textTransform: 'uppercase', cursor: 'pointer',
        display: 'flex', alignItems: 'center', gap: '0.3rem', textDecoration: 'none',
      }}
    >
      ⎙ Print / Save
    </a>
  );
}

// ─── Document Card ─────────────────────────────────────────────────────────────

function DocumentCard({ doc, index, total, onScrolled, scrolled, programId }) {
  const scrollRef = useRef(null);

  function handleScroll() {
    const el = scrollRef.current;
    if (!el || scrolled) return;
    if (el.scrollHeight - el.scrollTop <= el.clientHeight + 40) {
      onScrolled();
    }
  }

  const borderColor = scrolled ? '#22c55e' : '#b40000';
  const headerBg    = scrolled ? '#0a1a0a' : '#1a0505';

  return (
    <div style={{
      border: `1px solid ${borderColor}`,
      borderRadius: 'var(--radius-md)',
      overflow: 'hidden',
      marginBottom: '1rem',
      transition: 'border-color 0.3s ease',
    }}>
      {/* Header */}
      <div style={{
        background: headerBg,
        borderBottom: `1px solid ${borderColor}`,
        padding: '0.875rem 1.25rem',
        display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '1rem',
        transition: 'background 0.3s ease',
      }}>
        <div>
          <p style={{ fontFamily: 'var(--font-display)', fontSize: '0.65rem', fontWeight: 600, letterSpacing: '0.1em', textTransform: 'uppercase', color: 'var(--text-faint)', marginBottom: '0.2rem' }}>
            Document {index} of {total}
          </p>
          <p style={{ fontFamily: 'var(--font-display)', fontSize: '0.9rem', fontWeight: 700, letterSpacing: '0.04em', textTransform: 'uppercase', color: 'var(--text-primary)' }}>
            {DOC_TITLES[doc.type]}
          </p>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
          {scrolled && (
            <span style={{ fontFamily: 'var(--font-display)', fontSize: '0.7rem', fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase', color: '#22c55e' }}>
              ✓ Reviewed
            </span>
          )}
          <PrintButton doc={doc} programId={programId} />
        </div>
      </div>

      {/* Scrollable content */}
      <div
        ref={scrollRef}
        onScroll={handleScroll}
        style={{
          height: '240px',
          overflowY: 'scroll',
          padding: '1.25rem',
          background: 'var(--bg-dark)',
          position: 'relative',
        }}
      >
        <div
          style={{ fontFamily: 'var(--font-body)', fontSize: '0.82rem', color: 'var(--text-muted)', lineHeight: 1.75 }}
          dangerouslySetInnerHTML={{ __html: doc.content }}
        />
        {!scrolled && (
          <div style={{
            position: 'sticky', bottom: 0,
            textAlign: 'center', padding: '0.5rem',
            background: 'linear-gradient(transparent, var(--bg-dark))',
            pointerEvents: 'none',
          }}>
            <span style={{ fontFamily: 'var(--font-display)', fontSize: '0.6rem', letterSpacing: '0.1em', textTransform: 'uppercase', color: '#b40000' }}>
              ↓ Scroll to review
            </span>
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Main Page ──────────────────────────────────────────────────────────────────

export default function AgreementsPage() {
  const params = useParams();
  const searchParams = useSearchParams();
  const router = useRouter();
  const programId    = params?.id;
  const participantId = searchParams?.get('participant');

  const [documents, setDocuments]     = useState([]);
  const [participant, setParticipant] = useState(null);
  const [program, setProgram]         = useState(null);
  const [scrolledDocs, setScrolledDocs] = useState({}); // { [docId]: true }
  const [signatureName, setSignatureName] = useState('');
  const [error, setError]     = useState('');
  const [saving, setSaving]   = useState(false);

  const allScrolled  = documents.length > 0 && documents.every(d => scrolledDocs[d.id]);
  const scrolledCount = documents.filter(d => scrolledDocs[d.id]).length;

  useEffect(() => {
    async function load() {
      const supabase = createClient();
      const [{ data: docs }, { data: p }, { data: prog }] = await Promise.all([
        supabase.from('policy_documents').select('id, type, content').eq('is_current', true),
        supabase.from('participants').select('first_name, last_name').eq('id', participantId).single(),
        supabase.from('programs').select('label, sessions(name, seasons(display_name, name))').eq('id', programId).single(),
      ]);

      const ordered = DOC_ORDER.map(type => docs?.find(d => d.type === type)).filter(Boolean);
      setDocuments(ordered);
      setParticipant(p);
      setProgram(prog);

      // Pre-fill signature if returning via back button
      const saved = sessionStorage.getItem(`agreements_${programId}_${participantId}`);
      if (saved) {
        const parsed = JSON.parse(saved);
        if (parsed[0]?.agreed_by) setSignatureName(parsed[0].agreed_by);
        // Mark all docs as scrolled if previously signed
        const allScrolledState = {};
        ordered.forEach(d => { allScrolledState[d.id] = true; });
        setScrolledDocs(allScrolledState);
      }
    }
    load();
  }, [participantId, programId]);

  function handleDocScrolled(docId) {
    setScrolledDocs(prev => ({ ...prev, [docId]: true }));
  }

  async function handleSubmit(e) {
    e.preventDefault();
    setError('');

    if (!allScrolled) {
      setError('Please scroll through all three documents before signing.');
      return;
    }
    if (!signatureName.trim()) {
      setError('Please type your full name to sign the agreements.');
      return;
    }
    if (signatureName.trim().split(' ').length < 2) {
      setError('Please enter your full name (first and last) to sign.');
      return;
    }

    setSaving(true);

    // Capture IP address and device string for E-SIGN audit record
    let ipAddress = 'unknown';
    try {
      const ipRes = await fetch('https://api.ipify.org?format=json');
      const ipData = await ipRes.json();
      ipAddress = ipData.ip || 'unknown';
    } catch {
      ipAddress = 'unavailable';
    }
    const userAgent = navigator.userAgent || 'unknown';
    const signedAt  = new Date().toISOString();

    const agreementData = documents.map(d => ({
      policy_document_id: d.id,
      type:               d.type,
      agreed_by:          signatureName.trim(),
      agreed_at:          signedAt,
      ip_address:         ipAddress,
      user_agent:         userAgent,
    }));
    sessionStorage.setItem(`agreements_${programId}_${participantId}`, JSON.stringify(agreementData));
    router.push(`/register/${programId}/review?participant=${participantId}`);
  }

  const seasonDisplay = program?.sessions?.seasons?.display_name || program?.sessions?.seasons?.name;

  return (
    <div style={{ minHeight: '100vh', background: 'var(--bg-dark)' }}>

      {/* Nav */}
      <nav style={{
        background: 'var(--bg-card)', borderBottom: '1px solid var(--border)',
        padding: '0 1.5rem', display: 'flex', alignItems: 'center',
        justifyContent: 'space-between', height: '64px',
        position: 'sticky', top: 0, zIndex: 100,
      }}>
        <a href="/dashboard" style={{ display: 'flex', alignItems: 'center', textDecoration: 'none' }}>
          <Image src="/images/tyt-logo.png" alt="Triboro Youth Theatre" width={48} height={48} style={{ objectFit: 'contain' }} />
        </a>
        <span style={{ fontFamily: 'var(--font-display)', fontSize: '1.1rem', fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase', color: 'var(--text-primary)' }}>
          Registration
        </span>
        <a
          href={`/register/${programId}?participant=${participantId}`}
          style={{
            fontFamily: 'var(--font-display)', fontSize: '0.75rem', fontWeight: 600,
            letterSpacing: '0.1em', textTransform: 'uppercase', color: 'var(--gold)',
            textDecoration: 'none', border: '1px solid var(--gold)',
            borderRadius: 'var(--radius-sm)', padding: '0.35rem 0.85rem',
          }}
        >
          ← Back
        </a>
      </nav>

      <StepBar />

      <main style={{ maxWidth: '680px', margin: '0 auto', padding: '2rem 1.5rem' }}>
        <form onSubmit={handleSubmit}>
          {error && <div className="tyt-error" style={{ marginBottom: '1rem' }}>{error}</div>}

          {/* Context banner */}
          {participant && program && (
            <div style={{ background: 'var(--bg-hover)', border: '1px solid var(--border)', borderRadius: 'var(--radius-sm)', padding: '0.875rem 1.25rem', marginBottom: '1.5rem' }}>
              <p style={{ fontFamily: 'var(--font-display)', fontSize: '0.7rem', fontWeight: 600, letterSpacing: '0.1em', textTransform: 'uppercase', color: 'var(--text-faint)', marginBottom: '0.2rem' }}>Registering</p>
              <p style={{ fontFamily: 'var(--font-display)', fontSize: '1rem', fontWeight: 700, color: 'var(--text-primary)' }}>
                {participant.first_name} {participant.last_name}
              </p>
              <p style={{ fontFamily: 'var(--font-body)', fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                {program.label} · {seasonDisplay} Season · {program.sessions?.name} Session
              </p>
            </div>
          )}

          <h2 style={{ fontFamily: 'var(--font-display)', fontSize: '1.3rem', fontWeight: 700, letterSpacing: '0.05em', textTransform: 'uppercase', color: 'var(--text-primary)', marginBottom: '0.25rem' }}>
            Agreements
          </h2>
          <p style={{ fontFamily: 'var(--font-accent)', fontStyle: 'italic', color: 'var(--text-muted)', fontSize: '0.9rem', marginBottom: '0.5rem' }}>
            Please scroll through all three documents below. A single signature applies to all three.
          </p>

          {/* Progress indicator */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '1.25rem' }}>
            {documents.map(d => (
              <div
                key={d.id}
                style={{
                  height: '4px', flex: 1, borderRadius: '2px',
                  background: scrolledDocs[d.id] ? '#22c55e' : '#b40000',
                  transition: 'background 0.3s ease',
                }}
              />
            ))}
            <span style={{ fontFamily: 'var(--font-display)', fontSize: '0.65rem', fontWeight: 600, letterSpacing: '0.08em', textTransform: 'uppercase', color: allScrolled ? '#22c55e' : 'var(--text-faint)', flexShrink: 0 }}>
              {scrolledCount} of {documents.length} reviewed
            </span>
          </div>

          {/* Document cards */}
          {documents.map((doc, i) => (
            <DocumentCard
              key={doc.id}
              doc={doc}
              index={i + 1}
              total={documents.length}
              scrolled={!!scrolledDocs[doc.id]}
              onScrolled={() => handleDocScrolled(doc.id)}
              programId={programId}
            />
          ))}

          {/* Signature — only shown after all docs scrolled */}
          {allScrolled && (
            <div style={{
              background: '#0d1a0a',
              border: '1px solid var(--gold)',
              borderRadius: 'var(--radius-md)',
              padding: '1.5rem',
              marginTop: '0.5rem',
              marginBottom: '1.75rem',
              animation: 'fadeIn 0.4s ease',
            }}>
              <p style={{ fontFamily: 'var(--font-display)', fontSize: '0.8rem', fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase', color: 'var(--gold)', marginBottom: '0.75rem' }}>
                Electronic Signature
              </p>
              <p style={{ fontFamily: 'var(--font-body)', fontSize: '0.82rem', color: 'var(--text-muted)', lineHeight: 1.7, marginBottom: '1.25rem' }}>
                By typing my name below and clicking "Continue," I acknowledge that I have read and agree
                to all provisions of this Agreement. I understand that my typed name constitutes a legally
                binding electronic signature under the Electronic Signatures in Global and National Commerce
                Act (E-SIGN Act, 15 U.S.C. § 7001) and the Massachusetts Uniform Electronic Transactions
                Act (M.G.L. c. 110G), and carries the same legal weight as a handwritten signature.
              </p>
              <label className="tyt-label" style={{ color: 'var(--text-primary)' }}>
                Full Name <span style={{ color: 'var(--red)' }}>*</span>
              </label>
              <input
                type="text"
                value={signatureName}
                onChange={e => setSignatureName(e.target.value)}
                placeholder="Type your full name"
                className="tyt-input"
                style={{ marginTop: '0.4rem' }}
              />
              {signatureName.trim() && (
                <p style={{ fontFamily: 'var(--font-accent)', fontStyle: 'italic', fontSize: '1rem', color: 'var(--gold)', marginTop: '0.75rem' }}>
                  {signatureName}
                </p>
              )}
            </div>
          )}

          {/* Continue button — disabled until all scrolled and signed */}
          {allScrolled ? (
            <button
              type="submit"
              disabled={saving || !signatureName.trim()}
              className="tyt-btn tyt-btn-primary tyt-btn-full"
              style={{ opacity: signatureName.trim() ? 1 : 0.5, cursor: signatureName.trim() ? 'pointer' : 'not-allowed' }}
            >
              {saving ? 'Saving...' : 'Continue to Review →'}
            </button>
          ) : (
            <button
              type="button"
              disabled
              className="tyt-btn tyt-btn-primary tyt-btn-full"
              style={{ opacity: 0.4, cursor: 'not-allowed' }}
            >
              Please review all {documents.length} documents to continue
            </button>
          )}
        </form>
      </main>

      <style>{`
        @keyframes fadeIn { from { opacity: 0; transform: translateY(8px); } to { opacity: 1; transform: translateY(0); } }
      `}</style>
    </div>
  );
}