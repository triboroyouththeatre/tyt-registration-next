'use client';

import { useState, useEffect, useRef } from 'react';
import { createClient } from '@/lib/supabase/client';

// ── Styles ─────────────────────────────────────────────────────────────────────
const labelStyle = { fontFamily: 'var(--font-display)', fontSize: '0.65rem', fontWeight: 600, letterSpacing: '0.08em', textTransform: 'uppercase', color: '#6b7280', display: 'block', marginBottom: '0.3rem' };
const inputStyle = { fontFamily: 'var(--font-body)', fontSize: '0.875rem', color: '#111', border: '1px solid #d1d5db', borderRadius: '6px', padding: '0.5rem 0.75rem', width: '100%', boxSizing: 'border-box', background: '#fff' };
const cardStyle = { background: '#fff', border: '1px solid #e5e7eb', borderRadius: '8px', padding: '1.25rem', marginBottom: '1rem' };
const sectionTitle = { fontFamily: 'var(--font-display)', fontSize: '0.7rem', fontWeight: 700, letterSpacing: '0.12em', textTransform: 'uppercase', color: '#6b7280', margin: '0 0 1rem 0', paddingBottom: '0.5rem', borderBottom: '1px solid #e5e7eb' };
const btnPrimary = { fontFamily: 'var(--font-display)', fontSize: '0.7rem', fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase', background: '#111', color: '#fff', border: 'none', borderRadius: '6px', padding: '0.5rem 1.25rem', cursor: 'pointer' };
const btnSecondary = { fontFamily: 'var(--font-display)', fontSize: '0.7rem', fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase', background: '#fff', color: '#374151', border: '1px solid #d1d5db', borderRadius: '6px', padding: '0.5rem 1.25rem', cursor: 'pointer' };
const btnDanger = { ...btnPrimary, background: '#b40000' };
const btnSmall = { ...btnSecondary, padding: '0.3rem 0.75rem', fontSize: '0.65rem' };

const TABS = [
  { id: 'seasons',    label: 'Seasons & Sessions' },
  { id: 'emails',     label: 'Email Templates' },
  { id: 'reference',  label: 'Reference Tables' },
  { id: 'policies',   label: 'Policy Documents' },
];

// ── Simple Rich Text Editor ────────────────────────────────────────────────────
function RichTextEditor({ value, onChange }) {
  const editorRef = useRef(null);

  useEffect(() => {
    if (editorRef.current && editorRef.current.innerHTML !== value) {
      editorRef.current.innerHTML = value || '';
    }
  }, []);

  function execCmd(cmd, val = null) {
    document.execCommand(cmd, false, val);
    editorRef.current?.focus();
    handleInput();
  }

  function handleInput() {
    onChange(editorRef.current?.innerHTML || '');
  }

  const btnToolbar = { fontFamily: 'var(--font-body)', fontSize: '0.8rem', fontWeight: 700, background: '#fff', border: '1px solid #d1d5db', borderRadius: '4px', padding: '0.25rem 0.6rem', cursor: 'pointer', color: '#374151' };

  return (
    <div style={{ border: '1px solid #d1d5db', borderRadius: '6px', overflow: 'hidden' }}>
      {/* Toolbar */}
      <div style={{ background: '#f9fafb', borderBottom: '1px solid #e5e7eb', padding: '0.4rem 0.5rem', display: 'flex', gap: '0.25rem', flexWrap: 'wrap' }}>
        {[
          { label: 'B', cmd: 'bold', style: { fontWeight: 700 } },
          { label: 'I', cmd: 'italic', style: { fontStyle: 'italic' } },
          { label: 'U', cmd: 'underline', style: { textDecoration: 'underline' } },
        ].map(b => (
          <button key={b.cmd} onMouseDown={e => { e.preventDefault(); execCmd(b.cmd); }} style={{ ...btnToolbar, ...b.style }}>{b.label}</button>
        ))}
        <div style={{ width: '1px', background: '#e5e7eb', margin: '0 0.25rem' }} />
        <button onMouseDown={e => { e.preventDefault(); execCmd('insertUnorderedList'); }} style={btnToolbar}>• List</button>
        <button onMouseDown={e => { e.preventDefault(); execCmd('insertOrderedList'); }} style={btnToolbar}>1. List</button>
        <div style={{ width: '1px', background: '#e5e7eb', margin: '0 0.25rem' }} />
        <button onMouseDown={e => { e.preventDefault(); const url = prompt('URL:'); if (url) execCmd('createLink', url); }} style={btnToolbar}>Link</button>
        <button onMouseDown={e => { e.preventDefault(); execCmd('removeFormat'); }} style={btnToolbar}>Clear</button>
      </div>
      {/* Content area */}
      <div
        ref={editorRef}
        contentEditable
        onInput={handleInput}
        style={{ minHeight: '200px', padding: '0.875rem', fontFamily: 'var(--font-body)', fontSize: '0.875rem', color: '#111', outline: 'none', lineHeight: 1.7 }}
        suppressContentEditableWarning
      />
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
  const [newSession, setNewSession] = useState({ name: '', season_id: '', is_active: false });
  const [addingSeason, setAddingSeason]   = useState(false);
  const [addingSession, setAddingSession] = useState(false);
  const [editingSeason, setEditingSeason] = useState(null);
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
    if (id) {
      await supabase.from('seasons').update(data).eq('id', id);
    } else {
      await supabase.from('seasons').insert(data);
    }
    await load();
    setAddingSeason(false);
    setEditingSeason(null);
    setNewSeason({ name: '', display_name: '', is_active: false });
    setSaving(false);
    setMsg('Saved!');
    setTimeout(() => setMsg(''), 2000);
  }

  async function saveSession(data, id = null) {
    setSaving(true);
    const supabase = createClient();
    if (id) {
      await supabase.from('sessions').update(data).eq('id', id);
    } else {
      await supabase.from('sessions').insert(data);
    }
    await load();
    setAddingSession(false);
    setEditingSession(null);
    setNewSession({ name: '', season_id: '', is_active: false });
    setSaving(false);
    setMsg('Saved!');
    setTimeout(() => setMsg(''), 2000);
  }

  async function setActiveSeason(id) {
    setSaving(true);
    const supabase = createClient();
    await supabase.from('seasons').update({ is_active: false }).neq('id', id);
    await supabase.from('seasons').update({ is_active: true }).eq('id', id);
    await load();
    setSaving(false);
    setMsg('Active season updated!');
    setTimeout(() => setMsg(''), 2000);
  }

  return (
    <div>
      {msg && <div style={{ background: '#f0fdf4', border: '1px solid #bbf7d0', borderRadius: '6px', padding: '0.5rem 1rem', marginBottom: '1rem', fontFamily: 'var(--font-body)', fontSize: '0.875rem', color: '#16a34a' }}>✓ {msg}</div>}

      {/* Seasons */}
      <div style={cardStyle}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
          <p style={sectionTitle}>Seasons</p>
          <button onClick={() => setAddingSeason(true)} style={{ ...btnPrimary, padding: '0.35rem 0.875rem', fontSize: '0.65rem' }}>+ New Season</button>
        </div>

        {addingSeason && (
          <div style={{ background: '#f9fafb', border: '1px solid #e5e7eb', borderRadius: '6px', padding: '1rem', marginBottom: '1rem' }}>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem', marginBottom: '0.75rem' }}>
              <div>
                <label style={labelStyle}>Season Year <span style={{ color: '#b40000' }}>*</span></label>
                <input type="text" value={newSeason.name} onChange={e => setNewSeason(s => ({ ...s, name: e.target.value }))} style={inputStyle} placeholder="e.g. 2027" />
              </div>
              <div>
                <label style={labelStyle}>Display Name <span style={{ color: '#b40000' }}>*</span></label>
                <input type="text" value={newSeason.display_name} onChange={e => setNewSeason(s => ({ ...s, display_name: e.target.value }))} style={inputStyle} placeholder="e.g. 2026-2027" />
              </div>
            </div>
            <div style={{ marginBottom: '0.75rem' }}>
              <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', cursor: 'pointer' }}>
                <input type="checkbox" checked={newSeason.is_active} onChange={e => setNewSeason(s => ({ ...s, is_active: e.target.checked }))} style={{ width: '16px', height: '16px', accentColor: '#16a34a' }} />
                <span style={{ fontFamily: 'var(--font-body)', fontSize: '0.875rem', color: '#374151' }}>Set as active season</span>
              </label>
            </div>
            <div style={{ display: 'flex', gap: '0.5rem' }}>
              <button onClick={() => saveSeason(newSeason)} disabled={saving} style={btnPrimary}>Save</button>
              <button onClick={() => setAddingSeason(false)} style={btnSecondary}>Cancel</button>
            </div>
          </div>
        )}

        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead>
            <tr style={{ background: '#f9fafb' }}>
              {['Year', 'Display Name', 'Status', ''].map(col => (
                <th key={col} style={{ padding: '0.5rem 0.75rem', fontFamily: 'var(--font-display)', fontSize: '0.65rem', fontWeight: 600, letterSpacing: '0.1em', textTransform: 'uppercase', color: '#6b7280', textAlign: 'left', borderBottom: '1px solid #e5e7eb' }}>{col}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {seasons.map((s, i) => (
              <tr key={s.id} style={{ borderBottom: '1px solid #f3f4f6', background: i % 2 === 0 ? '#fff' : '#fafafa' }}>
                <td style={{ padding: '0.625rem 0.75rem', fontFamily: 'var(--font-body)', fontSize: '0.875rem', fontWeight: 600, color: '#111' }}>
                  {editingSeason?.id === s.id ? (
                    <input type="text" value={editingSeason.name} onChange={e => setEditingSeason(es => ({ ...es, name: e.target.value }))} style={{ ...inputStyle, maxWidth: '100px' }} />
                  ) : s.name}
                </td>
                <td style={{ padding: '0.625rem 0.75rem', fontFamily: 'var(--font-body)', fontSize: '0.875rem', color: '#374151' }}>
                  {editingSeason?.id === s.id ? (
                    <input type="text" value={editingSeason.display_name} onChange={e => setEditingSeason(es => ({ ...es, display_name: e.target.value }))} style={{ ...inputStyle, maxWidth: '150px' }} />
                  ) : s.display_name}
                </td>
                <td style={{ padding: '0.625rem 0.75rem' }}>
                  {s.is_active ? (
                    <span style={{ fontFamily: 'var(--font-display)', fontSize: '0.6rem', fontWeight: 600, letterSpacing: '0.06em', textTransform: 'uppercase', color: '#16a34a', background: '#f0fdf4', border: '1px solid #bbf7d0', borderRadius: '3px', padding: '0.2rem 0.5rem' }}>★ Active</span>
                  ) : (
                    <button onClick={() => setActiveSeason(s.id)} style={{ ...btnSmall, color: '#6b7280' }}>Set Active</button>
                  )}
                </td>
                <td style={{ padding: '0.625rem 0.75rem' }}>
                  {editingSeason?.id === s.id ? (
                    <div style={{ display: 'flex', gap: '0.4rem' }}>
                      <button onClick={() => saveSeason({ name: editingSeason.name, display_name: editingSeason.display_name }, s.id)} style={btnSmall}>Save</button>
                      <button onClick={() => setEditingSeason(null)} style={btnSmall}>Cancel</button>
                    </div>
                  ) : (
                    <button onClick={() => setEditingSeason(s)} style={btnSmall}>Edit</button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Sessions */}
      <div style={cardStyle}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
          <p style={sectionTitle}>Sessions</p>
          <button onClick={() => setAddingSession(true)} style={{ ...btnPrimary, padding: '0.35rem 0.875rem', fontSize: '0.65rem' }}>+ New Session</button>
        </div>

        {addingSession && (
          <div style={{ background: '#f9fafb', border: '1px solid #e5e7eb', borderRadius: '6px', padding: '1rem', marginBottom: '1rem' }}>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem', marginBottom: '0.75rem' }}>
              <div>
                <label style={labelStyle}>Session Name <span style={{ color: '#b40000' }}>*</span></label>
                <input type="text" value={newSession.name} onChange={e => setNewSession(s => ({ ...s, name: e.target.value }))} style={inputStyle} placeholder="e.g. Winter" />
              </div>
              <div>
                <label style={labelStyle}>Season <span style={{ color: '#b40000' }}>*</span></label>
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
          <thead>
            <tr style={{ background: '#f9fafb' }}>
              {['Session', 'Season', ''].map(col => (
                <th key={col} style={{ padding: '0.5rem 0.75rem', fontFamily: 'var(--font-display)', fontSize: '0.65rem', fontWeight: 600, letterSpacing: '0.1em', textTransform: 'uppercase', color: '#6b7280', textAlign: 'left', borderBottom: '1px solid #e5e7eb' }}>{col}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {sessions.map((s, i) => {
              const season = seasons.find(ss => ss.id === s.season_id);
              return (
                <tr key={s.id} style={{ borderBottom: '1px solid #f3f4f6', background: i % 2 === 0 ? '#fff' : '#fafafa' }}>
                  <td style={{ padding: '0.625rem 0.75rem', fontFamily: 'var(--font-body)', fontSize: '0.875rem', fontWeight: 600, color: '#111' }}>
                    {editingSession?.id === s.id ? (
                      <input type="text" value={editingSession.name} onChange={e => setEditingSession(es => ({ ...es, name: e.target.value }))} style={{ ...inputStyle, maxWidth: '150px' }} />
                    ) : s.name}
                  </td>
                  <td style={{ padding: '0.625rem 0.75rem', fontFamily: 'var(--font-body)', fontSize: '0.875rem', color: '#374151' }}>
                    {editingSession?.id === s.id ? (
                      <select value={editingSession.season_id} onChange={e => setEditingSession(es => ({ ...es, season_id: e.target.value }))} style={{ ...inputStyle, maxWidth: '200px' }}>
                        {seasons.map(ss => <option key={ss.id} value={ss.id}>{ss.display_name}</option>)}
                      </select>
                    ) : season?.display_name || '—'}
                  </td>
                  <td style={{ padding: '0.625rem 0.75rem' }}>
                    {editingSession?.id === s.id ? (
                      <div style={{ display: 'flex', gap: '0.4rem' }}>
                        <button onClick={() => saveSession({ name: editingSession.name, season_id: editingSession.season_id }, s.id)} style={btnSmall}>Save</button>
                        <button onClick={() => setEditingSession(null)} style={btnSmall}>Cancel</button>
                      </div>
                    ) : (
                      <button onClick={() => setEditingSession(s)} style={btnSmall}>Edit</button>
                    )}
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
  const [templates, setTemplates] = useState([]);
  const [active, setActive]       = useState(null);
  const [form, setForm]           = useState({});
  const [saving, setSaving]       = useState(false);
  const [msg, setMsg]             = useState('');
  const [preview, setPreview]     = useState(false);

  useEffect(() => { load(); }, []);

  async function load() {
    const supabase = createClient();
    const { data } = await supabase.from('email_templates').select('*').order('label');
    setTemplates(data || []);
    if (data?.length && !active) {
      setActive(data[0]);
      setForm({ subject: data[0].subject, body_html: data[0].body_html });
    }
  }

  function selectTemplate(t) {
    setActive(t);
    setForm({ subject: t.subject, body_html: t.body_html });
    setPreview(false);
  }

  async function save() {
    setSaving(true);
    const supabase = createClient();
    await supabase.from('email_templates').update({
      subject:   form.subject,
      body_html: form.body_html,
      updated_at: new Date().toISOString(),
    }).eq('id', active.id);
    await load();
    setSaving(false);
    setMsg('Template saved!');
    setTimeout(() => setMsg(''), 2000);
  }

  if (!active) return <div style={{ padding: '2rem', color: '#9ca3af', fontStyle: 'italic', fontFamily: 'var(--font-body)' }}>Loading...</div>;

  return (
    <div style={{ display: 'grid', gridTemplateColumns: '220px 1fr', gap: '1rem' }}>
      {/* Template list */}
      <div>
        {templates.map(t => (
          <button key={t.id} onClick={() => selectTemplate(t)} style={{ display: 'block', width: '100%', textAlign: 'left', padding: '0.75rem 1rem', marginBottom: '0.25rem', borderRadius: '6px', border: `1px solid ${active.id === t.id ? '#111' : '#e5e7eb'}`, background: active.id === t.id ? '#111' : '#fff', color: active.id === t.id ? '#fff' : '#374151', fontFamily: 'var(--font-body)', fontSize: '0.875rem', cursor: 'pointer', fontWeight: active.id === t.id ? 600 : 400 }}>
            {t.label}
          </button>
        ))}
      </div>

      {/* Editor */}
      <div style={cardStyle}>
        <div style={{ marginBottom: '1rem' }}>
          <p style={{ ...sectionTitle, marginBottom: '0.25rem' }}>{active.label}</p>
          <p style={{ fontFamily: 'var(--font-body)', fontSize: '0.8rem', color: '#9ca3af', margin: 0 }}>{active.description}</p>
        </div>

        {msg && <div style={{ background: '#f0fdf4', border: '1px solid #bbf7d0', borderRadius: '6px', padding: '0.5rem 1rem', marginBottom: '1rem', fontFamily: 'var(--font-body)', fontSize: '0.875rem', color: '#16a34a' }}>✓ {msg}</div>}

        {/* Available variables */}
        {active.variables?.length > 0 && (
          <div style={{ background: '#f9fafb', border: '1px solid #e5e7eb', borderRadius: '6px', padding: '0.75rem 1rem', marginBottom: '1rem' }}>
            <p style={{ fontFamily: 'var(--font-display)', fontSize: '0.65rem', fontWeight: 600, letterSpacing: '0.1em', textTransform: 'uppercase', color: '#6b7280', margin: '0 0 0.4rem 0' }}>Available Variables</p>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.35rem' }}>
              {active.variables.map(v => (
                <code key={v} style={{ fontFamily: 'monospace', fontSize: '0.75rem', background: '#e5e7eb', borderRadius: '3px', padding: '0.15rem 0.4rem', color: '#374151' }}>{v}</code>
              ))}
            </div>
          </div>
        )}

        <div style={{ marginBottom: '0.75rem' }}>
          <label style={labelStyle}>Subject Line</label>
          <input type="text" value={form.subject} onChange={e => setForm(f => ({ ...f, subject: e.target.value }))} style={inputStyle} />
        </div>

        <div style={{ marginBottom: '1rem' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.3rem' }}>
            <label style={labelStyle}>Email Body</label>
            <button onClick={() => setPreview(!preview)} style={{ ...btnSmall }}>
              {preview ? 'Edit' : 'Preview'}
            </button>
          </div>
          {preview ? (
            <div style={{ border: '1px solid #d1d5db', borderRadius: '6px', padding: '1rem', minHeight: '200px', fontFamily: 'var(--font-body)', fontSize: '0.875rem', lineHeight: 1.7, background: '#fff' }} dangerouslySetInnerHTML={{ __html: form.body_html }} />
          ) : (
            <RichTextEditor value={form.body_html} onChange={v => setForm(f => ({ ...f, body_html: v }))} />
          )}
        </div>

        <button onClick={save} disabled={saving} style={btnPrimary}>{saving ? 'Saving...' : 'Save Template'}</button>
      </div>
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
    if (id) {
      await supabase.from(tableName).update(data).eq('id', id);
    } else {
      await supabase.from(tableName).insert(data);
    }
    await load();
    setAdding(false);
    setEditing(null);
    setNewRow({});
    setSaving(false);
    setMsg('Saved!');
    setTimeout(() => setMsg(''), 2000);
  }

  async function deleteRow(id) {
    if (!confirm('Delete this entry? This cannot be undone.')) return;
    const supabase = createClient();
    await supabase.from(tableName).delete().eq('id', id);
    await load();
  }

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
        <thead>
          <tr style={{ background: '#f9fafb' }}>
            {columns.map(col => (
              <th key={col.key} style={{ padding: '0.5rem 0.75rem', fontFamily: 'var(--font-display)', fontSize: '0.65rem', fontWeight: 600, letterSpacing: '0.1em', textTransform: 'uppercase', color: '#6b7280', textAlign: 'left', borderBottom: '1px solid #e5e7eb' }}>{col.label}</th>
            ))}
            <th style={{ padding: '0.5rem 0.75rem', borderBottom: '1px solid #e5e7eb' }} />
          </tr>
        </thead>
        <tbody>
          {rows.map((row, i) => (
            <tr key={row.id} style={{ borderBottom: '1px solid #f3f4f6', background: i % 2 === 0 ? '#fff' : '#fafafa' }}>
              {columns.map(col => (
                <td key={col.key} style={{ padding: '0.625rem 0.75rem', fontFamily: 'var(--font-body)', fontSize: '0.875rem', color: '#111' }}>
                  {editing?.id === row.id ? (
                    <input type={col.type || 'text'} value={editing[col.key] || ''} onChange={e => setEditing(r => ({ ...r, [col.key]: col.type === 'number' ? parseInt(e.target.value) : e.target.value }))} style={{ ...inputStyle, maxWidth: '200px' }} />
                  ) : row[col.key]}
                </td>
              ))}
              <td style={{ padding: '0.625rem 0.75rem' }}>
                {editing?.id === row.id ? (
                  <div style={{ display: 'flex', gap: '0.4rem' }}>
                    <button onClick={() => { const d = {}; columns.forEach(c => { d[c.key] = editing[c.key]; }); save(d, row.id); }} style={btnSmall}>Save</button>
                    <button onClick={() => setEditing(null)} style={btnSmall}>Cancel</button>
                  </div>
                ) : (
                  <div style={{ display: 'flex', gap: '0.4rem' }}>
                    <button onClick={() => setEditing(row)} style={btnSmall}>Edit</button>
                    <button onClick={() => deleteRow(row.id)} style={{ ...btnSmall, color: '#b40000', borderColor: '#b40000' }}>Delete</button>
                  </div>
                )}
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
  const [docs, setDocs]     = useState([]);
  const [active, setActive] = useState(null);
  const [content, setContent] = useState('');
  const [saving, setSaving] = useState(false);
  const [msg, setMsg]       = useState('');

  const DOC_LABELS = {
    payment_agreement: 'Registration Fee Policy',
    participant_rules: 'Participation Policy & Behavior Standards',
    liability_waiver:  'Health & Safety — Liability Waiver',
  };

  useEffect(() => { load(); }, []);

  async function load() {
    const supabase = createClient();
    const { data } = await supabase.from('policy_documents').select('id, type, is_current').eq('is_current', true).order('type');
    setDocs(data || []);
    if (data?.length && !active) {
      loadDoc(data[0]);
    }
  }

  async function loadDoc(doc) {
    const supabase = createClient();
    const { data } = await supabase.from('policy_documents').select('*').eq('id', doc.id).single();
    setActive(data);
    setContent(data?.content || '');
  }

  async function save() {
    setSaving(true);
    const supabase = createClient();
    await supabase.from('policy_documents').update({ content, updated_at: new Date().toISOString() }).eq('id', active.id);
    setSaving(false);
    setMsg('Policy document saved!');
    setTimeout(() => setMsg(''), 2000);
  }

  if (!active) return <div style={{ padding: '2rem', color: '#9ca3af', fontStyle: 'italic', fontFamily: 'var(--font-body)' }}>Loading...</div>;

  return (
    <div style={{ display: 'grid', gridTemplateColumns: '220px 1fr', gap: '1rem' }}>
      <div>
        {docs.map(d => (
          <button key={d.id} onClick={() => loadDoc(d)} style={{ display: 'block', width: '100%', textAlign: 'left', padding: '0.75rem 1rem', marginBottom: '0.25rem', borderRadius: '6px', border: `1px solid ${active.id === d.id ? '#111' : '#e5e7eb'}`, background: active.id === d.id ? '#111' : '#fff', color: active.id === d.id ? '#fff' : '#374151', fontFamily: 'var(--font-body)', fontSize: '0.875rem', cursor: 'pointer', fontWeight: active.id === d.id ? 600 : 400 }}>
            {DOC_LABELS[d.type] || d.type}
          </button>
        ))}
      </div>

      <div style={cardStyle}>
        <p style={sectionTitle}>{DOC_LABELS[active.type] || active.type}</p>

        {msg && <div style={{ background: '#f0fdf4', border: '1px solid #bbf7d0', borderRadius: '6px', padding: '0.5rem 1rem', marginBottom: '1rem', fontFamily: 'var(--font-body)', fontSize: '0.875rem', color: '#16a34a' }}>✓ {msg}</div>}

        <div style={{ marginBottom: '1rem' }}>
          <RichTextEditor value={content} onChange={setContent} />
        </div>

        <button onClick={save} disabled={saving} style={btnPrimary}>{saving ? 'Saving...' : 'Save Document'}</button>
      </div>
    </div>
  );
}

// ── Main Settings Page ─────────────────────────────────────────────────────────
export default function SettingsPage() {
  const [activeTab, setActiveTab] = useState('seasons');

  return (
    <div>
      <div style={{ marginBottom: '1.25rem' }}>
        <h1 style={{ fontFamily: 'var(--font-display)', fontSize: '1.5rem', fontWeight: 800, letterSpacing: '0.05em', textTransform: 'uppercase', color: '#111', margin: 0 }}>Settings</h1>
      </div>

      {/* Sub-tabs */}
      <div style={{ display: 'flex', gap: '0.25rem', marginBottom: '1.5rem', borderBottom: '2px solid #e5e7eb', paddingBottom: '0' }}>
        {TABS.map(tab => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            style={{
              fontFamily: 'var(--font-display)', fontSize: '0.75rem', fontWeight: 700,
              letterSpacing: '0.08em', textTransform: 'uppercase',
              padding: '0.625rem 1.25rem', cursor: 'pointer',
              border: 'none', background: 'none',
              color: activeTab === tab.id ? '#b40000' : '#6b7280',
              borderBottom: `2px solid ${activeTab === tab.id ? '#b40000' : 'transparent'}`,
              marginBottom: '-2px',
            }}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {activeTab === 'seasons' && <SeasonsSection />}
      {activeTab === 'emails' && <EmailTemplatesSection />}
      {activeTab === 'reference' && (
        <div>
          <ReferenceTableSection
            tableName="relationships"
            title="Relationships"
            columns={[{ key: 'label', label: 'Label', placeholder: 'e.g. Grandparent' }]}
          />
          <ReferenceTableSection
            tableName="genders"
            title="Genders"
            columns={[{ key: 'label', label: 'Label', placeholder: 'e.g. Non-binary' }]}
          />
          <ReferenceTableSection
            tableName="award_levels"
            title="Award Levels"
            columns={[
              { key: 'label', label: 'Label', placeholder: 'e.g. 40 Show Award' },
              { key: 'show_count', label: 'Show Count', type: 'number', placeholder: '40' },
            ]}
          />
        </div>
      )}
      {activeTab === 'policies' && <PolicyDocumentsSection />}
    </div>
  );
}