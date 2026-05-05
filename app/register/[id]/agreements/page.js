'use client';

import { useState, useEffect, useRef } from 'react';
import { createClient } from '@/lib/supabase/client';
import { useRouter, useSearchParams, useParams } from 'next/navigation';
import Image from 'next/image';
import { sanitizeHtml } from '@/lib/sanitize';
import WizardStepper from '@/components/WizardStepper';
import { fetchDraft, saveDraft } from '@/lib/drafts';

const DOC_ORDER = ['payment_agreement', 'participant_rules', 'liability_waiver'];

const DOC_TITLES = {
  payment_agreement: 'Registration Fee Policy',
  participant_rules: 'Participation Policy & Behavior Standards',
  liability_waiver:  'Health & Safety — Liability Waiver and Release of Claims',
};

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

  // Auto-mark as reviewed if the document content fits without scrolling
  // (short document on a tall screen). Uses rAF to ensure the DOM has
  // painted the injected HTML before measuring scrollHeight.
  useEffect(() => {
    if (scrolled) return;
    const el = scrollRef.current;
    if (!el) return;
    const raf = requestAnimationFrame(() => {
      if (el.scrollHeight <= el.clientHeight + 40) {
        onScrolled();
      }
    });
    return () => cancelAnimationFrame(raf);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [doc.id, scrolled]);

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
          dangerouslySetInnerHTML={{ __html: sanitizeHtml(doc.content) }}
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
  const [loadError, setLoadError] = useState('');
  const [error, setError]     = useState('');
  const [saving, setSaving]   = useState(false);

  const allScrolled  = documents.length > 0 && documents.every(d => scrolledDocs[d.id]);
  const scrolledCount = documents.filter(d => scrolledDocs[d.id]).length;

  useEffect(() => {
    async function load() {
      try {
        const supabase = createClient();
        const [{ data: docs, error: docsErr }, { data: p }, { data: prog }, draft] = await Promise.all([
          supabase.from('policy_documents').select('id, type, content').eq('is_current', true),
          supabase.from('participants').select('first_name, last_name').eq('id', participantId).single(),
          supabase.from('programs').select('label, sessions(name, seasons(display_name, name))').eq('id', programId).single(),
          fetchDraft(programId, participantId),
        ]);

        if (docsErr) throw new Error('Could not load policy documents.');

        const ordered = DOC_ORDER.map(type => docs?.find(d => d.type === type)).filter(Boolean);

        if (ordered.length === 0) {
          setLoadError('The policy documents could not be loaded. Please contact us at registration@triboroyouththeatre.org to complete your registration.');
          return;
        }

        setDocuments(ordered);
        setParticipant(p);
        setProgram(prog);

        // Pre-fill signature from existing draft if one exists
        if (draft?.agreements_data) {
          const parsed = draft.agreements_data;
          if (parsed[0]?.agreed_by) setSignatureName(parsed[0].agreed_by);
          // Mark all docs as scrolled if previously signed
          const allScrolledState = {};
          ordered.forEach(d => { allScrolledState[d.id] = true; });
          setScrolledDocs(allScrolledState);
        }
      } catch (err) {
        console.error('[AgreementsPage] load error:', err);
        setLoadError('Could not load registration documents. Please refresh and try again.');
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

    // IP address is captured server-side from x-forwarded-for in
    // save-registration/route.js — that value is authoritative and overwrites
    // anything stored here. We only record userAgent client-side.
    const userAgent = navigator.userAgent || 'unknown';
    const signedAt  = new Date().toISOString();

    const agreementData = documents.map(d => ({
      policy_document_id: d.id,
      type:               d.type,
      agreed_by:          signatureName.trim(),
      agreed_at:          signedAt,
      ip_address:         'captured-server-side',
      user_agent:         userAgent,
    }));

    try {
      await saveDraft({
        programId,
        participantId,
        current_step:    3,
        agreements_data: agreementData,
      });
    } catch (err) {
      setError(err.message || 'Could not save progress. Please try again.');
      setSaving(false);
      return;
    }

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

      <WizardStepper currentStep={2} />

      <main style={{ maxWidth: '680px', margin: '0 auto', padding: '2rem 1.5rem' }}>
        <form onSubmit={handleSubmit}>
          {loadError && (
            <div>
              <div className="tyt-error" style={{ marginBottom: '1rem' }}>{loadError}</div>
              <a href="/register" className="tyt-btn tyt-btn-secondary" style={{ display: 'inline-flex', marginBottom: '1rem' }}>← Back to Programs</a>
            </div>
          )}
          {!loadError && error && <div className="tyt-error" style={{ marginBottom: '1rem' }}>{error}</div>}

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