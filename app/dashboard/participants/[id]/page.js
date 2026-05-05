'use client';

import { useState, useEffect, Suspense } from 'react';
import { createClient } from '@/lib/supabase/client';
import { useRouter, useParams } from 'next/navigation';
import Image from 'next/image';
import { fmtPhone } from '@/lib/format';

function ParticipantDetail() {
  const router = useRouter();
  const params = useParams();
  const participantId = params.id;

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [editing, setEditing] = useState(false);
  const [genders, setGenders] = useState([]);
  const [gradeLevels, setGradeLevels] = useState([]);
  const [registrations, setRegistrations] = useState([]);
  const [participant, setParticipant] = useState(null);

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
  const [yogConfirmed, setYogConfirmed] = useState(true);
  const [dobChanged, setDobChanged] = useState(false);

  useEffect(() => {
    async function loadData() {
      const supabase = createClient();

      const [
        { data: genderData },
        { data: gradeData },
        { data: participantData },
        { data: regData },
      ] = await Promise.all([
        supabase.from('genders').select('id, label').order('label'),
        supabase
          .from('grade_levels')
          .select('id, yog, label, seasons!inner(is_active)')
          .eq('seasons.is_active', true)
          .order('yog'),
        supabase
          .from('participants')
          .select('*, genders(label)')
          .eq('id', participantId)
          .single(),
        supabase
          .from('registrations')
          .select(`
            id,
            registration_number,
            registered_at,
            award_level_id,
            award_levels(label),
            registration_statuses(label),
            carts(
              programs(
                label,
                sessions(
                  name,
                  seasons(name, display_name)
                )
              )
            )
          `)
          .eq('participant_id', participantId)
          .order('registered_at', { ascending: false }),
      ]);

      setGenders(genderData || []);
      setGradeLevels(gradeData || []);
      setParticipant(participantData);
      setRegistrations(regData || []);

      if (participantData) {
        setForm({
          first_name: participantData.first_name || '',
          last_name: participantData.last_name || '',
          nickname: participantData.nickname || '',
          date_of_birth: participantData.date_of_birth || '',
          yog: participantData.yog || '',
          gender_id: participantData.gender_id || '',
          phone: participantData.phone || '',
          email: participantData.email || '',
        });
        const match = (gradeData || []).find(g => g.yog === participantData.yog);
        setYogLabel(match?.label || `Class of ${participantData.yog}`);
      }

      setLoading(false);
    }
    loadData();
  }, [participantId]);

  // Recalculate YOG when DOB changes
  useEffect(() => {
    if (!dobChanged || !form.date_of_birth) return;

    const dob = new Date(form.date_of_birth);
    const today = new Date();
    const currentMonth = today.getMonth();
    const schoolYearStart = currentMonth >= 8
      ? today.getFullYear()
      : today.getFullYear() - 1;
    const sept1 = new Date(schoolYearStart, 8, 1);

    let ageAtSept = sept1.getFullYear() - dob.getFullYear();
    const mDiff = sept1.getMonth() - dob.getMonth();
    if (mDiff < 0 || (mDiff === 0 && sept1.getDate() < dob.getDate())) {
      ageAtSept--;
    }

    const gradeNum = ageAtSept - 5;

    if (gradeNum >= 0 && gradeNum <= 12) {
      const calculatedYog = schoolYearStart + 1 + (12 - gradeNum);
      setForm(f => ({ ...f, yog: calculatedYog }));
      const match = gradeLevels.find(g => g.yog === calculatedYog);
      setYogLabel(match?.label || `Class of ${calculatedYog}`);
      setYogConfirmed(false);
    }
  }, [form.date_of_birth, dobChanged, gradeLevels]);

  function handleChange(e) {
    const { name, value } = e.target;
    if (name === 'date_of_birth') {
      setDobChanged(true);
      setYogConfirmed(false);
    }
    setForm(f => ({ ...f, [name]: value }));
  }

  function handlePhoneChange(e) {
    const digits = e.target.value.replace(/\D/g, '').slice(0, 10);
    setForm(f => ({ ...f, phone: digits }));
  }

  function handleCancelEdit() {
    if (participant) {
      setForm({
        first_name: participant.first_name || '',
        last_name: participant.last_name || '',
        nickname: participant.nickname || '',
        date_of_birth: participant.date_of_birth || '',
        yog: participant.yog || '',
        gender_id: participant.gender_id || '',
        phone: participant.phone || '',
        email: participant.email || '',
      });
      const match = gradeLevels.find(g => g.yog === participant.yog);
      setYogLabel(match?.label || `Class of ${participant.yog}`);
      setYogConfirmed(true);
      setDobChanged(false);
    }
    setEditing(false);
    setError('');
  }

  async function handleSave(e) {
    e.preventDefault();
    setError('');
    setSuccess('');

    if (dobChanged && !yogConfirmed) {
      setError('You changed the date of birth. Please confirm the new year of graduation.');
      return;
    }

    if (form.phone && form.phone.length !== 10) {
      setError('Phone number must be exactly 10 digits.');
      return;
    }

    setSaving(true);

    const supabase = createClient();
    const { error: updateError } = await supabase
      .from('participants')
      .update({
        first_name: form.first_name.trim(),
        last_name: form.last_name.trim(),
        nickname: form.nickname.trim() || null,
        date_of_birth: form.date_of_birth,
        yog: parseInt(form.yog),
        gender_id: form.gender_id,
        phone: form.phone || null,
        email: form.email.trim() || null,
        updated_at: new Date().toISOString(),
      })
      .eq('id', participantId);

    if (updateError) {
      setError(updateError.message);
      setSaving(false);
      return;
    }

    // Refresh participant data
    const { data: refreshed } = await supabase
      .from('participants')
      .select('*, genders(label)')
      .eq('id', participantId)
      .single();

    setParticipant(refreshed);
    setDobChanged(false);
    setYogConfirmed(true);
    setEditing(false);
    setSuccess('Participant information updated successfully.');
    setSaving(false);
  }

  // Group registrations by season
  const regsBySeason = registrations.reduce((acc, r) => {
    const seasons = r.carts?.programs?.sessions?.seasons;
    const season = seasons?.display_name || seasons?.name || 'Unknown';
    if (!acc[season]) acc[season] = [];
    acc[season].push(r);
    return acc;
  }, {});

  if (loading) {
    return (
      <div style={{ textAlign: 'center', color: 'var(--text-muted)', padding: '3rem' }}>
        Loading...
      </div>
    );
  }

  if (!participant) {
    return (
      <div style={{ textAlign: 'center', padding: '3rem' }}>
        <p style={{ color: 'var(--text-muted)', fontFamily: 'var(--font-accent)', fontStyle: 'italic' }}>
          Participant not found.
        </p>
        <a href="/dashboard" className="tyt-btn tyt-btn-secondary" style={{ marginTop: '1rem', display: 'inline-flex' }}>
          Back to Dashboard
        </a>
      </div>
    );
  }

  const currentGender = genders.find(g => g.id === form.gender_id);

  return (
    <div>
      {/* Participant header */}
      <div style={{
        display: 'flex',
        alignItems: 'flex-start',
        justifyContent: 'space-between',
        marginBottom: '2rem',
        gap: '1rem',
        flexWrap: 'wrap',
      }}>
        <div>
          <h1 style={{
            fontFamily: 'var(--font-display)',
            fontSize: '2rem',
            fontWeight: 800,
            letterSpacing: '0.05em',
            textTransform: 'uppercase',
            color: 'var(--text-primary)',
            marginBottom: '0.25rem',
          }}>
            {participant.nickname ? participant.nickname : participant.first_name} {participant.last_name}
          </h1>
          <p style={{
            fontFamily: 'var(--font-accent)',
            fontStyle: 'italic',
            color: 'var(--text-muted)',
            fontSize: '0.95rem',
          }}>
            Class of {participant.yog}
            {yogLabel && (
              <span style={{ color: 'var(--gold)', marginLeft: '0.5rem' }}>
                · Current Grade: {yogLabel}
              </span>
            )}
          </p>
        </div>
        {!editing && (
          <button
            onClick={() => setEditing(true)}
            className="tyt-btn tyt-btn-secondary"
            style={{ fontSize: '0.8rem' }}
          >
            Edit Info
          </button>
        )}
      </div>

      {success && <div className="tyt-success">{success}</div>}

      {/* Info / Edit form */}
      <div className="tyt-card" style={{ marginBottom: '2rem' }}>
        {!editing ? (
          // Read-only view
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
            {[
              { label: 'First Name', value: participant.first_name },
              { label: 'Last Name', value: participant.last_name },
              { label: 'Preferred Name / Nickname', value: participant.nickname || '—' },
              { label: 'Date of Birth', value: participant.date_of_birth ? new Date(participant.date_of_birth + 'T00:00:00').toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' }) : '—' },
              { label: 'Year of Graduation', value: participant.yog ? `${participant.yog} (${yogLabel})` : '—' },
              { label: 'Gender', value: participant.genders?.label || '—' },
              { label: 'Mobile', value: fmtPhone(participant.phone) },
              { label: 'Email', value: participant.email || '—' },
            ].map((item, i, arr) => (
              <div
                key={item.label}
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'baseline',
                  gap: '1rem',
                  paddingBottom: i < arr.length - 1 ? '1rem' : 0,
                  borderBottom: i < arr.length - 1 ? '1px solid var(--border)' : 'none',
                }}
              >
                <span style={{
                  fontFamily: 'var(--font-display)',
                  fontSize: '0.75rem',
                  fontWeight: 600,
                  letterSpacing: '0.1em',
                  textTransform: 'uppercase',
                  color: 'var(--text-muted)',
                  flexShrink: 0,
                }}>
                  {item.label}
                </span>
                <span style={{
                  fontFamily: 'var(--font-body)',
                  fontSize: '0.95rem',
                  color: item.value === '—' ? 'var(--text-faint)' : 'var(--text-primary)',
                  textAlign: 'right',
                }}>
                  {item.value}
                </span>
              </div>
            ))}
          </div>
        ) : (
          // Edit form
          <form onSubmit={handleSave}>
            {error && <div className="tyt-error">{error}</div>}

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem', marginBottom: '1.25rem' }}>
              <div>
                <label className="tyt-label">First Name <span style={{ color: 'var(--red)' }}>*</span></label>
                <input type="text" name="first_name" value={form.first_name} onChange={handleChange} required className="tyt-input" />
              </div>
              <div>
                <label className="tyt-label">Last Name <span style={{ color: 'var(--red)' }}>*</span></label>
                <input type="text" name="last_name" value={form.last_name} onChange={handleChange} required className="tyt-input" />
              </div>
            </div>

            <div style={{ marginBottom: '1.25rem' }}>
              <label className="tyt-label">
                Preferred Name / Nickname{' '}
                <span style={{ color: 'var(--text-faint)', fontWeight: 400, textTransform: 'none', letterSpacing: 0 }}>(optional)</span>
              </label>
              <input type="text" name="nickname" value={form.nickname} onChange={handleChange} placeholder="What do they like to be called?" className="tyt-input" />
            </div>

            <div style={{ marginBottom: '1.25rem' }}>
              <label className="tyt-label">Date of Birth <span style={{ color: 'var(--red)' }}>*</span></label>
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

            {/* YOG confirmation — only shown if DOB changed */}
            {dobChanged && form.yog && (
              <div style={{
                background: yogConfirmed ? '#0d1a0a' : '#1a1400',
                border: '1px solid var(--gold)',
                borderRadius: 'var(--radius-sm)',
                padding: '0.875rem 1rem',
                marginBottom: '1.25rem',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                gap: '1rem',
                flexWrap: 'wrap',
              }}>
                <div>
                  <p style={{ fontFamily: 'var(--font-display)', fontSize: '0.65rem', fontWeight: 600, letterSpacing: '0.12em', textTransform: 'uppercase', color: 'var(--text-muted)', marginBottom: '0.2rem' }}>
                    Updated Year of Graduation
                  </p>
                  <p style={{ fontFamily: 'var(--font-display)', fontSize: '1.2rem', fontWeight: 800, color: 'var(--gold)', lineHeight: 1, marginBottom: '0.15rem' }}>
                    {form.yog}
                  </p>
                  <p style={{ fontFamily: 'var(--font-accent)', fontStyle: 'italic', color: 'var(--text-muted)', fontSize: '0.8rem' }}>
                    Current Grade: {yogLabel}
                  </p>
                </div>
                {!yogConfirmed ? (
                  <button
                    type="button"
                    onClick={() => setYogConfirmed(true)}
                    className="tyt-btn tyt-btn-gold"
                    style={{ fontSize: '0.75rem', padding: '0.4rem 1rem' }}
                  >
                    Confirm
                  </button>
                ) : (
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                    <span style={{ color: 'var(--gold)', fontSize: '1rem' }}>✓</span>
                    <span style={{ fontFamily: 'var(--font-body)', fontSize: '0.8rem', color: 'var(--gold)' }}>Confirmed</span>
                    <button type="button" onClick={() => setYogConfirmed(false)} style={{ background: 'none', border: 'none', color: 'var(--text-faint)', cursor: 'pointer', fontFamily: 'var(--font-body)', fontSize: '0.75rem', padding: 0, marginLeft: '0.25rem', textDecoration: 'underline' }}>
                      Change
                    </button>
                  </div>
                )}
              </div>
            )}

            <div style={{ marginBottom: '1.25rem' }}>
              <label className="tyt-label">Gender <span style={{ color: 'var(--red)' }}>*</span></label>
              <select name="gender_id" value={form.gender_id} onChange={handleChange} required className="tyt-input">
                <option value="">Select gender</option>
                {genders.map(g => (
                  <option key={g.id} value={g.id}>{g.label}</option>
                ))}
              </select>
            </div>

            <hr className="tyt-divider" />

            <h3 style={{ fontFamily: 'var(--font-display)', fontSize: '1.1rem', fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase', color: 'var(--text-primary)', marginBottom: '0.5rem' }}>
              Optional Participant Contact Information
            </h3>
            <p style={{ fontFamily: 'var(--font-body)', fontWeight: 600, color: 'var(--text-muted)', fontSize: '0.875rem', marginBottom: '1.5rem', lineHeight: 1.6 }}>
              Fill out these fields only if different than their parents/guardians.
            </p>

            <div style={{ marginBottom: '1.25rem' }}>
              <label className="tyt-label">Participant Mobile</label>
              <input
                type="tel"
                name="phone"
                value={form.phone}
                onChange={handlePhoneChange}
                placeholder="10 digits, no dashes or spaces"
                maxLength={10}
                className="tyt-input"
              />
              {form.phone && form.phone.length > 0 && form.phone.length < 10 && (
                <p style={{ fontFamily: 'var(--font-body)', fontSize: '0.75rem', color: 'var(--text-faint)', marginTop: '0.3rem' }}>
                  {10 - form.phone.length} more digit{10 - form.phone.length !== 1 ? 's' : ''} needed
                </p>
              )}
            </div>

            <div style={{ marginBottom: '1.75rem' }}>
              <label className="tyt-label">Participant Email</label>
              <input type="email" name="email" value={form.email} onChange={handleChange} placeholder="participant@example.com" className="tyt-input" />
            </div>

            <div style={{ display: 'flex', gap: '1rem', flexWrap: 'wrap' }}>
              <button type="submit" disabled={saving} className="tyt-btn tyt-btn-primary" style={{ flex: 1 }}>
                {saving ? 'Saving...' : 'Save Changes'}
              </button>
              <button type="button" onClick={handleCancelEdit} className="tyt-btn tyt-btn-secondary" style={{ flex: 1 }}>
                Cancel
              </button>
            </div>
          </form>
        )}
      </div>

      {/* Registration History */}
      <h2 style={{
        fontFamily: 'var(--font-display)',
        fontSize: '1.3rem',
        fontWeight: 700,
        letterSpacing: '0.08em',
        textTransform: 'uppercase',
        color: 'var(--text-primary)',
        marginBottom: '1rem',
      }}>
        Registration History
      </h2>

      {Object.keys(regsBySeason).length > 0 ? (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          {Object.entries(regsBySeason)
            .sort(([a], [b]) => b.localeCompare(a))
            .map(([season, regs]) => (
              <div key={season} className="tyt-card">
                <p style={{
                  fontFamily: 'var(--font-display)',
                  fontSize: '0.75rem',
                  fontWeight: 600,
                  letterSpacing: '0.12em',
                  textTransform: 'uppercase',
                  color: 'var(--gold)',
                  marginBottom: '0.75rem',
                }}>
                  Season {season}
                </p>
                {regs.map(r => {
                  const programLabel = r.carts?.programs?.label;
                  const awardLabel = r.award_levels?.label || 'No Award';
                  return (
                    <div key={r.id} style={{
                      paddingBottom: '0.75rem',
                      marginBottom: '0.75rem',
                      borderBottom: '1px solid var(--border)',
                    }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '1rem' }}>
                        <div>
                          <p style={{ fontFamily: 'var(--font-body)', fontSize: '0.9rem', color: 'var(--text-primary)', marginBottom: '0.2rem' }}>
                            {programLabel || 'No program'}
                          </p>
                          <p style={{ fontFamily: 'var(--font-body)', fontSize: '0.75rem', color: 'var(--text-faint)' }}>
                            #{r.registration_number} · {r.registration_statuses?.label}
                          </p>
                        </div>
                        <span style={{
                          fontFamily: 'var(--font-display)',
                          fontSize: '0.7rem',
                          fontWeight: 600,
                          letterSpacing: '0.08em',
                          textTransform: 'uppercase',
                          color: 'var(--gold)',
                          border: '1px solid var(--gold)',
                          borderRadius: '3px',
                          padding: '0.2rem 0.5rem',
                          whiteSpace: 'nowrap',
                          flexShrink: 0,
                        }}>
                          {awardLabel}
                        </span>
                      </div>
                    </div>
                  );
                })}
              </div>
            ))}
        </div>
      ) : (
        <div style={{
          background: 'var(--bg-card)',
          border: '1px dashed var(--border)',
          borderRadius: 'var(--radius-md)',
          padding: '2rem',
          textAlign: 'center',
        }}>
          <p style={{ fontFamily: 'var(--font-accent)', fontStyle: 'italic', color: 'var(--text-muted)' }}>
            No registration history yet.
          </p>
        </div>
      )}
    </div>
  );
}

export default function ParticipantPage() {
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
          Participant
        </span>
        <a href="/dashboard" style={{
          fontFamily: 'var(--font-display)',
          fontSize: '0.75rem',
          fontWeight: 600,
          letterSpacing: '0.1em',
          textTransform: 'uppercase',
          color: 'var(--gold)',
          textDecoration: 'none',
          border: '1px solid var(--gold)',
          borderRadius: 'var(--radius-sm)',
          padding: '0.35rem 0.85rem',
        }}>
          ← Back
        </a>
      </nav>

      <main style={{ maxWidth: '700px', margin: '0 auto', padding: '2rem 1.5rem' }}>
        <Suspense fallback={
          <div style={{ textAlign: 'center', color: 'var(--text-muted)', padding: '3rem' }}>
            Loading...
          </div>
        }>
          <ParticipantDetail />
        </Suspense>
      </main>
    </div>
  );
}