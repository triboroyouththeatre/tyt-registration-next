'use client';

import { useState, useEffect, Suspense } from 'react';
import { createClient } from '@/lib/supabase/client';
import { useRouter, useSearchParams, useParams } from 'next/navigation';
import Image from 'next/image';

const AWARD_LEVELS = [
  { id: '386e44d8-0a4d-4462-85f1-adaa8231a287', label: 'No Award',      show_count: 0  },
  { id: 'a502ce6b-bb14-4d74-b46e-48f2a99b9066', label: '5 Show Award',  show_count: 5  },
  { id: '7dbcd732-c2d9-4571-ae2f-32ee7cde1a7e', label: '10 Show Award', show_count: 10 },
  { id: '6d2de5d1-55aa-4939-a87f-dbd34cc640db', label: '15 Show Award', show_count: 15 },
  { id: '09479537-63e1-44f5-bd2e-20e84ac66dd1', label: '20 Show Award', show_count: 20 },
  { id: '576fad59-97da-45b8-9b77-5b61641f4127', label: '25 Show Award', show_count: 25 },
  { id: '73278f6a-a642-4ad3-ad4d-d6012b9a0a03', label: '30 Show Award', show_count: 30 },
  { id: '4ee7fa1e-e3e8-485b-bb61-3e8a4949a869', label: '35 Show Award', show_count: 35 },
];

function YesNo({ name, value, onChange }) {
  return (
    <div style={{ display: 'flex', gap: '0.5rem' }}>
      <button type="button" onClick={() => onChange(name, true)} style={{
        fontFamily: 'var(--font-display)', fontSize: '0.75rem', fontWeight: 700,
        letterSpacing: '0.1em', textTransform: 'uppercase', padding: '0.35rem 1rem',
        borderRadius: 'var(--radius-sm)',
        border: `1px solid ${value === true ? 'var(--red)' : 'var(--border)'}`,
        background: value === true ? 'var(--red)' : 'transparent',
        color: value === true ? '#fff' : 'var(--text-muted)',
        cursor: 'pointer', transition: 'all 0.15s',
      }}>Yes</button>
      <button type="button" onClick={() => onChange(name, false)} style={{
        fontFamily: 'var(--font-display)', fontSize: '0.75rem', fontWeight: 700,
        letterSpacing: '0.1em', textTransform: 'uppercase', padding: '0.35rem 1rem',
        borderRadius: 'var(--radius-sm)',
        border: `1px solid ${value === false ? 'var(--gold)' : 'var(--border)'}`,
        background: 'transparent',
        color: value === false ? 'var(--gold)' : 'var(--text-muted)',
        cursor: 'pointer', transition: 'all 0.15s',
      }}>No</button>
    </div>
  );
}

function HealthQuestion({ title, description, name, value, onChange, children }) {
  return (
    <div style={{
      background: 'var(--bg-card)',
      border: `1px solid ${value === true ? 'var(--red)' : 'var(--border)'}`,
      borderRadius: 'var(--radius-md)', overflow: 'hidden', marginBottom: '0.75rem',
    }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '1rem', padding: '1rem 1.25rem', flexWrap: 'wrap' }}>
        <div style={{ flex: 1, minWidth: 0 }}>
          <p style={{ fontFamily: 'var(--font-display)', fontSize: '0.85rem', fontWeight: 700, letterSpacing: '0.05em', textTransform: 'uppercase', color: 'var(--text-primary)', marginBottom: '0.2rem' }}>{title}</p>
          <p style={{ fontFamily: 'var(--font-body)', fontSize: '0.8rem', color: 'var(--text-muted)' }}>{description}</p>
        </div>
        <div style={{ flexShrink: 0 }}>
          <YesNo name={name} value={value} onChange={onChange} />
        </div>
      </div>
      {value === true && children && (
        <div style={{ borderTop: '1px solid var(--border)', padding: '1rem 1.25rem', background: 'var(--bg-hover)' }}>
          {children}
        </div>
      )}
    </div>
  );
}

const EMPTY_FORM = {
  award_level_id: '',
  academic_flag: null, academic_notes: '',
  behavioral_flag: null, behavioral_notes: '',
  allergies_flag: null, allergies_notes: '', epipen: null,
  asthma: null,
  concussion_flag: null, concussion_date: '', concussion_cleared: null,
  concussion_symptoms: null, concussion_symptoms_notes: '',
  general_comments: '',
};

function HealthForm({ programId }) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const participantId = searchParams.get('participant');

  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [participant, setParticipant] = useState(null);
  const [program, setProgram] = useState(null);
  const [medicalAuth, setMedicalAuth] = useState(false);
  const [form, setForm] = useState(EMPTY_FORM);

  useEffect(() => {
    async function load() {
      if (!participantId) return;
      const supabase = createClient();
      const [{ data: p }, { data: prog }] = await Promise.all([
        supabase.from('participants').select('first_name, last_name').eq('id', participantId).single(),
        supabase.from('programs').select('label, sessions(name, seasons(display_name, name))').eq('id', programId).single(),
      ]);
      setParticipant(p);
      setProgram(prog);

      // Pre-fill from sessionStorage if returning via back button
      const saved = sessionStorage.getItem(`health_${programId}_${participantId}`);
      if (saved) {
        const parsed = JSON.parse(saved);
        setForm({
          award_level_id:            parsed.award_level_id            ?? '',
          academic_flag:             parsed.academic_flag             ?? null,
          academic_notes:            parsed.academic_notes            || '',
          behavioral_flag:           parsed.behavioral_flag           ?? null,
          behavioral_notes:          parsed.behavioral_notes          || '',
          allergies_flag:            parsed.allergies_flag            ?? null,
          allergies_notes:           parsed.allergies_notes           || '',
          epipen:                    parsed.epipen                    ?? null,
          asthma:                    parsed.asthma                    ?? null,
          concussion_flag:           parsed.concussion_flag           ?? null,
          concussion_date:           parsed.concussion_date           || '',
          concussion_cleared:        parsed.concussion_cleared        ?? null,
          concussion_symptoms:       parsed.concussion_symptoms       ?? null,
          concussion_symptoms_notes: parsed.concussion_symptoms_notes || '',
          general_comments:          parsed.general_comments          || '',
        });
        if (parsed.medical_authorization) setMedicalAuth(true);
      }
    }
    load();
  }, [participantId, programId]);

  function handleYesNo(name, val) {
    setForm(f => ({ ...f, [name]: val }));
  }

  function handleChange(e) {
    setForm(f => ({ ...f, [e.target.name]: e.target.value }));
  }

  async function handleSubmit(e) {
    e.preventDefault();
    setError('');

    // Award level required
    if (!form.award_level_id) {
      setError('Please select an award level before continuing.');
      return;
    }

    // All Yes/No questions required
    const required = ['academic_flag', 'behavioral_flag', 'allergies_flag', 'asthma', 'concussion_flag'];
    for (const field of required) {
      if (form[field] === null) {
        setError('Please answer all Yes/No questions before continuing.');
        return;
      }
    }

    if (form.academic_flag && !form.academic_notes.trim()) { setError('Please describe the academic considerations.'); return; }
    if (form.behavioral_flag && !form.behavioral_notes.trim()) { setError('Please describe the behavioral considerations.'); return; }
    if (form.allergies_flag) {
      if (!form.allergies_notes.trim()) { setError('Please describe the allergies.'); return; }
      if (form.epipen === null) { setError('Please indicate whether the participant carries an EpiPen.'); return; }
    }
    if (form.concussion_flag) {
      if (!form.concussion_date) { setError('Please provide the date of the concussion.'); return; }
      if (form.concussion_cleared === null) { setError('Please indicate whether the participant has been medically cleared.'); return; }
      if (form.concussion_symptoms === null) { setError('Please indicate whether the participant is currently experiencing symptoms.'); return; }
      if (form.concussion_symptoms && !form.concussion_symptoms_notes.trim()) { setError('Please describe the current concussion symptoms.'); return; }
    }
    if (!medicalAuth) { setError('You must acknowledge the medical authorization before continuing.'); return; }

    setSaving(true);
    const healthData = { ...form, participant_id: participantId, program_id: programId, medical_authorization: true };
    sessionStorage.setItem(`health_${programId}_${participantId}`, JSON.stringify(healthData));
    router.push(`/register/${programId}/agreements?participant=${participantId}`);
  }

  const seasonDisplay = program?.sessions?.seasons?.display_name || program?.sessions?.seasons?.name;

  return (
    <form onSubmit={handleSubmit}>
      {error && <div className="tyt-error">{error}</div>}

      {/* Context banner */}
      {participant && program && (
        <div style={{ background: 'var(--bg-hover)', border: '1px solid var(--border)', borderRadius: 'var(--radius-sm)', padding: '0.875rem 1.25rem', marginBottom: '1.5rem' }}>
          <p style={{ fontFamily: 'var(--font-display)', fontSize: '0.7rem', fontWeight: 600, letterSpacing: '0.1em', textTransform: 'uppercase', color: 'var(--text-faint)', marginBottom: '0.2rem' }}>Registering</p>
          <p style={{ fontFamily: 'var(--font-display)', fontSize: '1rem', fontWeight: 700, color: 'var(--text-primary)' }}>{participant.first_name} {participant.last_name}</p>
          <p style={{ fontFamily: 'var(--font-body)', fontSize: '0.8rem', color: 'var(--text-muted)' }}>{program.label} · {seasonDisplay} Season · {program.sessions?.name} Session</p>
        </div>
      )}

      {/* ── Award Level ── */}
      <div style={{ background: 'var(--bg-card)', border: `1px solid ${form.award_level_id ? 'var(--gold)' : 'var(--border)'}`, borderRadius: 'var(--radius-md)', padding: '1.25rem', marginBottom: '1.5rem' }}>
        <p style={{ fontFamily: 'var(--font-display)', fontSize: '0.85rem', fontWeight: 700, letterSpacing: '0.05em', textTransform: 'uppercase', color: 'var(--text-primary)', marginBottom: '0.5rem' }}>
          Production Award <span style={{ color: 'var(--red)' }}>*</span>
        </p>
        <p style={{ fontFamily: 'var(--font-body)', fontSize: '0.82rem', color: 'var(--text-muted)', lineHeight: 1.65, marginBottom: '1rem' }}>
          We recognize actors who have participated in 5+ productions with TYT, in increments of 5. Please choose from the list if your actor is receiving an award at the conclusion of <strong style={{ color: 'var(--text-primary)' }}>this</strong> session.
        </p>
        <div style={{ background: '#1a0d00', border: '1px solid #b8860b', borderRadius: 'var(--radius-sm)', padding: '0.75rem 1rem', marginBottom: '1rem' }}>
          <p style={{ fontFamily: 'var(--font-body)', fontSize: '0.8rem', color: '#e0bf5c', lineHeight: 1.6 }}>
            <strong>Please note:</strong> This selection is the responsibility of the parent and <em>must</em> be chosen at the time of registration to ensure award delivery by showtime. While we try to avoid upset actors, last minute additions may not be accommodated.
          </p>
        </div>
        <select
          name="award_level_id"
          value={form.award_level_id}
          onChange={handleChange}
          className="tyt-input"
          style={{ maxWidth: '280px' }}
        >
          <option value="">— Select an award level —</option>
          {AWARD_LEVELS.map(level => (
            <option key={level.id} value={level.id}>
              {level.label}
            </option>
          ))}
        </select>
      </div>

      {/* ── Health Information ── */}
      <h2 style={{ fontFamily: 'var(--font-display)', fontSize: '1.1rem', fontWeight: 700, letterSpacing: '0.05em', textTransform: 'uppercase', color: 'var(--text-primary)', marginBottom: '0.25rem' }}>
        Health Information
      </h2>
      <p style={{ fontFamily: 'var(--font-accent)', fontStyle: 'italic', color: 'var(--text-muted)', fontSize: '0.9rem', marginBottom: '1.25rem' }}>
        All questions are required. This information is kept confidential and shared only with TYT staff as needed.
      </p>

      <HealthQuestion title="Academic Considerations" description="Does this participant have any academic considerations (IEP, 504, learning differences) TYT staff should be aware of?" name="academic_flag" value={form.academic_flag} onChange={handleYesNo}>
        <label className="tyt-label">Please describe <span style={{ color: 'var(--red)' }}>*</span></label>
        <textarea name="academic_notes" value={form.academic_notes} onChange={handleChange} rows={3} className="tyt-input" style={{ resize: 'vertical' }} placeholder="Provide any details that would help our staff..." />
      </HealthQuestion>

      <HealthQuestion title="Behavioral Considerations" description="Does this participant have any behavioral considerations (ADHD, anxiety, sensory sensitivities) TYT staff should be aware of?" name="behavioral_flag" value={form.behavioral_flag} onChange={handleYesNo}>
        <label className="tyt-label">Please describe <span style={{ color: 'var(--red)' }}>*</span></label>
        <textarea name="behavioral_notes" value={form.behavioral_notes} onChange={handleChange} rows={3} className="tyt-input" style={{ resize: 'vertical' }} placeholder="Provide any details that would help our staff..." />
      </HealthQuestion>

      <HealthQuestion title="Allergies" description="Does this participant have any known allergies (food, environmental, medication)?" name="allergies_flag" value={form.allergies_flag} onChange={handleYesNo}>
        <div style={{ marginBottom: '1rem' }}>
          <label className="tyt-label">Please describe <span style={{ color: 'var(--red)' }}>*</span></label>
          <textarea name="allergies_notes" value={form.allergies_notes} onChange={handleChange} rows={3} className="tyt-input" style={{ resize: 'vertical' }} placeholder="List allergies and any known reactions..." />
        </div>
        <div>
          <p style={{ fontFamily: 'var(--font-display)', fontSize: '0.75rem', fontWeight: 600, letterSpacing: '0.08em', textTransform: 'uppercase', color: 'var(--text-muted)', marginBottom: '0.5rem' }}>
            Does this participant carry an EpiPen? <span style={{ color: 'var(--red)' }}>*</span>
          </p>
          <YesNo name="epipen" value={form.epipen} onChange={handleYesNo} />
        </div>
      </HealthQuestion>

      <HealthQuestion title="Asthma" description="Does this participant have asthma?" name="asthma" value={form.asthma} onChange={handleYesNo} />

      <HealthQuestion title="Concussion History" description="Has this participant had a concussion within the past 12 months?" name="concussion_flag" value={form.concussion_flag} onChange={handleYesNo}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          <div>
            <label className="tyt-label">Date of concussion <span style={{ color: 'var(--red)' }}>*</span></label>
            <input type="date" name="concussion_date" value={form.concussion_date} onChange={handleChange} className="tyt-input" style={{ colorScheme: 'dark', maxWidth: '220px' }} />
          </div>
          <div>
            <p style={{ fontFamily: 'var(--font-display)', fontSize: '0.75rem', fontWeight: 600, letterSpacing: '0.08em', textTransform: 'uppercase', color: 'var(--text-muted)', marginBottom: '0.5rem' }}>
              Has the participant been medically cleared? <span style={{ color: 'var(--red)' }}>*</span>
            </p>
            <YesNo name="concussion_cleared" value={form.concussion_cleared} onChange={handleYesNo} />
          </div>
          <div>
            <p style={{ fontFamily: 'var(--font-display)', fontSize: '0.75rem', fontWeight: 600, letterSpacing: '0.08em', textTransform: 'uppercase', color: 'var(--text-muted)', marginBottom: '0.5rem' }}>
              Is the participant currently experiencing symptoms? <span style={{ color: 'var(--red)' }}>*</span>
            </p>
            <YesNo name="concussion_symptoms" value={form.concussion_symptoms} onChange={handleYesNo} />
          </div>
          {form.concussion_symptoms === true && (
            <div>
              <label className="tyt-label">Describe current symptoms <span style={{ color: 'var(--red)' }}>*</span></label>
              <textarea name="concussion_symptoms_notes" value={form.concussion_symptoms_notes} onChange={handleChange} rows={2} className="tyt-input" style={{ resize: 'vertical' }} />
            </div>
          )}
        </div>
      </HealthQuestion>

      {/* General comments */}
      <div className="tyt-card" style={{ marginBottom: '1.5rem' }}>
        <label className="tyt-label">
          Additional Comments{' '}
          <span style={{ color: 'var(--text-faint)', fontWeight: 400, textTransform: 'none', letterSpacing: 0 }}>(optional)</span>
        </label>
        <textarea name="general_comments" value={form.general_comments} onChange={handleChange} rows={3} className="tyt-input" style={{ resize: 'vertical' }} placeholder="Anything else TYT staff should know about this participant..." />
      </div>

      {/* Medical authorization */}
      <div style={{ background: '#1a0d00', border: `1px solid ${medicalAuth ? 'var(--gold)' : 'var(--border)'}`, borderRadius: 'var(--radius-md)', padding: '1.25rem', marginBottom: '1.75rem' }}>
        <p style={{ fontFamily: 'var(--font-display)', fontSize: '0.8rem', fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase', color: 'var(--gold)', marginBottom: '0.75rem' }}>
          Medical Authorization <span style={{ color: 'var(--red)' }}>*</span>
        </p>
        <p style={{ fontFamily: 'var(--font-body)', fontSize: '0.85rem', color: 'var(--text-muted)', lineHeight: 1.6, marginBottom: '1rem' }}>
          I hereby authorize Triboro Youth Theatre staff to seek emergency medical treatment for my child in the event that I cannot be reached. I understand that TYT will make every reasonable effort to contact me before seeking treatment.
        </p>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
          <input type="checkbox" id="medical_auth" checked={medicalAuth} onChange={e => setMedicalAuth(e.target.checked)} style={{ width: '16px', height: '16px', accentColor: 'var(--gold)', cursor: 'pointer', flexShrink: 0 }} />
          <label htmlFor="medical_auth" style={{ fontFamily: 'var(--font-body)', fontSize: '0.875rem', color: 'var(--text-primary)', cursor: 'pointer' }}>
            I acknowledge and agree to the above medical authorization
          </label>
        </div>
      </div>

      <button type="submit" disabled={saving} className="tyt-btn tyt-btn-primary tyt-btn-full">
        {saving ? 'Saving...' : 'Continue to Agreements →'}
      </button>
    </form>
  );
}

export default function HealthPage() {
  const params = useParams();
  const programId = params?.id;

  return (
    <div style={{ minHeight: '100vh', background: 'var(--bg-dark)' }}>
      <nav style={{ background: 'var(--bg-card)', borderBottom: '1px solid var(--border)', padding: '0 1.5rem', display: 'flex', alignItems: 'center', justifyContent: 'space-between', height: '64px', position: 'sticky', top: 0, zIndex: 100 }}>
        <a href="/dashboard" style={{ display: 'flex', alignItems: 'center', textDecoration: 'none' }}>
          <Image src="/images/tyt-logo.png" alt="Triboro Youth Theatre" width={48} height={48} style={{ objectFit: 'contain' }} />
        </a>
        <span style={{ fontFamily: 'var(--font-display)', fontSize: '1.1rem', fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase', color: 'var(--text-primary)' }}>Registration</span>
        <a href="/dashboard" style={{ fontFamily: 'var(--font-display)', fontSize: '0.75rem', fontWeight: 600, letterSpacing: '0.1em', textTransform: 'uppercase', color: 'var(--gold)', textDecoration: 'none', border: '1px solid var(--gold)', borderRadius: 'var(--radius-sm)', padding: '0.35rem 0.85rem' }}>← Back</a>
      </nav>

      <div style={{ background: 'var(--bg-card)', borderBottom: '1px solid var(--border)', padding: '0.75rem 1.5rem' }}>
        <div style={{ maxWidth: '680px', margin: '0 auto', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          {[
            { n: 1, label: 'Health',     active: true,  done: false },
            { n: 2, label: 'Agreements', active: false, done: false },
            { n: 3, label: 'Review',     active: false, done: false },
            { n: 4, label: 'Payment',    active: false, done: false },
          ].map((s, i, arr) => (
            <div key={s.n} style={{ display: 'flex', alignItems: 'center' }}>
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '0.2rem' }}>
                <div style={{ width: '28px', height: '28px', borderRadius: '50%', background: s.active ? 'var(--red)' : 'var(--bg-hover)', border: `2px solid ${s.active ? 'var(--red)' : 'var(--border)'}`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: 'var(--font-display)', fontSize: '0.75rem', fontWeight: 700, color: s.active ? '#fff' : 'var(--text-faint)' }}>
                  {s.n}
                </div>
                <span style={{ fontFamily: 'var(--font-display)', fontSize: '0.55rem', fontWeight: 600, letterSpacing: '0.08em', textTransform: 'uppercase', color: s.active ? 'var(--text-primary)' : 'var(--text-faint)', whiteSpace: 'nowrap' }}>{s.label}</span>
              </div>
              {i < arr.length - 1 && <div style={{ width: '40px', height: '2px', background: 'var(--border)', margin: '0 4px', marginBottom: '16px' }} />}
            </div>
          ))}
        </div>
      </div>

      <main style={{ maxWidth: '680px', margin: '0 auto', padding: '2rem 1.5rem' }}>
        <Suspense fallback={<div style={{ textAlign: 'center', color: 'var(--text-muted)', padding: '3rem', fontFamily: 'var(--font-accent)', fontStyle: 'italic' }}>Loading...</div>}>
          <HealthForm programId={programId} />
        </Suspense>
      </main>
    </div>
  );
}