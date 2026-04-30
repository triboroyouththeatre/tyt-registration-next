'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import Link from 'next/link';

const labelStyle = { fontFamily: 'var(--font-display)', fontSize: '0.65rem', fontWeight: 600, letterSpacing: '0.08em', textTransform: 'uppercase', color: '#6b7280', display: 'block', marginBottom: '0.3rem' };
const inputStyle = { fontFamily: 'var(--font-body)', fontSize: '0.875rem', color: '#111', border: '1px solid #d1d5db', borderRadius: '6px', padding: '0.5rem 0.75rem', width: '100%', boxSizing: 'border-box', background: '#fff' };
const sectionStyle = { background: '#fff', border: '1px solid #e5e7eb', borderRadius: '8px', padding: '1.25rem', marginBottom: '1rem' };
const sectionTitle = { fontFamily: 'var(--font-display)', fontSize: '0.7rem', fontWeight: 700, letterSpacing: '0.12em', textTransform: 'uppercase', color: '#6b7280', margin: '0 0 1rem 0', paddingBottom: '0.5rem', borderBottom: '1px solid #e5e7eb' };

export default function ProgramForm({ program, seasons, sessions, programTypes }) {
  const router = useRouter();
  const isNew = !program?.id;

  const [saving, setSaving]   = useState(false);
  const [error, setError]     = useState('');
  const [success, setSuccess] = useState('');

  const [form, setForm] = useState({
    label:                  program?.label                  || '',
    key:                    program?.key                    || '',
    season_id:              program?.season_id              || '',
    session_id:             program?.session_id             || '',
    program_type_id:        program?.program_type_id        || (programTypes?.[0]?.id || ''),
    fee:                    program?.fee                    || '',
    deposit_amount:         program?.deposit_amount         || '',
    enrollment_limit:       program?.enrollment_limit       || '',
    yog_min:                program?.yog_min                || '',
    yog_max:                program?.yog_max                || '',
    balance_due_date:       program?.balance_due_date       || '',
    costume_fee:            program?.costume_fee            || '0',
    other_fee:              program?.other_fee              || '0',
    other_fee_label:        program?.other_fee_label        || '',
    description:            program?.description            || '',
    schedule:               program?.schedule               || '',
    is_registration_open:   program?.is_registration_open   ?? false,
    is_active:              program?.is_active              ?? true,
    registration_opens_at:  program?.registration_opens_at  ? toLocalDateTimeInput(program.registration_opens_at) : '',
    registration_closes_at: program?.registration_closes_at ? toLocalDateTimeInput(program.registration_closes_at) : '',
  });

  // Track selected season to filter sessions
  const [selectedSeasonId, setSelectedSeasonId] = useState(program?.season_id || '');

  function toLocalDateTimeInput(iso) {
    if (!iso) return '';
    const d = new Date(iso);
    const pad = n => String(n).padStart(2, '0');
    return `${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
  }

  function handleChange(e) {
    const { name, value, type, checked } = e.target;
    setForm(f => ({ ...f, [name]: type === 'checkbox' ? checked : value }));
  }

  function handleSeasonChange(e) {
    const seasonId = e.target.value;
    setSelectedSeasonId(seasonId);
    setForm(f => ({ ...f, season_id: seasonId, session_id: '' }));
  }

  const filteredSessions = (sessions || []).filter(s => !selectedSeasonId || s.season_id === selectedSeasonId);

  async function handleSubmit(e) {
    e.preventDefault();
    setError('');
    setSaving(true);

    const supabase = createClient();

    const payload = {
      label:                  form.label.trim(),
      key:                    form.key.trim() || form.label.trim().toLowerCase().replace(/\s+/g, '_'),
      session_id:             form.session_id,
      program_type_id:        form.program_type_id,
      fee:                    parseFloat(form.fee) || 0,
      deposit_amount:         parseFloat(form.deposit_amount) || 0,
      enrollment_limit:       parseInt(form.enrollment_limit) || 0,
      yog_min:                form.yog_min ? parseInt(form.yog_min) : null,
      yog_max:                form.yog_max ? parseInt(form.yog_max) : null,
      balance_due_date:       form.balance_due_date || null,
      costume_fee:            parseFloat(form.costume_fee) || 0,
      other_fee:              parseFloat(form.other_fee) || 0,
      other_fee_label:        form.other_fee_label.trim() || null,
      description:            form.description.trim() || null,
      schedule:               form.schedule.trim() || null,
      is_registration_open:   form.is_registration_open,
      is_active:              form.is_active,
      registration_opens_at:  form.registration_opens_at ? new Date(form.registration_opens_at).toISOString() : null,
      registration_closes_at: form.registration_closes_at ? new Date(form.registration_closes_at).toISOString() : null,
    };

    let error;
    if (isNew) {
      ({ error } = await supabase.from('programs').insert(payload));
    } else {
      ({ error } = await supabase.from('programs').update(payload).eq('id', program.id));
    }

    if (error) { setError(error.message); setSaving(false); return; }

    setSuccess(isNew ? 'Program created successfully!' : 'Program updated successfully!');
    setSaving(false);
    setTimeout(() => router.push('/backstage/programs'), 1000);
  }

  async function handleDuplicate() {
    setSaving(true);
    const supabase = createClient();
    const { error } = await supabase.from('programs').insert({
      ...form,
      label: `${form.label} (Copy)`,
      key: `${form.key}_copy`,
      is_registration_open: false,
      fee: parseFloat(form.fee) || 0,
      deposit_amount: parseFloat(form.deposit_amount) || 0,
      enrollment_limit: parseInt(form.enrollment_limit) || 0,
      costume_fee: parseFloat(form.costume_fee) || 0,
      other_fee: parseFloat(form.other_fee) || 0,
    });
    if (error) { setError(error.message); setSaving(false); return; }
    setSuccess('Program duplicated!');
    setSaving(false);
    setTimeout(() => router.push('/backstage/programs'), 1000);
  }

  return (
    <div>
      <div style={{ marginBottom: '1.25rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
          <Link href="/backstage/programs" style={{ fontFamily: 'var(--font-display)', fontSize: '0.7rem', fontWeight: 600, letterSpacing: '0.08em', textTransform: 'uppercase', color: '#6b7280', textDecoration: 'none' }}>← Programs</Link>
          <h1 style={{ fontFamily: 'var(--font-display)', fontSize: '1.5rem', fontWeight: 800, letterSpacing: '0.05em', textTransform: 'uppercase', color: '#111', margin: '4px 0 0 0' }}>
            {isNew ? 'New Program' : `Edit — ${program.label}`}
          </h1>
        </div>
        {!isNew && (
          <button onClick={handleDuplicate} disabled={saving} style={{ fontFamily: 'var(--font-display)', fontSize: '0.7rem', fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase', background: '#fff', color: '#374151', border: '1px solid #d1d5db', borderRadius: '6px', padding: '0.5rem 1.25rem', cursor: 'pointer' }}>
            Duplicate Program
          </button>
        )}
      </div>

      {error   && <div style={{ background: '#fff5f5', border: '1px solid #fecaca', borderRadius: '6px', padding: '0.75rem 1rem', marginBottom: '1rem', fontFamily: 'var(--font-body)', fontSize: '0.875rem', color: '#b40000' }}>{error}</div>}
      {success && <div style={{ background: '#f0fdf4', border: '1px solid #bbf7d0', borderRadius: '6px', padding: '0.75rem 1rem', marginBottom: '1rem', fontFamily: 'var(--font-body)', fontSize: '0.875rem', color: '#16a34a' }}>✓ {success}</div>}

      <form onSubmit={handleSubmit}>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>

          {/* LEFT */}
          <div>

            {/* Season & Session */}
            <div style={sectionStyle}>
              <p style={sectionTitle}>Season & Session</p>
              <div style={{ marginBottom: '0.75rem' }}>
                <label style={labelStyle}>Season <span style={{ color: '#b40000' }}>*</span></label>
                <select name="season_id" value={form.season_id} onChange={handleSeasonChange} required style={inputStyle}>
                  <option value="">Select season</option>
                  {(seasons || []).map(s => <option key={s.id} value={s.id}>{s.display_name}{s.is_active ? ' (Active)' : ''}</option>)}
                </select>
              </div>
              <div>
                <label style={labelStyle}>Session <span style={{ color: '#b40000' }}>*</span></label>
                <select name="session_id" value={form.session_id} onChange={handleChange} required style={inputStyle}>
                  <option value="">Select session</option>
                  {filteredSessions.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                </select>
              </div>
            </div>

            {/* Program Info */}
            <div style={sectionStyle}>
              <p style={sectionTitle}>Program Info</p>
              <div style={{ marginBottom: '0.75rem' }}>
                <label style={labelStyle}>Program Name <span style={{ color: '#b40000' }}>*</span></label>
                <input type="text" name="label" value={form.label} onChange={handleChange} required style={inputStyle} placeholder="e.g. Something Rotten" />
              </div>
              <div style={{ marginBottom: '0.75rem' }}>
                <label style={labelStyle}>Program Type <span style={{ color: '#b40000' }}>*</span></label>
                <select name="program_type_id" value={form.program_type_id} onChange={handleChange} required style={inputStyle}>
                  <option value="">Select type</option>
                  {(programTypes || []).map(t => <option key={t.id} value={t.id}>{t.label}</option>)}
                </select>
              </div>
              <div style={{ marginBottom: '0.75rem' }}>
                <label style={labelStyle}>Description</label>
                <textarea name="description" value={form.description} onChange={handleChange} rows={3} style={{ ...inputStyle, resize: 'vertical' }} placeholder="Program description shown to families..." />
              </div>
              <div>
                <label style={labelStyle}>Schedule Notes</label>
                <textarea name="schedule" value={form.schedule} onChange={handleChange} rows={2} style={{ ...inputStyle, resize: 'vertical' }} placeholder="e.g. Tuesdays & Thursdays 4-6pm" />
              </div>
            </div>

            {/* Grade Range */}
            <div style={sectionStyle}>
              <p style={sectionTitle}>Grade Range (YOG)</p>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
                <div>
                  <label style={labelStyle}>YOG Min (oldest)</label>
                  <input type="number" name="yog_min" value={form.yog_min} onChange={handleChange} style={inputStyle} placeholder="e.g. 2026" />
                </div>
                <div>
                  <label style={labelStyle}>YOG Max (youngest)</label>
                  <input type="number" name="yog_max" value={form.yog_max} onChange={handleChange} style={inputStyle} placeholder="e.g. 2032" />
                </div>
              </div>
            </div>

          </div>

          {/* RIGHT */}
          <div>

            {/* Fees */}
            <div style={sectionStyle}>
              <p style={sectionTitle}>Fees</p>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem', marginBottom: '0.75rem' }}>
                <div>
                  <label style={labelStyle}>Program Fee <span style={{ color: '#b40000' }}>*</span></label>
                  <input type="number" name="fee" value={form.fee} onChange={handleChange} required min="0" step="0.01" style={inputStyle} placeholder="350.00" />
                </div>
                <div>
                  <label style={labelStyle}>Deposit Amount <span style={{ color: '#b40000' }}>*</span></label>
                  <input type="number" name="deposit_amount" value={form.deposit_amount} onChange={handleChange} required min="0" step="0.01" style={inputStyle} placeholder="50.00" />
                </div>
              </div>
              <div style={{ marginBottom: '0.75rem' }}>
                <label style={labelStyle}>Balance Due Date</label>
                <input type="date" name="balance_due_date" value={form.balance_due_date} onChange={handleChange} style={{ ...inputStyle, colorScheme: 'light' }} />
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem', marginBottom: '0.75rem' }}>
                <div>
                  <label style={labelStyle}>Costume Fee</label>
                  <input type="number" name="costume_fee" value={form.costume_fee} onChange={handleChange} min="0" step="0.01" style={inputStyle} placeholder="0.00" />
                </div>
                <div>
                  <label style={labelStyle}>Other Fee</label>
                  <input type="number" name="other_fee" value={form.other_fee} onChange={handleChange} min="0" step="0.01" style={inputStyle} placeholder="0.00" />
                </div>
              </div>
              <div>
                <label style={labelStyle}>Other Fee Label</label>
                <input type="text" name="other_fee_label" value={form.other_fee_label} onChange={handleChange} style={inputStyle} placeholder="e.g. Activity fee" />
              </div>
            </div>

            {/* Enrollment */}
            <div style={sectionStyle}>
              <p style={sectionTitle}>Enrollment</p>
              <div>
                <label style={labelStyle}>Enrollment Limit <span style={{ color: '#b40000' }}>*</span></label>
                <input type="number" name="enrollment_limit" value={form.enrollment_limit} onChange={handleChange} required min="1" style={inputStyle} placeholder="40" />
              </div>
            </div>

            {/* Registration Schedule */}
            <div style={sectionStyle}>
              <p style={sectionTitle}>Registration Schedule</p>
              <div style={{ marginBottom: '0.75rem' }}>
                <label style={labelStyle}>Auto-Open Date & Time</label>
                <input type="datetime-local" name="registration_opens_at" value={form.registration_opens_at} onChange={handleChange} style={{ ...inputStyle, colorScheme: 'light' }} />
                <p style={{ fontFamily: 'var(--font-body)', fontSize: '0.75rem', color: '#9ca3af', margin: '4px 0 0 0' }}>System will automatically open registration at this time</p>
              </div>
              <div style={{ marginBottom: '1rem' }}>
                <label style={labelStyle}>Auto-Close Date & Time</label>
                <input type="datetime-local" name="registration_closes_at" value={form.registration_closes_at} onChange={handleChange} style={{ ...inputStyle, colorScheme: 'light' }} />
                <p style={{ fontFamily: 'var(--font-body)', fontSize: '0.75rem', color: '#9ca3af', margin: '4px 0 0 0' }}>System will automatically close registration at this time</p>
              </div>

              {/* Manual toggle */}
              <div style={{ background: form.is_registration_open ? '#f0fdf4' : '#fff5f5', border: `1px solid ${form.is_registration_open ? '#bbf7d0' : '#fecaca'}`, borderRadius: '6px', padding: '0.875rem 1rem' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <div>
                    <p style={{ fontFamily: 'var(--font-display)', fontSize: '0.7rem', fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase', color: form.is_registration_open ? '#16a34a' : '#b40000', margin: 0 }}>
                      Registration is {form.is_registration_open ? 'OPEN' : 'CLOSED'}
                    </p>
                    <p style={{ fontFamily: 'var(--font-body)', fontSize: '0.75rem', color: '#6b7280', margin: '2px 0 0 0' }}>Manual override — overrides schedule</p>
                  </div>
                  <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', cursor: 'pointer' }}>
                    <input type="checkbox" name="is_registration_open" checked={form.is_registration_open} onChange={handleChange} style={{ width: '18px', height: '18px', accentColor: '#16a34a', cursor: 'pointer' }} />
                    <span style={{ fontFamily: 'var(--font-display)', fontSize: '0.7rem', fontWeight: 600, letterSpacing: '0.08em', textTransform: 'uppercase', color: '#374151' }}>
                      {form.is_registration_open ? 'Close' : 'Open'} Now
                    </span>
                  </label>
                </div>
              </div>
            </div>

          </div>
        </div>

        {/* Save buttons */}
        <div style={{ display: 'flex', gap: '0.75rem', justifyContent: 'flex-end', marginTop: '0.5rem' }}>
          <Link href="/backstage/programs" style={{ fontFamily: 'var(--font-display)', fontSize: '0.7rem', fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase', background: '#fff', color: '#374151', textDecoration: 'none', border: '1px solid #d1d5db', borderRadius: '6px', padding: '0.5rem 1.25rem' }}>
            Cancel
          </Link>
          <button type="submit" disabled={saving} style={{ fontFamily: 'var(--font-display)', fontSize: '0.7rem', fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase', background: '#111', color: '#fff', border: 'none', borderRadius: '6px', padding: '0.5rem 1.5rem', cursor: 'pointer', opacity: saving ? 0.7 : 1 }}>
            {saving ? 'Saving...' : isNew ? 'Create Program' : 'Save Changes'}
          </button>
        </div>
      </form>
    </div>
  );
}