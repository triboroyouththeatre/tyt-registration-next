'use client';

import { useState, useEffect, Suspense } from 'react';
import { createClient } from '@/lib/supabase/client';
import { useRouter } from 'next/navigation';
import Image from 'next/image';

function AddParticipantForm() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [genders, setGenders] = useState([]);
  const [gradeLevels, setGradeLevels] = useState([]);

  const [form, setForm] = useState({
    first_name: '',
    last_name: '',
    nickname: '',
    date_of_birth: '',
    yog: '',
    gender_id: '',
    phone: '',
    email: '',
  });

  const [yogLabel, setYogLabel] = useState('');
  const [yogConfirmed, setYogConfirmed] = useState(false);

  useEffect(() => {
    async function loadData() {
      const supabase = createClient();
      const { data: genderData } = await supabase
        .from('genders')
        .select('*')
        .order('label');
      const { data: gradeData } = await supabase
        .from('grade_levels')
        .select('*, seasons(is_active)')
        .order('yog');
      setGenders(genderData || []);
      setGradeLevels(gradeData || []);
    }
    loadData();
  }, []);

  useEffect(() => {
    if (!form.date_of_birth) {
      setForm(f => ({ ...f, yog: '' }));
      setYogLabel('');
      setYogConfirmed(false);
      return;
    }

    const dob = new Date(form.date_of_birth);
    const today = new Date();
    const currentMonth = today.getMonth();

    // School year starts Sept 1
    // If we are before Sept, school year started last calendar year
    const schoolYearStart = currentMonth >= 8
      ? today.getFullYear()
      : today.getFullYear() - 1;

    const sept1 = new Date(schoolYearStart, 8, 1);

    // Age as of Sept 1 of the current school year
    let ageAtSept = sept1.getFullYear() - dob.getFullYear();
    const mDiff = sept1.getMonth() - dob.getMonth();
    if (mDiff < 0 || (mDiff === 0 && sept1.getDate() < dob.getDate())) {
      ageAtSept--;
    }

    // Grade number: 0 = Kindergarten, 12 = 12th grade
    const gradeNum = ageAtSept - 5;

    if (gradeNum >= 0 && gradeNum <= 12) {
      // YOG = end of school year they finish 12th grade
      const calculatedYog = schoolYearStart + 1 + (12 - gradeNum);
      setForm(f => ({ ...f, yog: calculatedYog }));
      const match = gradeLevels.find(g => g.yog === calculatedYog);
      setYogLabel(match?.label || `Class of ${calculatedYog}`);
      setYogConfirmed(false);
    } else {
      setForm(f => ({ ...f, yog: '' }));
      setYogLabel('');
      setYogConfirmed(false);
    }
  }, [form.date_of_birth, gradeLevels]);

  function handleChange(e) {
    const { name, value } = e.target;
    setForm(f => ({ ...f, [name]: value }));
  }

  async function handleSubmit(e) {
    e.preventDefault();
    setError('');

    if (!yogConfirmed) {
      setError('Please confirm the year of graduation before continuing.');
      return;
    }

    setLoading(true);

    const supabase = createClient();
    const { data: { user } } = await supabase.auth.getUser();
    const { data: profile } = await supabase
      .from('profiles')
      .select('family_id')
      .eq('id', user.id)
      .single();

    if (!profile?.family_id) {
      setError('No family account found. Please contact support.');
      setLoading(false);
      return;
    }

    const { error: insertError } = await supabase
      .from('participants')
      .insert({
        family_id: profile.family_id,
        first_name: form.first_name.trim(),
        last_name: form.last_name.trim(),
        nickname: form.nickname.trim() || null,
        date_of_birth: form.date_of_birth,
        yog: parseInt(form.yog),
        gender_id: form.gender_id,
        phone: form.phone.trim() || null,
        email: form.email.trim() || null,
      });

    if (insertError) {
      setError(insertError.message);
      setLoading(false);
      return;
    }

    router.push('/dashboard');
    router.refresh();
  }

  return (
    <form onSubmit={handleSubmit}>
      {error && <div className="tyt-error">{error}</div>}

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem', marginBottom: '1.25rem' }}>
        <div>
          <label className="tyt-label">
            First Name <span style={{ color: 'var(--red)' }}>*</span>
          </label>
          <input
            type="text"
            name="first_name"
            value={form.first_name}
            onChange={handleChange}
            required
            placeholder="First name"
            className="tyt-input"
          />
        </div>
        <div>
          <label className="tyt-label">
            Last Name <span style={{ color: 'var(--red)' }}>*</span>
          </label>
          <input
            type="text"
            name="last_name"
            value={form.last_name}
            onChange={handleChange}
            required
            placeholder="Last name"
            className="tyt-input"
          />
        </div>
      </div>

      <div style={{ marginBottom: '1.25rem' }}>
        <label className="tyt-label">
          Preferred Name / Nickname{' '}
          <span style={{ color: 'var(--text-faint)', fontWeight: 400, textTransform: 'none', letterSpacing: 0 }}>
            (optional)
          </span>
        </label>
        <input
          type="text"
          name="nickname"
          value={form.nickname}
          onChange={handleChange}
          placeholder="What do they like to be called?"
          className="tyt-input"
        />
      </div>

      <div style={{ marginBottom: '1.25rem' }}>
        <label className="tyt-label">
          Date of Birth <span style={{ color: 'var(--red)' }}>*</span>
        </label>
        <input
          type="date"
          name="date_of_birth"
          value={form.date_of_birth}
          onChange={handleChange}
          required
          className="tyt-input"
          style={{ colorScheme: 'dark' }}
        />
      </div>

      {form.yog && (
        <div style={{
          background: yogConfirmed ? '#0d1a0a' : '#1a1400',
          border: '1px solid var(--gold)',
          borderRadius: 'var(--radius-md)',
          padding: '1.25rem',
          marginBottom: '1.25rem',
        }}>
          <p style={{
            fontFamily: 'var(--font-display)',
            fontSize: '0.75rem',
            fontWeight: 600,
            letterSpacing: '0.12em',
            textTransform: 'uppercase',
            color: 'var(--text-muted)',
            marginBottom: '0.5rem',
          }}>
            Calculated Year of Graduation
          </p>
          <p style={{
            fontFamily: 'var(--font-display)',
            fontSize: '1.6rem',
            fontWeight: 800,
            color: 'var(--gold)',
            marginBottom: '0.25rem',
            lineHeight: 1,
          }}>
            {form.yog}
          </p>
          <p style={{
            fontFamily: 'var(--font-accent)',
            fontStyle: 'italic',
            color: 'var(--text-muted)',
            fontSize: '0.9rem',
            marginBottom: '1rem',
          }}>
            {yogLabel}
          </p>

          {!yogConfirmed ? (
            <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap', alignItems: 'center' }}>
              <button
                type="button"
                onClick={() => setYogConfirmed(true)}
                className="tyt-btn tyt-btn-gold"
                style={{ fontSize: '0.8rem', padding: '0.5rem 1.25rem' }}
              >
                Yes, that&apos;s correct
              </button>
              <span style={{ fontFamily: 'var(--font-body)', fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                Not right?{' '}
                <button
                  type="button"
                  onClick={() => {
                    setForm(f => ({ ...f, date_of_birth: '', yog: '' }));
                    setYogLabel('');
                  }}
                  style={{
                    background: 'none',
                    border: 'none',
                    color: 'var(--gold)',
                    cursor: 'pointer',
                    fontFamily: 'var(--font-body)',
                    fontSize: '0.8rem',
                    padding: 0,
                    textDecoration: 'underline',
                  }}
                >
                  Re-enter date of birth
                </button>
              </span>
            </div>
          ) : (
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <span style={{ color: 'var(--gold)', fontSize: '1.1rem' }}>✓</span>
              <span style={{ fontFamily: 'var(--font-body)', fontSize: '0.85rem', color: 'var(--gold)' }}>
                Confirmed
              </span>
              <button
                type="button"
                onClick={() => setYogConfirmed(false)}
                style={{
                  background: 'none',
                  border: 'none',
                  color: 'var(--text-faint)',
                  cursor: 'pointer',
                  fontFamily: 'var(--font-body)',
                  fontSize: '0.8rem',
                  padding: 0,
                  marginLeft: '0.5rem',
                  textDecoration: 'underline',
                }}
              >
                Change
              </button>
            </div>
          )}
        </div>
      )}

      <div style={{ marginBottom: '1.25rem' }}>
        <label className="tyt-label">
          Gender <span style={{ color: 'var(--red)' }}>*</span>
        </label>
        <select
          name="gender_id"
          value={form.gender_id}
          onChange={handleChange}
          required
          className="tyt-input"
        >
          <option value="">Select gender</option>
          {genders.map(g => (
            <option key={g.id} value={g.id}>{g.label}</option>
          ))}
        </select>
      </div>

      <hr className="tyt-divider" />

      <p style={{
        fontFamily: 'var(--font-accent)',
        fontStyle: 'italic',
        color: 'var(--text-muted)',
        fontSize: '0.875rem',
        marginBottom: '1.25rem',
        lineHeight: 1.6,
      }}>
        The following fields are optional. Only complete them if the participant
        has their own contact information that is different from their parent or guardian.
      </p>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem', marginBottom: '1.75rem' }}>
        <div>
          <label className="tyt-label">Participant Mobile</label>
          <input
            type="tel"
            name="phone"
            value={form.phone}
            onChange={handleChange}
            placeholder="(401) 555-0000"
            className="tyt-input"
          />
        </div>
        <div>
          <label className="tyt-label">Participant Email</label>
          <input
            type="email"
            name="email"
            value={form.email}
            onChange={handleChange}
            placeholder="participant@example.com"
            className="tyt-input"
          />
        </div>
      </div>

      <div style={{ display: 'flex', gap: '1rem', flexWrap: 'wrap' }}>
        <button
          type="submit"
          disabled={loading}
          className="tyt-btn tyt-btn-primary"
          style={{ flex: 1 }}
        >
          {loading ? 'Saving...' : 'Add Participant'}
        </button>
        <a
          href="/dashboard"
          className="tyt-btn tyt-btn-secondary"
          style={{ flex: 1, textAlign: 'center' }}
        >
          Cancel
        </a>
      </div>
    </form>
  );
}

export default function AddParticipantPage() {
  return (
    <div style={{ minHeight: '100vh', background: 'var(--bg-dark)' }}>
      <nav style={{
        background: 'var(--bg-card)',
        borderBottom: '1px solid var(--border)',
        padding: '0 1.5rem',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        height: '64px',
        position: 'sticky',
        top: 0,
        zIndex: 100,
      }}>
        <a href="/dashboard" style={{ display: 'flex', alignItems: 'center', textDecoration: 'none' }}>
          <Image
            src="/images/tyt-logo.png"
            alt="Triboro Youth Theatre"
            width={48}
            height={48}
            style={{ objectFit: 'contain' }}
          />
        </a>
        <span style={{
          fontFamily: 'var(--font-display)',
          fontSize: '1.1rem',
          fontWeight: 700,
          letterSpacing: '0.08em',
          textTransform: 'uppercase',
          color: 'var(--text-primary)',
        }}>
          Add Participant
        </span>
        <a href="/dashboard" style={{
          fontFamily: 'var(--font-display)',
          fontSize: '0.75rem',
          fontWeight: 600,
          letterSpacing: '0.1em',
          textTransform: 'uppercase',
          color: 'var(--text-muted)',
          textDecoration: 'none',
        }}>
          Back
        </a>
      </nav>

      <main style={{ maxWidth: '600px', margin: '0 auto', padding: '2rem 1.5rem' }}>
        <div style={{ marginBottom: '2rem' }}>
          <h1 style={{
            fontFamily: 'var(--font-display)',
            fontSize: '2rem',
            fontWeight: 800,
            letterSpacing: '0.05em',
            textTransform: 'uppercase',
            color: 'var(--text-primary)',
            marginBottom: '0.25rem',
          }}>
            Add Participant
          </h1>
          <p style={{
            fontFamily: 'var(--font-accent)',
            fontStyle: 'italic',
            color: 'var(--text-muted)',
            fontSize: '1rem',
          }}>
            Tell us about the person who will be participating in TYT programs.
          </p>
        </div>

        <div className="tyt-card">
          <Suspense fallback={
            <div style={{ textAlign: 'center', color: 'var(--text-muted)', padding: '1rem' }}>
              Loading...
            </div>
          }>
            <AddParticipantForm />
          </Suspense>
        </div>
      </main>
    </div>
  );
}