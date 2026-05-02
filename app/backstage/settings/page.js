'use client';

import { useState, useEffect, useRef } from 'react';
import { createClient } from '@/lib/supabase/client';
import SeasonRolloverCard from '@/components/backstage/SeasonRolloverCard';

// ── Styles ─────────────────────────────────────────────────────────────────────
const labelStyle = { fontFamily: 'var(--font-display)', fontSize: '0.65rem', fontWeight: 600, letterSpacing: '0.08em', textTransform: 'uppercase', color: '#6b7280', display: 'block', marginBottom: '0.3rem' };
const inputStyle = { fontFamily: 'var(--font-body)', fontSize: '0.875rem', color: '#111', border: '1px solid #d1d5db', borderRadius: '6px', padding: '0.5rem 0.75rem', width: '100%', boxSizing: 'border-box', background: '#fff' };
const cardStyle = { background: '#fff', border: '1px solid #e5e7eb', borderRadius: '8px', padding: '1.25rem', marginBottom: '1rem' };
const sectionTitle = { fontFamily: 'var(--font-display)', fontSize: '0.7rem', fontWeight: 700, letterSpacing: '0.12em', textTransform: 'uppercase', color: '#6b7280', margin: '0 0 1rem 0', paddingBottom: '0.5rem', borderBottom: '1px solid #e5e7eb' };
const btnPrimary = { fontFamily: 'var(--font-display)', fontSize: '0.7rem', fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase', background: '#111', color: '#fff', border: 'none', borderRadius: '6px', padding: '0.5rem 1.25rem', cursor: 'pointer' };
const btnSecondary = { fontFamily: 'var(--font-display)', fontSize: '0.7rem', fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase', background: '#fff', color: '#374151', border: '1px solid #d1d5db', borderRadius: '6px', padding: '0.5rem 1.25rem', cursor: 'pointer' };
const btnSmall = { ...btnSecondary, padding: '0.3rem 0.75rem', fontSize: '0.65rem' };

const TABS = [
  { id: 'seasons',   label: 'Seasons & Sessions' },
  { id: 'emails',    label: 'Email Templates' },
  { id: 'reference', label: 'Reference Tables' },
  { id: 'policies',  label: 'Policy Documents' },
];

// All available template variables grouped by category
const ALL_VARIABLES = {
  'Participant':   ['{{participant_name}}', '{{participant_first_name}}', '{{participant_last_name}}', '{{grade}}'],
  'Guardian':      ['{{guardian_name}}', '{{guardian_email}}', '{{guardian_phone}}'],
  'Program':       ['{{program_name}}', '{{season_name}}', '{{session_name}}'],
  'Registration':  ['{{registration_number}}', '{{registered_at}}', '{{award_level}}'],
  'Payment':       ['{{amount_paid}}', '{{balance_due}}', '{{balance_due_date}}', '{{total_fee}}', '{{amount_refunded}}', '{{payment_method}}'],
  'Other':         ['{{urgency}}', '{{cancellation_reason}}', '{{new_balance}}'],
};

// ── Quill Editor ───────────────────────────────────────────────────────────────
function QuillEditor({ value, onChange, editorKey }) {
  const containerRef = useRef(null);
  const quillRef     = useRef(null);
  const isUpdating   = useRef(false);

  useEffect(() => {
    if (!containerRef.current) return;

    if (!document.getElementById('quill-css')) {
      const link = document.createElement('link');
      link.id   = 'quill-css';
      link.rel  = 'stylesheet';
      link.href = 'https://cdnjs.cloudflare.com/ajax/libs/quill/1.3.7/quill.snow.min.css';
      document.head.appendChild(link);
    }

    function initQuill(Quill) {
      containerRef.current.innerHTML = '<div></div>';
      const editor = new Quill(containerRef.current.firstChild, {
        theme: 'snow',
        modules: {
          toolbar: [
            [{ header: [1, 2, 3, false] }],
            ['bold', 'italic', 'underline'],
            [{ list: 'ordered' }, { list: 'bullet' }],
            [{ indent: '-1' }, { indent: '+1' }],
            ['link'], ['clean'],
          ],
        },
      });
      if (value) editor.root.innerHTML = value;
      editor.on('text-change', () => {
        if (!isUpdating.current) onChange(editor.root.innerHTML);
      });
      quillRef.current = editor;
    }

    if (window.Quill) {
      initQuill(window.Quill);
    } else {
      const script = document.createElement('script');
      script.src = 'https://cdnjs.cloudflare.com/ajax/libs/quill/1.3.7/quill.min.js';
      script.onload = () => initQuill(window.Quill);
      document.head.appendChild(script);
    }

    return () => { if (quillRef.current) quillRef.current.off('text-change'); };
  }, [editorKey]);

  useEffect(() => {
    if (quillRef.current && value !== undefined) {
      const current = quillRef.current.root.innerHTML;
      if (current !== value) {
        isUpdating.current = true;
        quillRef.current.root.innerHTML = value || '';
        isUpdating.current = false;
      }
    }
  }, [value]);

  return (
    <div>
      <style>{`
        .ql-container { font-family: Arial, sans-serif !important; font-size: 0.875rem !important; min-height: 200px; background: #ffffff; }
        .ql-toolbar { border-radius: 6px 6px 0 0 !important; border-color: #d1d5db !important; background: #f9fafb !important; }
        .ql-container.ql-snow { border-radius: 0 0 6px 6px !important; border-color: #d1d5db !important; background: #ffffff !important; }
        .ql-editor { min-height: 200px; max-height: 400px; overflow-y: auto; line-height: 1.7; color: #111111 !important; background-color: #ffffff !important; }
        .ql-editor, .ql-editor p, .ql-editor li, .ql-editor h1, .ql-editor h2, .ql-editor h3, .ql-editor span { color: #111111 !important; }
        .ql-toolbar.ql-snow .ql-stroke { stroke: #374151 !important; }
        .ql-toolbar.ql-snow .ql-fill { fill: #374151 !important; }
        .ql-toolbar.ql-snow button, .ql-toolbar.ql-snow .ql-picker-label { color: #374151 !important; }
        .ql-snow .ql-picker-options { background: #ffffff !important; color: #111111 !important; }
      `}</style>
      <div ref={containerRef}><div /></div>
    </div>
  );
}

// ── Preview Box (fixed white text) ─────────────────────────────────────────────
function PreviewBox({ html }) {
  return (
    <div style={{
      border: '1px solid #d1d5db', borderRadius: '6px', padding: '1.25rem',
      minHeight: '200px', background: '#ffffff',
      fontFamily: 'Arial, sans-serif', fontSize: '0.875rem',
      lineHeight: 1.7, color: '#111111',
    }}>
      <div style={{ color: '#111111' }} dangerouslySetInnerHTML={{ __html: html }} />
    </div>
  );
}

// ── Seasons & Sessions ─────────────────────────────────────────────────────────
function SeasonsSection() {
  const [seasons, setSeasons]   = useState([]);
  const [sessions, setSessions] = useState([]);
  const [saving, setSaving]     = useState(false);
  const [msg, setMsg]           = useState('');
  const [newSeason, setNewSeason]   = useState({ name: '', display_name: '', is_active: false });
  const [newSession, setNewSession] = useState({ name: '', season_id: '' });
  const [addingSeason, setAddingSeason]   = useState(false);
  const [addingSession, setAddingSession] = useState(false);
  const [editingSeason, setEditingSeason]   = useState(null);
  const [editingSession, setEditingSession] = useState(null);

  useEffect(() => { load(); }, []);

  async function load() {
    const supabase = createClient();
    const [{ data: s }, { data: ss }] = await Promise.all([
      supabase.from('seasons').select('*').order('name', { ascending: false }),
      supabase.from('sessions').select('*').order('name'),
    ]);
    setSeasons(s || []);
    setSessions(ss || []);
  }

  async function saveSeason(data, id = null) {
    setSaving(true);
    const supabase = createClient();
    if (id) await supabase.from('seasons').update(data).eq('id', id);
    else    await supabase.from('seasons').insert(data);
    await load();
    setAddingSeason(false); setEditingSeason(null);
    setNewSeason({ name: '', display_name: '', is_active: false });
    setSaving(false); setMsg('Saved!'); setTimeout(() => setMsg(''), 2000);
  }

  async function saveSession(data, id = null) {
    setSaving(true);
    const supabase = createClient();
    if (id) await supabase.from('sessions').update(data).eq('id', id);
    else    await supabase.from('sessions').insert(data);
    await load();
    setAddingSession(false); setEditingSession(null);
    setNewSession({ name: '', season_id: '' });
    setSaving(false); setMsg('Saved!'); setTimeout(() => setMsg(''), 2000);
  }

  async function setActiveSeason(id) {
    setSaving(true);
    const supabase = createClient();
    await supabase.from('seasons').update({ is_active: false }).neq('id', id);
    await supabase.from('seasons').update({ is_active: true }).eq('id', id);
    await load(); setSaving(false);
    setMsg('Active season updated!'); setTimeout(() => setMsg(''), 2000);
  }

  const thStyle = { padding: '0.5rem 0.75rem', fontFamily: 'var(--font-display)', fontSize: '0.65rem', fontWeight: 600, letterSpacing: '0.1em', textTransform: 'uppercase', color: '#6b7280', textAlign: 'left', borderBottom: '1px solid #e5e7eb', background: '#f9fafb' };

  return (
    <div>
      <SeasonRolloverCard />
      {msg && <div style={{ background: '#f0fdf4', border: '1px solid #bbf7d0', borderRadius: '6px', padding: '0.5rem 1rem', marginBottom: '1rem', fontFamily: 'var(--font-body)', fontSize: '0.875rem', color: '#16a34a' }}>✓ {msg}</div>}

      <div style={cardStyle}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
          <p style={sectionTitle}>Seasons</p>
          <button onClick={() => setAddingSeason(true)} style={{ ...btnPrimary, padding: '0.35rem 0.875rem', fontSize: '0.65rem' }}>+ New Season</button>
        </div>
        {addingSeason && (
          <div style={{ background: '#f9fafb', border: '1px solid #e5e7eb', borderRadius: '6px', padding: '1rem', marginBottom: '1rem' }}>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem', marginBottom: '0.75rem' }}>
              <div><label style={labelStyle}>Season Year *</label><input type="text" value={newSeason.name} onChange={e => setNewSeason(s => ({ ...s, name: e.target.value }))} style={inputStyle} placeholder="e.g. 2027" /></div>
              <div><label style={labelStyle}>Display Name *</label><input type="text" value={newSeason.display_name} onChange={e => setNewSeason(s => ({ ...s, display_name: e.target.value }))} style={inputStyle} placeholder="e.g. 2026-2027" /></div>
            </div>
            <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', cursor: 'pointer', marginBottom: '0.75rem' }}>
              <input type="checkbox" checked={newSeason.is_active} onChange={e => setNewSeason(s => ({ ...s, is_active: e.target.checked }))} style={{ width: '16px', height: '16px', accentColor: '#16a34a' }} />
              <span style={{ fontFamily: 'var(--font-body)', fontSize: '0.875rem', color: '#374151' }}>Set as active season</span>
            </label>
            <div style={{ display: 'flex', gap: '0.5rem' }}>
              <button onClick={() => saveSeason(newSeason)} disabled={saving} style={btnPrimary}>Save</button>
              <button onClick={() => setAddingSeason(false)} style={btnSecondary}>Cancel</button>
            </div>
          </div>
        )}
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead><tr>{['Year', 'Display Name', 'Status', ''].map(col => <th key={col} style={thStyle}>{col}</th>)}</tr></thead>
          <tbody>
            {seasons.map((s, i) => (
              <tr key={s.id} style={{ borderBottom: '1px solid #f3f4f6', background: i % 2 === 0 ? '#fff' : '#fafafa' }}>
                <td style={{ padding: '0.625rem 0.75rem', fontFamily: 'var(--font-body)', fontSize: '0.875rem', fontWeight: 600, color: '#111' }}>
                  {editingSeason?.id === s.id ? <input value={editingSeason.name} onChange={e => setEditingSeason(es => ({ ...es, name: e.target.value }))} style={{ ...inputStyle, maxWidth: '100px' }} /> : s.name}
                </td>
                <td style={{ padding: '0.625rem 0.75rem', fontFamily: 'var(--font-body)', fontSize: '0.875rem', color: '#374151' }}>
                  {editingSeason?.id === s.id ? <input value={editingSeason.display_name} onChange={e => setEditingSeason(es => ({ ...es, display_name: e.target.value }))} style={{ ...inputStyle, maxWidth: '150px' }} /> : s.display_name}
                </td>
                <td style={{ padding: '0.625rem 0.75rem' }}>
                  {s.is_active
                    ? <span style={{ fontFamily: 'var(--font-display)', fontSize: '0.6rem', fontWeight: 600, letterSpacing: '0.06em', textTransform: 'uppercase', color: '#16a34a', background: '#f0fdf4', border: '1px solid #bbf7d0', borderRadius: '3px', padding: '0.2rem 0.5rem' }}>★ Active</span>
                    : <button onClick={() => setActiveSeason(s.id)} style={btnSmall}>Set Active</button>}
                </td>
                <td style={{ padding: '0.625rem 0.75rem' }}>
                  {editingSeason?.id === s.id
                    ? <div style={{ display: 'flex', gap: '0.4rem' }}><button onClick={() => saveSeason({ name: editingSeason.name, display_name: editingSeason.display_name }, s.id)} style={btnSmall}>Save</button><button onClick={() => setEditingSeason(null)} style={btnSmall}>Cancel</button></div>
                    : <button onClick={() => setEditingSeason(s)} style={btnSmall}>Edit</button>}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div style={cardStyle}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
          <p style={sectionTitle}>Sessions</p>
          <button onClick={() => setAddingSession(true)} style={{ ...btnPrimary, padding: '0.35rem 0.875rem', fontSize: '0.65rem' }}>+ New Session</button>
        </div>
        {addingSession && (
          <div style={{ background: '#f9fafb', border: '1px solid #e5e7eb', borderRadius: '6px', padding: '1rem', marginBottom: '1rem' }}>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem', marginBottom: '0.75rem' }}>
              <div><label style={labelStyle}>Session Name *</label><input type="text" value={newSession.name} onChange={e => setNewSession(s => ({ ...s, name: e.target.value }))} style={inputStyle} placeholder="e.g. Winter" /></div>
              <div>
                <label style={labelStyle}>Season *</label>
                <select value={newSession.season_id} onChange={e => setNewSession(s => ({ ...s, season_id: e.target.value }))} style={inputStyle}>
                  <option value="">Select season</option>
                  {seasons.map(s => <option key={s.id} value={s.id}>{s.display_name}</option>)}
                </select>
              </div>
            </div>
            <div style={{ display: 'flex', gap: '0.5rem' }}>
              <button onClick={() => saveSession(newSession)} disabled={saving} style={btnPrimary}>Save</button>
              <button onClick={() => setAddingSession(false)} style={btnSecondary}>Cancel</button>
            </div>
          </div>
        )}
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead><tr>{['Session', 'Season', ''].map(col => <th key={col} style={thStyle}>{col}</th>)}</tr></thead>
          <tbody>
            {sessions.map((s, i) => {
              const season = seasons.find(ss => ss.id === s.season_id);
              return (
                <tr key={s.id} style={{ borderBottom: '1px solid #f3f4f6', background: i % 2 === 0 ? '#fff' : '#fafafa' }}>
                  <td style={{ padding: '0.625rem 0.75rem', fontFamily: 'var(--font-body)', fontSize: '0.875rem', fontWeight: 600, color: '#111' }}>
                    {editingSession?.id === s.id ? <input value={editingSession.name} onChange={e => setEditingSession(es => ({ ...es, name: e.target.value }))} style={{ ...inputStyle, maxWidth: '150px' }} /> : s.name}
                  </td>
                  <td style={{ padding: '0.625rem 0.75rem', fontFamily: 'var(--font-body)', fontSize: '0.875rem', color: '#374151' }}>
                    {editingSession?.id === s.id
                      ? <select value={editingSession.season_id} onChange={e => setEditingSession(es => ({ ...es, season_id: e.target.value }))} style={{ ...inputStyle, maxWidth: '200px' }}>{seasons.map(ss => <option key={ss.id} value={ss.id}>{ss.display_name}</option>)}</select>
                      : season?.display_name || '—'}
                  </td>
                  <td style={{ padding: '0.625rem 0.75rem' }}>
                    {editingSession?.id === s.id
                      ? <div style={{ display: 'flex', gap: '0.4rem' }}><button onClick={() => saveSession({ name: editingSession.name, season_id: editingSession.season_id }, s.id)} style={btnSmall}>Save</button><button onClick={() => setEditingSession(null)} style={btnSmall}>Cancel</button></div>
                      : <button onClick={() => setEditingSession(s)} style={btnSmall}>Edit</button>}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// ── Email Templates ────────────────────────────────────────────────────────────
function EmailTemplatesSection() {
  const [templates, setTemplates]   = useState([]);
  const [activeId, setActiveId]     = useState(null);
  const [form, setForm]             = useState({ label: '', description: '', subject: '', body_html: '', variables: [] });
  const [saving, setSaving]         = useState(false);
  const [msg, setMsg]               = useState('');
  const [preview, setPreview]       = useState(false);
  const [editorKey, setEditorKey]   = useState(0);
  const [addingNew, setAddingNew]   = useState(false);
  const [newTemplate, setNewTemplate] = useState({ label: '', description: '', subject: '', body_html: '', variables: [] });
  const [newEditorKey, setNewEditorKey] = useState(100);

  useEffect(() => { load(); }, []);

  async function load() {
    const supabase = createClient();
    const { data, error } = await supabase.from('email_templates').select('*').order('label');
    if (error) { console.error('Email templates error:', error); return; }
    setTemplates(data || []);
    if (data?.length && !activeId) {
      setActiveId(data[0].id);
      setForm({ label: data[0].label, description: data[0].description || '', subject: data[0].subject, body_html: data[0].body_html, variables: data[0].variables || [] });
      setEditorKey(k => k + 1);
    }
  }

  function selectTemplate(t) {
    setActiveId(t.id);
    setForm({ label: t.label, description: t.description || '', subject: t.subject, body_html: t.body_html, variables: t.variables || [] });
    setEditorKey(k => k + 1);
    setPreview(false);
    setMsg('');
    setAddingNew(false);
  }

  async function save() {
    setSaving(true);
    const supabase = createClient();
    await supabase.from('email_templates').update({
      label:      form.label,
      description: form.description,
      subject:    form.subject,
      body_html:  form.body_html,
      variables:  form.variables,
      updated_at: new Date().toISOString(),
    }).eq('id', activeId);
    await load();
    setSaving(false); setMsg('Template saved!'); setTimeout(() => setMsg(''), 2000);
  }

  async function createTemplate() {
    if (!newTemplate.label.trim() || !newTemplate.subject.trim()) return;
    setSaving(true);
    const supabase = createClient();
    const { data } = await supabase.from('email_templates').insert({
      key:         newTemplate.label.toLowerCase().replace(/\s+/g, '_'),
      label:       newTemplate.label.trim(),
      description: newTemplate.description.trim(),
      subject:     newTemplate.subject.trim(),
      body_html:   newTemplate.body_html || '<p>Dear {{guardian_name}},</p><p></p><p>Thank you,<br>Triboro Youth Theatre</p>',
      variables:   newTemplate.variables,
    }).select('id').single();
    await load();
    if (data) { setActiveId(data.id); }
    setAddingNew(false);
    setNewTemplate({ label: '', description: '', subject: '', body_html: '', variables: [] });
    setSaving(false); setMsg('Template created!'); setTimeout(() => setMsg(''), 2000);
  }

  function toggleVar(v, isNew = false) {
    if (isNew) {
      setNewTemplate(t => ({ ...t, variables: t.variables.includes(v) ? t.variables.filter(x => x !== v) : [...t.variables, v] }));
    } else {
      setForm(f => ({ ...f, variables: f.variables.includes(v) ? f.variables.filter(x => x !== v) : [...f.variables, v] }));
    }
  }

  const active = templates.find(t => t.id === activeId);

  function VariablePicker({ selected, onToggle }) {
    return (
      <div style={{ background: '#f9fafb', border: '1px solid #e5e7eb', borderRadius: '6px', padding: '0.75rem 1rem', marginBottom: '1rem' }}>
        <p style={{ fontFamily: 'var(--font-display)', fontSize: '0.65rem', fontWeight: 600, letterSpacing: '0.1em', textTransform: 'uppercase', color: '#6b7280', margin: '0 0 0.75rem 0' }}>
          Variables — click to toggle (checked = available in this template)
        </p>
        {Object.entries(ALL_VARIABLES).map(([group, vars]) => (
          <div key={group} style={{ marginBottom: '0.5rem' }}>
            <p style={{ fontFamily: 'var(--font-display)', fontSize: '0.6rem', fontWeight: 600, letterSpacing: '0.1em', textTransform: 'uppercase', color: '#9ca3af', margin: '0 0 0.25rem 0' }}>{group}</p>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.35rem' }}>
              {vars.map(v => {
                const checked = selected.includes(v);
                return (
                  <button key={v} onClick={() => onToggle(v)} style={{ fontFamily: 'monospace', fontSize: '0.75rem', background: checked ? '#111' : '#e5e7eb', color: checked ? '#fff' : '#374151', borderRadius: '3px', padding: '0.2rem 0.5rem', border: 'none', cursor: 'pointer' }}>
                    {v}
                  </button>
                );
              })}
            </div>
          </div>
        ))}
      </div>
    );
  }

  if (!templates.length && !addingNew) return (
    <div style={{ padding: '2rem', textAlign: 'center', fontFamily: 'var(--font-body)', color: '#9ca3af', fontStyle: 'italic' }}>Loading email templates...</div>
  );

  return (
    <div style={{ display: 'grid', gridTemplateColumns: '220px 1fr', gap: '1rem' }}>
      {/* Sidebar */}
      <div>
        {templates.map(t => (
          <button key={t.id} onClick={() => selectTemplate(t)} style={{ display: 'block', width: '100%', textAlign: 'left', padding: '0.75rem 1rem', marginBottom: '0.25rem', borderRadius: '6px', border: `1px solid ${activeId === t.id && !addingNew ? '#111' : '#e5e7eb'}`, background: activeId === t.id && !addingNew ? '#111' : '#fff', color: activeId === t.id && !addingNew ? '#fff' : '#374151', fontFamily: 'var(--font-body)', fontSize: '0.875rem', cursor: 'pointer', fontWeight: activeId === t.id && !addingNew ? 600 : 400 }}>
            {t.label}
          </button>
        ))}
        <button onClick={() => { setAddingNew(true); setActiveId(null); setNewEditorKey(k => k + 1); }} style={{ ...btnSmall, width: '100%', marginTop: '0.5rem', textAlign: 'center', color: '#b40000', borderColor: '#b40000', background: addingNew ? '#b40000' : '#fff', ...(addingNew ? { color: '#fff' } : {}) }}>
          + New Template
        </button>
      </div>

      {/* Editor — New Template */}
      {addingNew && (
        <div style={cardStyle}>
          <p style={sectionTitle}>New Email Template</p>
          {msg && <div style={{ background: '#f0fdf4', border: '1px solid #bbf7d0', borderRadius: '6px', padding: '0.5rem 1rem', marginBottom: '1rem', fontFamily: 'var(--font-body)', fontSize: '0.875rem', color: '#16a34a' }}>✓ {msg}</div>}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem', marginBottom: '0.75rem' }}>
            <div>
              <label style={labelStyle}>Template Name *</label>
              <input type="text" value={newTemplate.label} onChange={e => setNewTemplate(t => ({ ...t, label: e.target.value }))} style={inputStyle} placeholder="e.g. Waitlist Offer" />
            </div>
            <div>
              <label style={labelStyle}>Description</label>
              <input type="text" value={newTemplate.description} onChange={e => setNewTemplate(t => ({ ...t, description: e.target.value }))} style={inputStyle} placeholder="When is this sent?" />
            </div>
          </div>
          <div style={{ marginBottom: '0.75rem' }}>
            <label style={labelStyle}>Subject Line *</label>
            <input type="text" value={newTemplate.subject} onChange={e => setNewTemplate(t => ({ ...t, subject: e.target.value }))} style={inputStyle} placeholder="e.g. A spot is available — {{program_name}}" />
          </div>
          <VariablePicker selected={newTemplate.variables} onToggle={v => toggleVar(v, true)} />
          <div style={{ marginBottom: '1rem' }}>
            <label style={labelStyle}>Email Body</label>
            <QuillEditor key={newEditorKey} value={newTemplate.body_html} onChange={v => setNewTemplate(t => ({ ...t, body_html: v }))} editorKey={newEditorKey} />
          </div>
          <div style={{ display: 'flex', gap: '0.5rem' }}>
            <button onClick={createTemplate} disabled={saving || !newTemplate.label.trim() || !newTemplate.subject.trim()} style={{ ...btnPrimary, opacity: !newTemplate.label.trim() || !newTemplate.subject.trim() ? 0.5 : 1 }}>{saving ? 'Creating...' : 'Create Template'}</button>
            <button onClick={() => setAddingNew(false)} style={btnSecondary}>Cancel</button>
          </div>
        </div>
      )}

      {/* Editor — Existing Template */}
      {!addingNew && active && (
        <div style={cardStyle}>
          <div style={{ marginBottom: '1rem' }}>
            <p style={{ ...sectionTitle, marginBottom: '0.25rem' }}>{active.label}</p>
            <p style={{ fontFamily: 'var(--font-body)', fontSize: '0.8rem', color: '#9ca3af', margin: 0 }}>{active.description}</p>
          </div>

          {msg && <div style={{ background: '#f0fdf4', border: '1px solid #bbf7d0', borderRadius: '6px', padding: '0.5rem 1rem', marginBottom: '1rem', fontFamily: 'var(--font-body)', fontSize: '0.875rem', color: '#16a34a' }}>✓ {msg}</div>}

          <VariablePicker selected={form.variables} onToggle={v => toggleVar(v, false)} />

          <div style={{ marginBottom: '0.75rem' }}>
            <label style={labelStyle}>Subject Line</label>
            <input type="text" value={form.subject} onChange={e => setForm(f => ({ ...f, subject: e.target.value }))} style={inputStyle} />
          </div>

          <div style={{ marginBottom: '1rem' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.3rem' }}>
              <label style={labelStyle}>Email Body</label>
              <button onClick={() => setPreview(!preview)} style={btnSmall}>{preview ? '← Edit' : 'Preview →'}</button>
            </div>
            {preview ? <PreviewBox html={form.body_html} /> : <QuillEditor key={editorKey} value={form.body_html} onChange={v => setForm(f => ({ ...f, body_html: v }))} editorKey={editorKey} />}
          </div>

          <button onClick={save} disabled={saving} style={btnPrimary}>{saving ? 'Saving...' : 'Save Template'}</button>
        </div>
      )}
    </div>
  );
}

// ── Reference Table Editor ─────────────────────────────────────────────────────
function ReferenceTableSection({ tableName, title, columns }) {
  const [rows, setRows]       = useState([]);
  const [adding, setAdding]   = useState(false);
  const [editing, setEditing] = useState(null);
  const [newRow, setNewRow]   = useState({});
  const [saving, setSaving]   = useState(false);
  const [msg, setMsg]         = useState('');

  useEffect(() => { load(); }, [tableName]);

  async function load() {
    const supabase = createClient();
    const { data } = await supabase.from(tableName).select('*').order('label');
    setRows(data || []);
  }

  async function save(data, id = null) {
    setSaving(true);
    const supabase = createClient();
    if (id) await supabase.from(tableName).update(data).eq('id', id);
    else    await supabase.from(tableName).insert(data);
    await load();
    setAdding(false); setEditing(null); setNewRow({});
    setSaving(false); setMsg('Saved!'); setTimeout(() => setMsg(''), 2000);
  }

  async function deleteRow(id) {
    if (!confirm('Delete this entry? This cannot be undone.')) return;
    const supabase = createClient();
    await supabase.from(tableName).delete().eq('id', id);
    await load();
  }

  const thStyle = { padding: '0.5rem 0.75rem', fontFamily: 'var(--font-display)', fontSize: '0.65rem', fontWeight: 600, letterSpacing: '0.1em', textTransform: 'uppercase', color: '#6b7280', textAlign: 'left', borderBottom: '1px solid #e5e7eb', background: '#f9fafb' };

  return (
    <div style={{ ...cardStyle, marginBottom: '0.75rem' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
        <p style={sectionTitle}>{title}</p>
        <button onClick={() => setAdding(true)} style={{ ...btnPrimary, padding: '0.35rem 0.875rem', fontSize: '0.65rem' }}>+ Add</button>
      </div>
      {msg && <div style={{ background: '#f0fdf4', border: '1px solid #bbf7d0', borderRadius: '6px', padding: '0.4rem 0.75rem', marginBottom: '0.75rem', fontFamily: 'var(--font-body)', fontSize: '0.8rem', color: '#16a34a' }}>✓ {msg}</div>}
      {adding && (
        <div style={{ background: '#f9fafb', border: '1px solid #e5e7eb', borderRadius: '6px', padding: '0.875rem', marginBottom: '0.75rem', display: 'flex', gap: '0.5rem', alignItems: 'flex-end', flexWrap: 'wrap' }}>
          {columns.map(col => (
            <div key={col.key} style={{ flex: 1, minWidth: '120px' }}>
              <label style={labelStyle}>{col.label}</label>
              <input type={col.type || 'text'} value={newRow[col.key] || ''} onChange={e => setNewRow(r => ({ ...r, [col.key]: col.type === 'number' ? parseInt(e.target.value) : e.target.value }))} style={inputStyle} placeholder={col.placeholder} />
            </div>
          ))}
          <div style={{ display: 'flex', gap: '0.4rem' }}>
            <button onClick={() => save(newRow)} disabled={saving} style={btnPrimary}>Save</button>
            <button onClick={() => { setAdding(false); setNewRow({}); }} style={btnSecondary}>Cancel</button>
          </div>
        </div>
      )}
      <table style={{ width: '100%', borderCollapse: 'collapse' }}>
        <thead><tr>{[...columns.map(c => <th key={c.key} style={thStyle}>{c.label}</th>), <th key="actions" style={thStyle} />]}</tr></thead>
        <tbody>
          {rows.map((row, i) => (
            <tr key={row.id} style={{ borderBottom: '1px solid #f3f4f6', background: i % 2 === 0 ? '#fff' : '#fafafa' }}>
              {columns.map(col => (
                <td key={col.key} style={{ padding: '0.625rem 0.75rem', fontFamily: 'var(--font-body)', fontSize: '0.875rem', color: '#111' }}>
                  {editing?.id === row.id
                    ? <input type={col.type || 'text'} value={editing[col.key] || ''} onChange={e => setEditing(r => ({ ...r, [col.key]: col.type === 'number' ? parseInt(e.target.value) : e.target.value }))} style={{ ...inputStyle, maxWidth: '200px' }} />
                    : row[col.key]}
                </td>
              ))}
              <td style={{ padding: '0.625rem 0.75rem' }}>
                {editing?.id === row.id
                  ? <div style={{ display: 'flex', gap: '0.4rem' }}><button onClick={() => { const d = {}; columns.forEach(c => { d[c.key] = editing[c.key]; }); save(d, row.id); }} style={btnSmall}>Save</button><button onClick={() => setEditing(null)} style={btnSmall}>Cancel</button></div>
                  : <div style={{ display: 'flex', gap: '0.4rem' }}><button onClick={() => setEditing(row)} style={btnSmall}>Edit</button><button onClick={() => deleteRow(row.id)} style={{ ...btnSmall, color: '#b40000', borderColor: '#fecaca' }}>Delete</button></div>}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

// ── Policy Documents ───────────────────────────────────────────────────────────
function PolicyDocumentsSection() {
  const [docs, setDocs]         = useState([]);
  const [activeId, setActiveId] = useState(null);
  const [form, setForm]         = useState({ title: '', content: '' });
  const [saving, setSaving]     = useState(false);
  const [msg, setMsg]           = useState('');
  const [preview, setPreview]   = useState(false);
  const [editorKey, setEditorKey] = useState(0);
  const [addingDoc, setAddingDoc] = useState(false);
  const [newDocTitle, setNewDocTitle] = useState('');

  useEffect(() => { load(); }, []);

  async function load() {
    const supabase = createClient();
    const { data } = await supabase.from('policy_documents').select('id, type, title, is_current').eq('is_current', true).order('type');
    setDocs(data || []);
    if (data?.length) {
      const idToLoad = activeId || data[0].id;
      loadDoc(idToLoad);
    }
  }

  async function loadDoc(id) {
    const supabase = createClient();
    const { data } = await supabase.from('policy_documents').select('*').eq('id', id).single();
    setActiveId(id);
    setForm({ title: data?.title || '', content: data?.content || '' });
    setEditorKey(k => k + 1);
    setPreview(false);
    setMsg('');
  }

  async function save() {
    setSaving(true);
    const supabase = createClient();
    const { error } = await supabase.from('policy_documents').update({ title: form.title, content: form.content, updated_at: new Date().toISOString() }).eq('id', activeId);
    if (error) { console.error('Policy save error:', error); setSaving(false); return; }
    // Refresh doc list (titles may have changed)
    const { data } = await supabase.from('policy_documents').select('id, type, title, is_current').eq('is_current', true).order('type');
    setDocs(data || []);
    setSaving(false); setMsg('Document saved!'); setTimeout(() => setMsg(''), 2000);
  }

  async function addDocument() {
    if (!newDocTitle.trim()) return;
    setSaving(true);
    const supabase = createClient();
    const { data } = await supabase.from('policy_documents').insert({
      type:       newDocTitle.trim().toLowerCase().replace(/\s+/g, '_'),
      title:      newDocTitle.trim(),
      content:    '',
      is_current: true,
    }).select('id').single();
    await load();
    if (data) loadDoc(data.id);
    setAddingDoc(false); setNewDocTitle('');
    setSaving(false);
  }

  const active = docs.find(d => d.id === activeId);

  return (
    <div style={{ display: 'grid', gridTemplateColumns: '220px 1fr', gap: '1rem' }}>
      <div>
        {docs.map(d => (
          <button key={d.id} onClick={() => loadDoc(d.id)} style={{ display: 'block', width: '100%', textAlign: 'left', padding: '0.75rem 1rem', marginBottom: '0.25rem', borderRadius: '6px', border: `1px solid ${activeId === d.id ? '#111' : '#e5e7eb'}`, background: activeId === d.id ? '#111' : '#fff', color: activeId === d.id ? '#fff' : '#374151', fontFamily: 'var(--font-body)', fontSize: '0.875rem', cursor: 'pointer', fontWeight: activeId === d.id ? 600 : 400 }}>
            {d.title || d.type}
          </button>
        ))}
        {addingDoc ? (
          <div style={{ marginTop: '0.5rem', padding: '0.75rem', background: '#f9fafb', border: '1px solid #e5e7eb', borderRadius: '6px' }}>
            <input type="text" value={newDocTitle} onChange={e => setNewDocTitle(e.target.value)} placeholder="Document title" style={{ ...inputStyle, marginBottom: '0.5rem', fontSize: '0.8rem' }} />
            <div style={{ display: 'flex', gap: '0.4rem' }}>
              <button onClick={addDocument} disabled={saving} style={{ ...btnPrimary, padding: '0.3rem 0.75rem', fontSize: '0.65rem' }}>Add</button>
              <button onClick={() => { setAddingDoc(false); setNewDocTitle(''); }} style={btnSmall}>Cancel</button>
            </div>
          </div>
        ) : (
          <button onClick={() => setAddingDoc(true)} style={{ ...btnSmall, width: '100%', marginTop: '0.5rem', textAlign: 'center', color: '#b40000', borderColor: '#b40000' }}>+ New Document</button>
        )}
      </div>

      {active && (
        <div style={cardStyle}>
          {msg && <div style={{ background: '#f0fdf4', border: '1px solid #bbf7d0', borderRadius: '6px', padding: '0.5rem 1rem', marginBottom: '1rem', fontFamily: 'var(--font-body)', fontSize: '0.875rem', color: '#16a34a' }}>✓ {msg}</div>}
          <div style={{ marginBottom: '0.75rem' }}>
            <label style={labelStyle}>Document Title</label>
            <input type="text" value={form.title} onChange={e => setForm(f => ({ ...f, title: e.target.value }))} style={inputStyle} />
          </div>
          <div style={{ marginBottom: '1rem' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.3rem' }}>
              <label style={labelStyle}>Document Content</label>
              <button onClick={() => setPreview(!preview)} style={btnSmall}>{preview ? '← Edit' : 'Preview →'}</button>
            </div>
            {preview ? <PreviewBox html={form.content} /> : <QuillEditor key={editorKey} value={form.content} onChange={v => setForm(f => ({ ...f, content: v }))} editorKey={editorKey} />}
          </div>
          <button onClick={save} disabled={saving} style={btnPrimary}>{saving ? 'Saving...' : 'Save Document'}</button>
        </div>
      )}
    </div>
  );
}

// ── Main Page ──────────────────────────────────────────────────────────────────
export default function SettingsPage() {
  const [activeTab, setActiveTab] = useState('seasons');
  return (
    <div>
      <div style={{ marginBottom: '1.25rem' }}>
        <h1 style={{ fontFamily: 'var(--font-display)', fontSize: '1.5rem', fontWeight: 800, letterSpacing: '0.05em', textTransform: 'uppercase', color: '#111', margin: 0 }}>Settings</h1>
      </div>
      <div style={{ display: 'flex', gap: '0.25rem', marginBottom: '1.5rem', borderBottom: '2px solid #e5e7eb' }}>
        {TABS.map(tab => (
          <button key={tab.id} onClick={() => setActiveTab(tab.id)} style={{ fontFamily: 'var(--font-display)', fontSize: '0.75rem', fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase', padding: '0.625rem 1.25rem', cursor: 'pointer', border: 'none', background: 'none', color: activeTab === tab.id ? '#b40000' : '#6b7280', borderBottom: `2px solid ${activeTab === tab.id ? '#b40000' : 'transparent'}`, marginBottom: '-2px' }}>
            {tab.label}
          </button>
        ))}
      </div>
      {activeTab === 'seasons'   && <SeasonsSection />}
      {activeTab === 'emails'    && <EmailTemplatesSection />}
      {activeTab === 'reference' && (
        <div>
          <ReferenceTableSection tableName="relationships" title="Relationships" columns={[{ key: 'label', label: 'Label', placeholder: 'e.g. Grandparent' }]} />
          <ReferenceTableSection tableName="genders"       title="Genders"       columns={[{ key: 'label', label: 'Label', placeholder: 'e.g. Non-binary' }]} />
          <ReferenceTableSection tableName="award_levels"  title="Award Levels"  columns={[{ key: 'label', label: 'Label', placeholder: 'e.g. 40 Show Award' }, { key: 'show_count', label: 'Show Count', type: 'number', placeholder: '40' }]} />
        </div>
      )}
      {activeTab === 'policies'  && <PolicyDocumentsSection />}
    </div>
  );
}