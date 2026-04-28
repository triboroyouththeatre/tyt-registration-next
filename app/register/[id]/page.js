'use client';

import { useState, useEffect, Suspense } from 'react';
import { createClient } from '@/lib/supabase/client';
import { useRouter, useSearchParams } from 'next/navigation';
import Image from 'next/image';

function HealthForm({ programId }) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const participantId = searchParams.get('participant');

  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [participant, setParticipant] = useState(null);
  const [program, setProgram] = useState(null);

  const [form, setForm] = useState({
    // Academic
    academic_flag: false,
    academic_notes: '',
    // Behavioral
    behavioral_flag: false,
    behavioral_notes: '',
    // Allergies
    allergies_flag: false,
    allergies_notes: '',
    epipen: false,
    // Asthma
    asthma: false,
    // Concussion
    concussion_flag: false,
    concussion_date: '',
    concussion_cleared: false,
    concussion_symptoms: false,
    concussion_symptoms_notes: '',
    // General
    general_comments: '',
    // Medical authorization
    medical_authorization: false,
  });

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
    }
    load();
  }, [participantId, programId]);

  function handleCheck(e) {
    const { name, checked } = e.target;
    setForm(f => ({ ...f, [name]: checked }));
  }

  function handleChange(e) {
    const { name, value } = e.target;
    setForm(f => ({ ...f, [name]: value }));
  }

  async function handleSubmit(e) {
    e.preventDefault();
    setError('');

    if (!form.medical_authorization) {
      setError('You must acknowledge the medical authorization before continuing.');
      return;
    }

    setSaving(true);

    // Store health data in sessionStorage to use at final submission
    const healthData = { ...form, participant_id: participantId, program_id: programId };
    sessionStorage.setItem(`health_${programId}_${participantId}`, JSON.stringify(healthData));

    router.push(`/register/${programId}/agreements?participant=${participantId}`);
  }

  const seasonDisplay = program?.sessions?.seasons?.display_name || program?.sessions?.seasons?.name;

  return (
    <form onSubmit={handleSubmit}>
      {error && <div className="tyt-error">{error}</div>}

      {/* Participant & program context */}
      {participant && program && (
        <div style={{
          background: 'var(--bg-hover)',
          border: '1px solid var(--border)',
          borderRadius: 'var(--radius-sm)',
          padding: '0.875rem 1.25rem',
          marginBottom: '1.5rem',
        }}>
          <p style={{ fontFamily: 'var(--font-display)', fontSize: '0.7rem', fontWeight: 600, letterSpacing: '0.1em', textTransform: 'uppercase', color: 'var(--text-faint)', marginBottom: '0.2rem' }}>
            Registering
          </p>
          <p style={{ fontFamily: 'var(--font-display)', fontSize: '1rem', fontWeight: 700, color: 'var(--text-primary)' }}>
            {participant.first_name} {participant.last_name}
          </p>
          <p style={{ fontFamily: 'var(--font-body)', fontSize: '0.8rem', color: 'var(--text-muted)' }}>
            {program.label} · {seasonDisplay} Season · {program.sessions?.name} Session
          </p>
        </div>
      )}

      <h2 style={{ fontFamily: 'var(--font-display)', fontSize: '1.3rem', fontWeight: 700, letterSpacing: '0.05em', textTransform: 'uppercase', color: 'var(--text-primary)', marginBottom: '0.25rem' }}>
        Health Information
      </h2>
      <p style={{ fontFamily: 'var(--font-accent)', fontStyle: 'italic', color: 'var(--text-muted)', fontSize: '0.9rem', marginBottom: '1.5rem' }}>
        This information is kept confidential and shared only with TYT staff as needed.
        All fields must be completed for each registration.
      </p>

      {/* Academic */}
      <div className="tyt-card" style={{ marginBottom: '1rem' }}>
        <div style={{ display: 'flex', alignItems: 'flex-start', gap: '1rem', marginBottom: form.academic_flag ? '1rem' : 0 }}>
          <input
            type="checkbox"
            id="academic_flag"
            name="academic_flag"
            checked={form.academic_flag}
            onChange={handleCheck}
            style={{ width: '16px', height: '16px', accentColor: 'var(--red)', cursor: 'pointer', marginTop: '3px', flexShrink: 0 }}
          />
          <label htmlFor="academic_flag" style={{ cursor: 'pointer' }}>
            <p style={{ fontFamily: 'var(--font-display)', fontSize: '0.85rem', fontWeight: 700, letterSpacing: '0.05em', textTransform: 'uppercase', color: 'var(--text-primary)', marginBottom: '0.2rem' }}>
              Academic Considerations
            </p>
            <p style={{ fontFamily: 'var(--font-body)', fontSize: '0.8rem', color: 'var(--text-muted)' }}>
              Does this participant have any academic considerations (IEP, 504, learning differences) that TYT staff should be aware of?
            </p>
          </label>
        </div>
        {form.academic_flag && (
          <div style={{ marginLeft: '28px' }}>
            <label className="tyt-label">Please describe</label>
            <textarea
              name="academic_notes"
              value={form.academic_notes}
              onChange={handleChange}
              rows={3}
              className="tyt-input"
              style={{ resize: 'vertical' }}
              placeholder="Provide any details that would help our staff..."
            />
          </div>
        )}
      </div>

      {/* Behavioral */}
      <div className="tyt-card" style={{ marginBottom: '1rem' }}>
        <div style={{ display: 'flex', alignItems: 'flex-start', gap: '1rem', marginBottom: form.behavioral_flag ? '1rem' : 0 }}>
          <input
            type="checkbox"
            id="behavioral_flag"
            name="behavioral_flag"
            checked={form.behavioral_flag}
            onChange={handleCheck}
            style={{ width: '16px', height: '16px', accentColor: 'var(--red)', cursor: 'pointer', marginTop: '3px', flexShrink: 0 }}
          />
          <label htmlFor="behavioral_flag" style={{ cursor: 'pointer' }}>
            <p style={{ fontFamily: 'var(--font-display)', fontSize: '0.85rem', fontWeight: 700, letterSpacing: '0.05em', textTransform: 'uppercase', color: 'var(--text-primary)', marginBottom: '0.2rem' }}>
              Behavioral Considerations
            </p>
            <p style={{ fontFamily: 'var(--font-body)', fontSize: '0.8rem', color: 'var(--text-muted)' }}>
              Does this participant have any behavioral considerations (ADHD, anxiety, sensory sensitivities) that TYT staff should be aware of?
            </p>
          </label>
        </div>
        {form.behavioral_flag && (
          <div style={{ marginLeft: '28px' }}>
            <label className="tyt-label">Please describe</label>
            <textarea
              name="behavioral_notes"
              value={form.behavioral_notes}
              onChange={handleChange}
              rows={3}
              className="tyt-input"
              style={{ resize: 'vertical' }}
              placeholder="Provide any details that would help our staff..."
            />
          </div>
        )}
      </div>

      {/* Allergies */}
      <div className="tyt-card" style={{ marginBottom: '1rem' }}>
        <div style={{ display: 'flex', alignItems: 'flex-start', gap: '1rem', marginBottom: form.allergies_flag ? '1rem' : 0 }}>
          <input
            type="checkbox"
            id="allergies_flag"
            name="allergies_flag"
            checked={form.allergies_flag}
            onChange={handleCheck}
            style={{ width: '16px', height: '16px', accentColor: 'var(--red)', cursor: 'pointer', marginTop: '3px', flexShrink: 0 }}
          />
          <label htmlFor="allergies_flag" style={{ cursor: 'pointer' }}>
            <p style={{ fontFamily: 'var(--font-display)', fontSize: '0.85rem', fontWeight: 700, letterSpacing: '0.05em', textTransform: 'uppercase', color: 'var(--text-primary)', marginBottom: '0.2rem' }}>
              Allergies
            </p>
            <p style={{ fontFamily: 'var(--font-body)', fontSize: '0.8rem', color: 'var(--text-muted)' }}>
              Does this participant have any known allergies (food, environmental, medication)?
            </p>
          </label>
        </div>
        {form.allergies_flag && (
          <div style={{ marginLeft: '28px' }}>
            <label className="tyt-label">Please describe</label>
            <textarea
              name="allergies_notes"
              value={form.allergies_notes}
              onChange={handleChange}
              rows={3}
              className="tyt-input"
              style={{ resize: 'vertical' }}
              placeholder="List allergies and any known reactions..."
            />
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginTop: '0.75rem' }}>
              <input
                type="checkbox"
                id="epipen"
                name="epipen"
                checked={form.epipen}
                onChange={handleCheck}
                style={{ width: '16px', height: '16px', accentColor: 'var(--red)', cursor: 'pointer', flexShrink: 0 }}
              />
              <label htmlFor="epipen" style={{ fontFamily: 'var(--font-body)', fontSize: '0.875rem', color: 'var(--text-primary)', cursor: 'pointer' }}>
                This participant carries an EpiPen
              </label>
            </div>
          </div>
        )}
      </div>

      {/* Asthma */}
      <div className="tyt-card" style={{ marginBottom: '1rem' }}>
        <div style={{ display: 'flex', alignItems: 'flex-start', gap: '1rem' }}>
          <input
            type="checkbox"
            id="asthma"
            name="asthma"
            checked={form.asthma}
            onChange={handleCheck}
            style={{ width: '16px', height: '16px', accentColor: 'var(--red)', cursor: 'pointer', marginTop: '3px', flexShrink: 0 }}
          />
          <label htmlFor="asthma" style={{ cursor: 'pointer' }}>
            <p style={{ fontFamily: 'var(--font-display)', fontSize: '0.85rem', fontWeight: 700, letterSpacing: '0.05em', textTransform: 'uppercase', color: 'var(--text-primary)', marginBottom: '0.2rem' }}>
              Asthma
            </p>
            <p style={{ fontFamily: 'var(--font-body)', fontSize: '0.8rem', color: 'var(--text-muted)' }}>
              Does this participant have asthma?
            </p>
          </label>
        </div>
      </div>

      {/* Concussion */}
      <div className="tyt-card" style={{ marginBottom: '1rem' }}>
        <div style={{ display: 'flex', alignItems: 'flex-start', gap: '1rem', marginBottom: form.concussion_flag ? '1rem' : 0 }}>
          <input
            type="checkbox"
            id="concussion_flag"
            name="concussion_flag"
            checked={form.concussion_flag}
            onChange={handleCheck}
            style={{ width: '16px', height: '16px', accentColor: 'var(--red)', cursor: 'pointer', marginTop: '3px', flexShrink: 0 }}
          />
          <label htmlFor="concussion_flag" style={{ cursor: 'pointer' }}>
            <p style={{ fontFamily: 'var(--font-display)', fontSize: '0.85rem', fontWeight: 700, letterSpacing: '0.05em', textTransform: 'uppercase', color: 'var(--text-primary)', marginBottom: '0.2rem' }}>
              Concussion History
            </p>
            <p style={{ fontFamily: 'var(--font-body)', fontSize: '0.8rem', color: 'var(--text-muted)' }}>
              Has this participant had a concussion within the past 12 months?
            </p>
          </label>
        </div>
        {form.concussion_flag && (
          <div style={{ marginLeft: '28px', display: 'flex', flexDirection: 'column', gap: '1rem' }}>
            <div>
              <label className="tyt-label">Date of concussion <span style={{ color: 'var(--red)' }}>*</span></label>
              <input
                type="date"
                name="concussion_date"
                value={form.concussion_date}
                onChange={handleChange}
                required={form.concussion_flag}
                className="tyt-input"
                style={{ colorScheme: 'dark', maxWidth: '220px' }}
              />
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
              <input
                type="checkbox"
                id="concussion_cleared"
                name="concussion_cleared"
                checked={form.concussion_cleared}
                onChange={handleCheck}
                style={{ width: '16px', height: '16px', accentColor: 'var(--red)', cursor: 'pointer', flexShrink: 0 }}
              />
              <label htmlFor="concussion_cleared" style={{ fontFamily: 'var(--font-body)', fontSize: '0.875rem', color: 'var(--text-primary)', cursor: 'pointer' }}>
                Participant has been medically cleared
              </label>
            </div>
            <div style={{ display: 'flex', alignItems: 'flex-start', gap: '0.75rem' }}>
              <input
                type="checkbox"
                id="concussion_symptoms"
                name="concussion_symptoms"
                checked={form.concussion_symptoms}
                onChange={handleCheck}
                style={{ width: '16px', height: '16px', accentColor: 'var(--red)', cursor: 'pointer', marginTop: '3px', flexShrink: 0 }}
              />
              <label htmlFor="concussion_symptoms" style={{ fontFamily: 'var(--font-body)', fontSize: '0.875rem', color: 'var(--text-primary)', cursor: 'pointer' }}>
                Participant is currently experiencing symptoms
              </label>
            </div>
            {form.concussion_symptoms && (
              <div>
                <label className="tyt-label">Describe current symptoms</label>
                <textarea
                  name="concussion_symptoms_notes"
                  value={form.concussion_symptoms_notes}
                  onChange={handleChange}
                  rows={2}
                  className="tyt-input"
                  style={{ resize: 'vertical' }}
                />
              </div>
            )}
          </div>
        )}
      </div>

      {/* General comments */}
      <div className="tyt-card" style={{ marginBottom: '1.5rem' }}>
        <label className="tyt-label">
          Additional Comments{' '}
          <span style={{ color: 'var(--text-faint)', fontWeight: 400, textTransform: 'none', letterSpacing: 0 }}>(optional)</span>
        </label>
        <textarea
          name="general_comments"
          value={form.general_comments}
          onChange={handleChange}
          rows={3}
          className="tyt-input"
          style={{ resize: 'vertical' }}
          placeholder="Anything else TYT staff should know about this participant..."
        />
      </div>

      {/* Medical authorization */}
      <div style={{
        background: '#1a0d00',
        border: '1px solid var(--gold)',
        borderRadius: 'var(--radius-md)',
        padding: '1.25rem',
        marginBottom: '1.75rem',
      }}>
        <div style={{ display: 'flex', alignItems: 'flex-start', gap: '1rem' }}>
          <input
            type="checkbox"
            id="medical_authorization"
            name="medical_authorization"
            checked={form.medical_authorization}
            onChange={handleCheck}
            style={{ width: '16px', height: '16px', accentColor: 'var(--gold)', cursor: 'pointer', marginTop: '3px', flexShrink: 0 }}
          />
          <label htmlFor="medical_authorization" style={{ cursor: 'pointer' }}>
            <p style={{ fontFamily: 'var(--font-display)', fontSize: '0.8rem', fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase', color: 'var(--gold)', marginBottom: '0.4rem' }}>
              Medical Authorization <span style={{ color: 'var(--red)' }}>*</span>
            </p>
            <p style={{ fontFamily: 'var(--font-body)', fontSize: '0.85rem', color: 'var(--text-muted)', lineHeight: 1.6 }}>
              I hereby authorize Triboro Youth Theatre staff to seek emergency medical treatment for my child
              in the event that I cannot be reached. I understand that TYT will make every reasonable effort
              to contact me before seeking treatment.
            </p>
          </label>
        </div>
      </div>

      <button
        type="submit"
        disabled={saving}
        className="tyt-btn tyt-btn-primary tyt-btn-full"
      >
        {saving ? 'Saving...' : 'Continue to Agreements →'}
      </button>
    </form>
  );
}

export default function HealthPage({ params }) {
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

      {/* Step indicator */}
      <div style={{ background: 'var(--bg-card)', borderBottom: '1px solid var(--border)', padding: '0.75rem 1.5rem' }}>
        <div style={{ maxWidth: '680px', margin: '0 auto', display: 'flex', gap: '0', alignItems: 'center' }}>
          {[
            { n: 1, label: 'Health', active: true },
            { n: 2, label: 'Agreements', active: false },
            { n: 3, label: 'Review', active: false },
            { n: 4, label: 'Payment', active: false },
          ].map((s, i, arr) => (
            <div key={s.n} style={{ display: 'flex', alignItems: 'center' }}>
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '0.2rem' }}>
                <div style={{
                  width: '28px', height: '28px', borderRadius: '50%',
                  background: s.active ? 'var(--red)' : 'var(--bg-hover)',
                  border: `2px solid ${s.active ? 'var(--red)' : 'var(--border)'}`,
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontFamily: 'var(--font-display)', fontSize: '0.75rem', fontWeight: 700,
                  color: s.active ? '#fff' : 'var(--text-faint)',
                }}>
                  {s.n}
                </div>
                <span style={{ fontFamily: 'var(--font-display)', fontSize: '0.55rem', fontWeight: 600, letterSpacing: '0.08em', textTransform: 'uppercase', color: s.active ? 'var(--text-primary)' : 'var(--text-faint)', whiteSpace: 'nowrap' }}>
                  {s.label}
                </span>
              </div>
              {i < arr.length - 1 && (
                <div style={{ width: '40px', height: '2px', background: 'var(--border)', margin: '0 4px', marginBottom: '16px' }} />
              )}
            </div>
          ))}
        </div>
      </div>

      <main style={{ maxWidth: '680px', margin: '0 auto', padding: '2rem 1.5rem' }}>
        <Suspense fallback={
          <div style={{ textAlign: 'center', color: 'var(--text-muted)', padding: '3rem', fontFamily: 'var(--font-accent)', fontStyle: 'italic' }}>
            Loading...
          </div>
        }>
          <HealthForm programId={programId} />
        </Suspense>
      </main>
    </div>
  );
}