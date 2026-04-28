'use client';

import { useState, useEffect, useRef, Suspense } from 'react';
import { createClient } from '@/lib/supabase/client';
import { useRouter, useSearchParams } from 'next/navigation';
import Image from 'next/image';

const STEP_INDICATOR = [
  { n: 1, label: 'Health', done: true },
  { n: 2, label: 'Agreements', active: true },
  { n: 3, label: 'Review', active: false },
  { n: 4, label: 'Payment', active: false },
];

function StepBar() {
  return (
    <div style={{ background: 'var(--bg-card)', borderBottom: '1px solid var(--border)', padding: '0.75rem 1.5rem' }}>
      <div style={{ maxWidth: '680px', margin: '0 auto', display: 'flex', alignItems: 'center' }}>
        {STEP_INDICATOR.map((s, i, arr) => (
          <div key={s.n} style={{ display: 'flex', alignItems: 'center' }}>
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '0.2rem' }}>
              <div style={{
                width: '28px', height: '28px', borderRadius: '50%',
                background: s.done ? 'var(--gold)' : s.active ? 'var(--red)' : 'var(--bg-hover)',
                border: `2px solid ${s.done ? 'var(--gold)' : s.active ? 'var(--red)' : 'var(--border)'}`,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontFamily: 'var(--font-display)', fontSize: '0.75rem', fontWeight: 700,
                color: s.done || s.active ? '#111' : 'var(--text-faint)',
              }}>
                {s.done ? '✓' : s.n}
              </div>
              <span style={{
                fontFamily: 'var(--font-display)', fontSize: '0.55rem', fontWeight: 600,
                letterSpacing: '0.08em', textTransform: 'uppercase', whiteSpace: 'nowrap',
                color: s.done || s.active ? 'var(--text-primary)' : 'var(--text-faint)',
              }}>
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

function DocumentAgreement({ doc, index, total, agreed, onAgree, signatureName, onSignatureChange }) {
  const scrollRef = useRef(null);
  const [scrolled, setScrolled] = useState(false);

  function handleScroll() {
    const el = scrollRef.current;
    if (!el) return;
    const atBottom = el.scrollHeight - el.scrollTop <= el.clientHeight + 40;
    if (atBottom) setScrolled(true);
  }

  const docTitles = {
    liability_waiver: 'Liability Waiver & Release of Claims',
    participant_rules: 'Company Rules & Guidelines',
    payment_agreement: 'Registration Fee Policy & Agreement',
  };

  return (
    <div style={{
      background: 'var(--bg-card)',
      border: `1px solid ${agreed ? 'var(--gold)' : 'var(--border)'}`,
      borderRadius: 'var(--radius-md)',
      overflow: 'hidden',
      marginBottom: '1.5rem',
    }}>
      {/* Header */}
      <div style={{
        background: agreed ? '#0d1a0a' : 'var(--bg-hover)',
        borderBottom: '1px solid var(--border)',
        padding: '0.875rem 1.25rem',
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        gap: '1rem',
      }}>
        <div>
          <p style={{ fontFamily: 'var(--font-display)', fontSize: '0.65rem', fontWeight: 600, letterSpacing: '0.1em', textTransform: 'uppercase', color: 'var(--text-faint)', marginBottom: '0.2rem' }}>
            Document {index} of {total}
          </p>
          <p style={{ fontFamily: 'var(--font-display)', fontSize: '0.9rem', fontWeight: 700, letterSpacing: '0.04em', textTransform: 'uppercase', color: 'var(--text-primary)' }}>
            {docTitles[doc.type] || doc.type}
          </p>
        </div>
        {agreed && (
          <span style={{ fontFamily: 'var(--font-display)', fontSize: '0.7rem', fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase', color: 'var(--gold)', border: '1px solid var(--gold)', borderRadius: '3px', padding: '0.2rem 0.5rem', flexShrink: 0 }}>
            ✓ Agreed
          </span>
        )}
      </div>

      {/* Scroll area */}
      <div
        ref={scrollRef}
        onScroll={handleScroll}
        style={{
          height: '220px',
          overflowY: 'scroll',
          padding: '1.25rem',
          background: 'var(--bg-dark)',
          fontFamily: 'var(--font-body)',
          fontSize: '0.82rem',
          color: 'var(--text-muted)',
          lineHeight: 1.7,
          whiteSpace: 'pre-wrap',
        }}
      >
        {doc.content}
        {!scrolled && (
          <div style={{
            position: 'sticky',
            bottom: 0,
            left: 0,
            right: 0,
            textAlign: 'center',
            padding: '0.5rem',
            background: 'linear-gradient(transparent, var(--bg-dark))',
            fontFamily: 'var(--font-display)',
            fontSize: '0.65rem',
            letterSpacing: '0.1em',
            textTransform: 'uppercase',
            color: 'var(--text-faint)',
            pointerEvents: 'none',
          }}>
            ↓ Scroll to read
          </div>
        )}
      </div>

      {/* Agreement section */}
      {!agreed ? (
        <div style={{ padding: '1.25rem', borderTop: '1px solid var(--border)' }}>
          {!scrolled && (
            <p style={{ fontFamily: 'var(--font-body)', fontSize: '0.8rem', color: 'var(--text-faint)', marginBottom: '1rem', fontStyle: 'italic' }}>
              Please scroll through the document above before signing.
            </p>
          )}
          <div style={{ marginBottom: '1rem' }}>
            <label className="tyt-label">
              Type your full name to sign <span style={{ color: 'var(--red)' }}>*</span>
            </label>
            <input
              type="text"
              value={signatureName}
              onChange={e => onSignatureChange(e.target.value)}
              placeholder="Your full name"
              className="tyt-input"
              disabled={!scrolled}
              style={{ opacity: scrolled ? 1 : 0.5 }}
            />
          </div>
          <button
            type="button"
            onClick={onAgree}
            disabled={!scrolled || !signatureName.trim()}
            className="tyt-btn tyt-btn-primary"
            style={{
              width: '100%',
              opacity: scrolled && signatureName.trim() ? 1 : 0.5,
              cursor: scrolled && signatureName.trim() ? 'pointer' : 'not-allowed',
            }}
          >
            I Agree &amp; Sign
          </button>
        </div>
      ) : (
        <div style={{ padding: '1rem 1.25rem', borderTop: '1px solid var(--border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <p style={{ fontFamily: 'var(--font-body)', fontSize: '0.85rem', color: 'var(--text-muted)' }}>
            Signed as: <strong style={{ color: 'var(--text-primary)' }}>{signatureName}</strong>
          </p>
        </div>
      )}
    </div>
  );
}

function AgreementsForm({ programId }) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const participantId = searchParams.get('participant');

  const [documents, setDocuments] = useState([]);
  const [agreed, setAgreed] = useState({});
  const [signatures, setSignatures] = useState({});
  const [participant, setParticipant] = useState(null);
  const [program, setProgram] = useState(null);
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    async function load() {
      const supabase = createClient();
      const [{ data: docs }, { data: p }, { data: prog }] = await Promise.all([
        supabase.from('policy_documents').select('id, type, content').eq('is_current', true).order('type'),
        supabase.from('participants').select('first_name, last_name').eq('id', participantId).single(),
        supabase.from('programs').select('label, sessions(name, seasons(display_name, name))').eq('id', programId).single(),
      ]);

      // Order: participant_rules, liability_waiver, payment_agreement
      const ordered = ['participant_rules', 'liability_waiver', 'payment_agreement']
        .map(type => docs?.find(d => d.type === type))
        .filter(Boolean);

      setDocuments(ordered);
      setParticipant(p);
      setProgram(prog);

      const initAgreed = {};
      const initSigs = {};
      ordered.forEach(d => { initAgreed[d.id] = false; initSigs[d.id] = ''; });
      setAgreed(initAgreed);
      setSignatures(initSigs);
    }
    load();
  }, [participantId, programId]);

  function handleAgree(docId) {
    if (!signatures[docId]?.trim()) return;
    setAgreed(a => ({ ...a, [docId]: true }));
  }

  function handleSignatureChange(docId, val) {
    setSignatures(s => ({ ...s, [docId]: val }));
  }

  async function handleSubmit(e) {
    e.preventDefault();
    setError('');

    const allAgreed = documents.every(d => agreed[d.id]);
    if (!allAgreed) {
      setError('You must agree to all documents before continuing.');
      return;
    }

    setSaving(true);

    // Store agreement data in sessionStorage
    const agreementData = documents.map(d => ({
      policy_document_id: d.id,
      type: d.type,
      agreed_by: signatures[d.id],
      agreed_at: new Date().toISOString(),
    }));
    sessionStorage.setItem(`agreements_${programId}_${participantId}`, JSON.stringify(agreementData));

    router.push(`/register/${programId}/review?participant=${participantId}`);
  }

  const allAgreed = documents.length > 0 && documents.every(d => agreed[d.id]);
  const seasonDisplay = program?.sessions?.seasons?.display_name || program?.sessions?.seasons?.name;

  return (
    <form onSubmit={handleSubmit}>
      {error && <div className="tyt-error">{error}</div>}

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
      <p style={{ fontFamily: 'var(--font-accent)', fontStyle: 'italic', color: 'var(--text-muted)', fontSize: '0.9rem', marginBottom: '1.5rem' }}>
        Please read and sign each document below. All three are required to complete registration.
      </p>

      {documents.map((doc, i) => (
        <DocumentAgreement
          key={doc.id}
          doc={doc}
          index={i + 1}
          total={documents.length}
          agreed={agreed[doc.id]}
          onAgree={() => handleAgree(doc.id)}
          signatureName={signatures[doc.id] || ''}
          onSignatureChange={val => handleSignatureChange(doc.id, val)}
        />
      ))}

      <button
        type="submit"
        disabled={saving || !allAgreed}
        className="tyt-btn tyt-btn-primary tyt-btn-full"
        style={{ opacity: allAgreed ? 1 : 0.5, cursor: allAgreed ? 'pointer' : 'not-allowed' }}
      >
        {saving ? 'Saving...' : 'Continue to Review →'}
      </button>
    </form>
  );
}

export default function AgreementsPage({ params }) {
  const programId = params.id;

  return (
    <div style={{ minHeight: '100vh', background: 'var(--bg-dark)' }}>
      <nav style={{
        background: 'var(--bg-card)', borderBottom: '1px solid var(--border)',
        padding: '0 1.5rem', display: 'flex', alignItems: 'center',
        justifyContent: 'space-between', height: '64px',
        position: 'sticky', top: 0, zIndex: 100,
      }}>
        <a href="/register" style={{ display: 'flex', alignItems: 'center', textDecoration: 'none' }}>
          <Image src="/images/tyt-logo.png" alt="Triboro Youth Theatre" width={48} height={48} style={{ objectFit: 'contain' }} />
        </a>
        <span style={{ fontFamily: 'var(--font-display)', fontSize: '1.1rem', fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase', color: 'var(--text-primary)' }}>
          Registration
        </span>
        <a href="/register" style={{
          fontFamily: 'var(--font-display)', fontSize: '0.75rem', fontWeight: 600,
          letterSpacing: '0.1em', textTransform: 'uppercase', color: 'var(--gold)',
          textDecoration: 'none', border: '1px solid var(--gold)',
          borderRadius: 'var(--radius-sm)', padding: '0.35rem 0.85rem',
        }}>
          ← Back
        </a>
      </nav>

      <StepBar />

      <main style={{ maxWidth: '680px', margin: '0 auto', padding: '2rem 1.5rem' }}>
        <Suspense fallback={
          <div style={{ textAlign: 'center', color: 'var(--text-muted)', padding: '3rem', fontFamily: 'var(--font-accent)', fontStyle: 'italic' }}>
            Loading...
          </div>
        }>
          <AgreementsForm programId={programId} />
        </Suspense>
      </main>
    </div>
  );
}