'use client';

import { useState, useEffect, useRef, Suspense } from 'react';
import { createClient } from '@/lib/supabase/client';
import { useRouter, useSearchParams, useParams } from 'next/navigation';
import Image from 'next/image';


const DOC_ORDER = ['payment_agreement', 'participant_rules', 'liability_waiver'];

const DOC_TITLES = {
  payment_agreement: 'Registration Fee Policy',
  participant_rules: 'Participation Policy & Behavior Standards',
  liability_waiver: 'Health & Safety — Liability Waiver and Release of Claims',
};

const STEP_INDICATOR = [
  { n: 1, label: 'Health', done: true, active: false },
  { n: 2, label: 'Agreements', done: false, active: true },
  { n: 3, label: 'Review', done: false, active: false },
  { n: 4, label: 'Payment', done: false, active: false },
];

function StepBar() {
  return (
    <div style={{ background: 'var(--bg-card)', borderBottom: '1px solid var(--border)', padding: '0.75rem 1.5rem' }}>
      <div style={{ maxWidth: '680px', margin: '0 auto', display: 'flex', alignItems: 'center' }}>
        {STEP_INDICATOR.map((s, i, arr) => (
          <div key={s.n} style={{ display: 'flex', alignItems: 'center' }}>
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '0.2rem' }}>
              <div style={{ width: '28px', height: '28px', borderRadius: '50%', background: s.done ? 'var(--gold)' : s.active ? 'var(--red)' : 'var(--bg-hover)', border: `2px solid ${s.done ? 'var(--gold)' : s.active ? 'var(--red)' : 'var(--border)'}`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: 'var(--font-display)', fontSize: '0.75rem', fontWeight: 700, color: s.done ? '#111' : s.active ? '#fff' : 'var(--text-faint)' }}>
                {s.done ? '✓' : s.n}
              </div>
              <span style={{ fontFamily: 'var(--font-display)', fontSize: '0.55rem', fontWeight: 600, letterSpacing: '0.08em', textTransform: 'uppercase', whiteSpace: 'nowrap', color: s.done || s.active ? 'var(--text-primary)' : 'var(--text-faint)' }}>{s.label}</span>
            </div>
            {i < arr.length - 1 && <div style={{ width: '40px', height: '2px', background: s.done ? 'var(--gold)' : 'var(--border)', margin: '0 4px', marginBottom: '16px' }} />}
          </div>
        ))}
      </div>
    </div>
  );
}

function PrintButton({ doc }) {
  function handlePrint() {
    const win = window.open('', '_blank');
    win.document.write(`<!DOCTYPE html><html><head><title>${DOC_TITLES[doc.type]}</title><style>body{font-family:Georgia,serif;max-width:700px;margin:2rem auto;padding:0 1rem;color:#111;line-height:1.7;font-size:14px;}h1{font-size:1.1rem;border-bottom:2px solid #111;padding-bottom:.5rem;margin-bottom:1.5rem;}p{margin-bottom:1rem;}ul{margin:.5rem 0 1rem 1.5rem;}li{margin-bottom:.4rem;}a{color:#b40000;}@media print{body{margin:0;}}</style></head><body><h1>${DOC_TITLES[doc.type]}</h1>${doc.content}<p style="margin-top:2rem;font-size:12px;color:#666;">Triboro Youth Theatre &mdash; ${new Date().toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}</p></body></html>`);
    win.document.close();
    win.focus();
    win.print();
  }
  return (
    <button type="button" onClick={handlePrint} style={{ background: 'none', border: '1px solid var(--border)', borderRadius: 'var(--radius-sm)', padding: '0.25rem 0.65rem', color: 'var(--text-faint)', fontFamily: 'var(--font-display)', fontSize: '0.65rem', fontWeight: 600, letterSpacing: '0.08em', textTransform: 'uppercase', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '0.3rem' }}>
      ⎙ Print / Save
    </button>
  );
}

function DocumentCard({ doc, index, total }) {
  const scrollRef = useRef(null);
  const [scrolled, setScrolled] = useState(false);

  function handleScroll() {
    const el = scrollRef.current;
    if (!el) return;
    if (el.scrollHeight - el.scrollTop <= el.clientHeight + 40) setScrolled(true);
  }

  return (
    <div style={{ background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 'var(--radius-md)', overflow: 'hidden', marginBottom: '1rem' }}>
      <div style={{ background: 'var(--bg-hover)', borderBottom: '1px solid var(--border)', padding: '0.875rem 1.25rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '1rem' }}>
        <div>
          <p style={{ fontFamily: 'var(--font-display)', fontSize: '0.65rem', fontWeight: 600, letterSpacing: '0.1em', textTransform: 'uppercase', color: 'var(--text-faint)', marginBottom: '0.2rem' }}>Document {index} of {total}</p>
          <p style={{ fontFamily: 'var(--font-display)', fontSize: '0.9rem', fontWeight: 700, letterSpacing: '0.04em', textTransform: 'uppercase', color: 'var(--text-primary)' }}>{DOC_TITLES[doc.type]}</p>
        </div>
        <PrintButton doc={doc} />
      </div>
      <div ref={scrollRef} onScroll={handleScroll} style={{ height: '240px', overflowY: 'scroll', padding: '1.25rem', background: 'var(--bg-dark)', position: 'relative' }}>
        <div style={{ fontFamily: 'var(--font-body)', fontSize: '0.82rem', color: 'var(--text-muted)', lineHeight: 1.75 }} dangerouslySetInnerHTML={{ __html: doc.content }} />
        {!scrolled && (
          <div style={{ position: 'sticky', bottom: 0, textAlign: 'center', padding: '0.5rem', background: 'linear-gradient(transparent, var(--bg-dark))', pointerEvents: 'none' }}>
            <span style={{ fontFamily: 'var(--font-display)', fontSize: '0.6rem', letterSpacing: '0.1em', textTransform: 'uppercase', color: 'var(--text-faint)' }}>↓ Scroll to read</span>
          </div>
        )}
      </div>
    </div>
  );
}

function AgreementsForm({ programId }) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const participantId = searchParams.get('participant');

  const [documents, setDocuments] = useState([]);
  const [participant, setParticipant] = useState(null);
  const [program, setProgram] = useState(null);
  const [signatureName, setSignatureName] = useState('');
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);

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

      // Pre-fill signature from sessionStorage if returning via back button
      const saved = sessionStorage.getItem(`agreements_${programId}_${participantId}`);
      if (saved) {
        const parsed = JSON.parse(saved);
        if (parsed[0]?.agreed_by) setSignatureName(parsed[0].agreed_by);
      }
    }
    load();
  }, [participantId, programId]);

  async function handleSubmit(e) {
    e.preventDefault();
    setError('');
    if (!signatureName.trim()) { setError('Please type your full name to sign the agreements.'); return; }
    if (signatureName.trim().split(' ').length < 2) { setError('Please enter your full name (first and last) to sign.'); return; }

    setSaving(true);
    const agreementData = documents.map(d => ({
      policy_document_id: d.id,
      type: d.type,
      agreed_by: signatureName.trim(),
      agreed_at: new Date().toISOString(),
    }));
    sessionStorage.setItem(`agreements_${programId}_${participantId}`, JSON.stringify(agreementData));
    router.push(`/register/${programId}/review?participant=${participantId}&programId=${programId}`);
  }

  const seasonDisplay = program?.sessions?.seasons?.display_name || program?.sessions?.seasons?.name;
  const alreadySigned = !!signatureName.trim();

  return (
    <form onSubmit={handleSubmit}>
      {error && <div className="tyt-error">{error}</div>}

      {participant && program && (
        <div style={{ background: 'var(--bg-hover)', border: '1px solid var(--border)', borderRadius: 'var(--radius-sm)', padding: '0.875rem 1.25rem', marginBottom: '1.5rem' }}>
          <p style={{ fontFamily: 'var(--font-display)', fontSize: '0.7rem', fontWeight: 600, letterSpacing: '0.1em', textTransform: 'uppercase', color: 'var(--text-faint)', marginBottom: '0.2rem' }}>Registering</p>
          <p style={{ fontFamily: 'var(--font-display)', fontSize: '1rem', fontWeight: 700, color: 'var(--text-primary)' }}>{participant.first_name} {participant.last_name}</p>
          <p style={{ fontFamily: 'var(--font-body)', fontSize: '0.8rem', color: 'var(--text-muted)' }}>{program.label} · {seasonDisplay} Season · {program.sessions?.name} Session</p>
        </div>
      )}

      {/* Previously signed notice */}
      {alreadySigned && (
        <div style={{ background: '#0d1a0a', border: '1px solid var(--gold)', borderRadius: 'var(--radius-sm)', padding: '0.75rem 1rem', marginBottom: '1.25rem', display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
          <span style={{ color: 'var(--gold)', fontSize: '1rem' }}>✓</span>
          <p style={{ fontFamily: 'var(--font-body)', fontSize: '0.85rem', color: 'var(--text-muted)' }}>
            Previously signed as <strong style={{ color: 'var(--text-primary)' }}>{signatureName}</strong>. You can update your signature below if needed.
          </p>
        </div>
      )}

      <h2 style={{ fontFamily: 'var(--font-display)', fontSize: '1.3rem', fontWeight: 700, letterSpacing: '0.05em', textTransform: 'uppercase', color: 'var(--text-primary)', marginBottom: '0.25rem' }}>Agreements</h2>
      <p style={{ fontFamily: 'var(--font-accent)', fontStyle: 'italic', color: 'var(--text-muted)', fontSize: '0.9rem', marginBottom: '1.5rem' }}>
        Please read all three documents below. A single signature at the bottom applies to all three.
      </p>

      {documents.map((doc, i) => (
        <DocumentCard key={doc.id} doc={doc} index={i + 1} total={documents.length} />
      ))}

      <div style={{ background: '#0d1a0a', border: '1px solid var(--gold)', borderRadius: 'var(--radius-md)', padding: '1.5rem', marginTop: '0.5rem', marginBottom: '1.75rem' }}>
        <p style={{ fontFamily: 'var(--font-display)', fontSize: '0.8rem', fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase', color: 'var(--gold)', marginBottom: '0.75rem' }}>Electronic Signature</p>
        <p style={{ fontFamily: 'var(--font-body)', fontSize: '0.82rem', color: 'var(--text-muted)', lineHeight: 1.7, marginBottom: '1.25rem' }}>
          By typing your name below and clicking "Continue", you acknowledge that you have read and agree to all three policies above. You understand that your typed name constitutes a legally binding electronic signature under the Electronic Signatures in Global and National Commerce Act (E-SIGN Act, 15 U.S.C. § 7001) and applicable state law, and carries the same legal weight as a handwritten signature.
        </p>
        <label className="tyt-label" style={{ color: 'var(--text-primary)' }}>Full Name <span style={{ color: 'var(--red)' }}>*</span></label>
        <input type="text" value={signatureName} onChange={e => setSignatureName(e.target.value)} placeholder="Type your full name" className="tyt-input" style={{ marginTop: '0.4rem' }} />
        {signatureName.trim() && (
          <p style={{ fontFamily: 'var(--font-accent)', fontStyle: 'italic', fontSize: '1rem', color: 'var(--gold)', marginTop: '0.75rem' }}>{signatureName}</p>
        )}
      </div>

      <button type="submit" disabled={saving || !signatureName.trim()} className="tyt-btn tyt-btn-primary tyt-btn-full" style={{ opacity: signatureName.trim() ? 1 : 0.5, cursor: signatureName.trim() ? 'pointer' : 'not-allowed' }}>
        {saving ? 'Saving...' : 'Continue to Review →'}
      </button>
    </form>
  );
}

export default function AgreementsPage({ params }) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const programId = params?.id;

  return (
    <div style={{ minHeight: '100vh', background: 'var(--bg-dark)' }}>
      <nav style={{ background: 'var(--bg-card)', borderBottom: '1px solid var(--border)', padding: '0 1.5rem', display: 'flex', alignItems: 'center', justifyContent: 'space-between', height: '64px', position: 'sticky', top: 0, zIndex: 100 }}>
        <a href="/register" style={{ display: 'flex', alignItems: 'center', textDecoration: 'none' }}>
          <Image src="/images/tyt-logo.png" alt="Triboro Youth Theatre" width={48} height={48} style={{ objectFit: 'contain' }} />
        </a>
        <span style={{ fontFamily: 'var(--font-display)', fontSize: '1.1rem', fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase', color: 'var(--text-primary)' }}>Registration</span>
        <a href={`/register/${programId}?participant=${''}`} style={{ fontFamily: 'var(--font-display)', fontSize: '0.75rem', fontWeight: 600, letterSpacing: '0.1em', textTransform: 'uppercase', color: 'var(--gold)', textDecoration: 'none', border: '1px solid var(--gold)', borderRadius: 'var(--radius-sm)', padding: '0.35rem 0.85rem' }}>← Back</a>
      </nav>

      <StepBar />

      <main style={{ maxWidth: '680px', margin: '0 auto', padding: '2rem 1.5rem' }}>
        <Suspense fallback={<div style={{ textAlign: 'center', color: 'var(--text-muted)', padding: '3rem', fontFamily: 'var(--font-accent)', fontStyle: 'italic' }}>Loading...</div>}>
          <AgreementsForm programId={programId} />
        </Suspense>
      </main>

      <style>{`.doc-content p{margin-bottom:.75rem;}.doc-content ul{margin:.5rem 0 .75rem 1.25rem;}.doc-content li{margin-bottom:.3rem;}.doc-content strong{color:var(--text-primary);}.doc-content a{color:var(--red);}`}</style>
    </div>
  );
}