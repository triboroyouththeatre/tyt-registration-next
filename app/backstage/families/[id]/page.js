'use client';

import { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import Link from 'next/link';

const US_STATES = ['AL','AK','AZ','AR','CA','CO','CT','DE','FL','GA','HI','ID','IL','IN','IA','KS','KY','LA','ME','MD','MA','MI','MN','MS','MO','MT','NE','NV','NH','NJ','NM','NY','NC','ND','OH','OK','OR','PA','RI','SC','SD','TN','TX','UT','VT','VA','WA','WV','WI','WY'];

const labelStyle = { fontFamily: 'var(--font-display)', fontSize: '0.65rem', fontWeight: 600, letterSpacing: '0.08em', textTransform: 'uppercase', color: '#6b7280', display: 'block', marginBottom: '0.3rem' };
const inputStyle = { fontFamily: 'var(--font-body)', fontSize: '0.875rem', color: '#111', border: '1px solid #d1d5db', borderRadius: '6px', padding: '0.5rem 0.75rem', width: '100%', boxSizing: 'border-box', background: '#fff' };
const cardStyle = { background: '#fff', border: '1px solid #e5e7eb', borderRadius: '8px', padding: '1.25rem', marginBottom: '1rem' };
const sectionTitle = { fontFamily: 'var(--font-display)', fontSize: '0.7rem', fontWeight: 700, letterSpacing: '0.12em', textTransform: 'uppercase', color: '#6b7280', margin: '0 0 1rem 0', paddingBottom: '0.5rem', borderBottom: '1px solid #e5e7eb' };
const btnPrimary = { fontFamily: 'var(--font-display)', fontSize: '0.7rem', fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase', background: '#111', color: '#fff', border: 'none', borderRadius: '6px', padding: '0.5rem 1.25rem', cursor: 'pointer' };
const btnSecondary = { fontFamily: 'var(--font-display)', fontSize: '0.7rem', fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase', background: '#fff', color: '#374151', border: '1px solid #d1d5db', borderRadius: '6px', padding: '0.5rem 1.25rem', cursor: 'pointer' };

function Row({ label, value }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', gap: '1rem', marginBottom: '0.5rem' }}>
      <span style={{ fontFamily: 'var(--font-display)', fontSize: '0.7rem', fontWeight: 600, letterSpacing: '0.08em', textTransform: 'uppercase', color: '#9ca3af', flexShrink: 0 }}>{label}</span>
      <span style={{ fontFamily: 'var(--font-body)', fontSize: '0.875rem', color: '#111', textAlign: 'right' }}>{value || '—'}</span>
    </div>
  );
}

export default function FamilyDetailPage() {
  const params = useParams();
  const familyId = params?.id;

  const [loading, setLoading]         = useState(true);
  const [family, setFamily]           = useState(null);
  const [contacts, setContacts]       = useState([]);
  const [participants, setParticipants] = useState([]);
  const [registrations, setRegistrations] = useState([]);
  const [relationships, setRelationships] = useState([]);
  const [gradeLevels, setGradeLevels] = useState([]);

  const [editingFamily, setEditingFamily]   = useState(false);
  const [editingContacts, setEditingContacts] = useState(false);
  const [saving, setSaving]                 = useState(false);
  const [saveMsg, setSaveMsg]               = useState('');

  const [familyForm, setFamilyForm] = useState({});
  const [contactForms, setContactForms] = useState([]);

  useEffect(() => {
    async function load() {
      const supabase = createClient();

      const [
        { data: f },
        { data: ct },
        { data: p },
        { data: rl },
        { data: gl },
      ] = await Promise.all([
        supabase.from('families').select('*').eq('id', familyId).single(),
        supabase.from('contacts').select('*, relationships(label)').eq('family_id', familyId).order('priority'),
        supabase.from('participants').select('id, first_name, last_name, nickname, yog, is_active').eq('family_id', familyId).order('last_name'),
        supabase.from('relationships').select('id, label').order('label'),
        supabase.from('grade_levels').select('yog, label, seasons!inner(is_active)').eq('seasons.is_active', true),
      ]);

      // Get registrations for this family
      const { data: regs } = await supabase
        .from('registrations')
        .select(`
          id, registration_number, registered_at, amount_paid, total_fee,
          participants(first_name, last_name, nickname),
          registration_statuses(label),
          payments(payment_statuses(label)),
          carts(programs(label))
        `)
        .eq('family_id', familyId)
        .order('registered_at', { ascending: false });

      setFamily(f);
      setContacts(ct || []);
      setParticipants(p || []);
      setRegistrations(regs || []);
      setRelationships(rl || []);
      setGradeLevels(gl || []);

      if (f) setFamilyForm({
        email:   f.email   || '',
        street:  f.street  || '',
        street2: f.street2 || '',
        city:    f.city    || '',
        state:   f.state   || '',
        zip:     f.zip     || '',
      });

      // Init contact forms — always 4 slots
      const slots = [1, 2, 3, 4].map(priority => {
        const existing = ct?.find(c => c.priority === priority);
        return {
          priority,
          first_name:      existing?.first_name      || '',
          last_name:       existing?.last_name       || '',
          phone:           existing?.phone           || '',
          email:           existing?.email           || '',
          relationship_id: existing?.relationship_id || '',
          id:              existing?.id              || null,
        };
      });
      setContactForms(slots);

      setLoading(false);
    }
    load();
  }, [familyId]);

  async function saveFamily() {
    setSaving(true);
    const supabase = createClient();
    await supabase.from('families').update({
      email:   familyForm.email.trim(),
      street:  familyForm.street.trim()  || null,
      street2: familyForm.street2.trim() || null,
      city:    familyForm.city.trim()    || null,
      state:   familyForm.state          || null,
      zip:     familyForm.zip.trim()     || null,
    }).eq('id', familyId);
    setFamily(f => ({ ...f, ...familyForm }));
    setEditingFamily(false);
    setSaving(false);
    setSaveMsg('Family info updated.');
    setTimeout(() => setSaveMsg(''), 3000);
  }

  async function saveContacts() {
    setSaving(true);
    const supabase = createClient();

    for (const c of contactForms) {
      if (!c.first_name.trim() && !c.last_name.trim() && !c.phone.trim()) {
        // Empty slot — delete if existed
        if (c.id) await supabase.from('contacts').delete().eq('id', c.id);
        continue;
      }
      const payload = {
        family_id:       familyId,
        priority:        c.priority,
        first_name:      c.first_name.trim(),
        last_name:       c.last_name.trim(),
        phone:           c.phone.trim() || null,
        email:           c.email.trim() || null,
        relationship_id: c.relationship_id || null,
      };
      if (c.id) {
        await supabase.from('contacts').update(payload).eq('id', c.id);
      } else {
        await supabase.from('contacts').insert(payload);
      }
    }

    // Reload contacts
    const { data: updated } = await supabase
      .from('contacts').select('*, relationships(label)').eq('family_id', familyId).order('priority');
    setContacts(updated || []);
    setEditingContacts(false);
    setSaving(false);
    setSaveMsg('Contacts updated.');
    setTimeout(() => setSaveMsg(''), 3000);
  }

  function getGrade(yog) {
    return gradeLevels?.find(g => g.yog === yog)?.label || `YOG ${yog}`;
  }

  function displayName(p) {
    if (!p) return '—';
    return p.nickname ? `${p.nickname} ${p.last_name}` : `${p.first_name} ${p.last_name}`;
  }

  function fmtDate(str) {
    if (!str) return '—';
    return new Date(str).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
  }

  function fmt(amount) {
    return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(Number(amount) || 0);
  }

  if (loading) return <div style={{ padding: '3rem', textAlign: 'center', fontFamily: 'var(--font-body)', color: '#9ca3af', fontStyle: 'italic' }}>Loading...</div>;
  if (!family) return <div style={{ padding: '2rem' }}><Link href="/backstage/families" style={{ color: '#b40000' }}>← Families</Link><p>Family not found.</p></div>;

  const primary = contacts.find(c => c.priority === 1);

  return (
    <div>
      {/* Header */}
      <div style={{ marginBottom: '1.25rem' }}>
        <Link href="/backstage/families" style={{ fontFamily: 'var(--font-display)', fontSize: '0.7rem', fontWeight: 600, letterSpacing: '0.08em', textTransform: 'uppercase', color: '#6b7280', textDecoration: 'none' }}>← Families</Link>
        <h1 style={{ fontFamily: 'var(--font-display)', fontSize: '1.5rem', fontWeight: 800, letterSpacing: '0.05em', textTransform: 'uppercase', color: '#111', margin: '4px 0 0 0' }}>
          {primary ? `${primary.first_name} ${primary.last_name}` : family.email}
        </h1>
        <p style={{ fontFamily: 'var(--font-body)', fontSize: '0.875rem', color: '#6b7280', margin: '2px 0 0 0' }}>{family.email}</p>
      </div>

      {saveMsg && <div style={{ background: '#f0fdf4', border: '1px solid #bbf7d0', borderRadius: '6px', padding: '0.75rem 1rem', marginBottom: '1rem', fontFamily: 'var(--font-body)', fontSize: '0.875rem', color: '#16a34a' }}>✓ {saveMsg}</div>}

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>

        {/* LEFT */}
        <div>

          {/* Family info */}
          <div style={cardStyle}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
              <p style={sectionTitle}>Account Info</p>
              {!editingFamily && <button onClick={() => setEditingFamily(true)} style={{ ...btnSecondary, padding: '0.3rem 0.75rem', fontSize: '0.65rem' }}>Edit</button>}
            </div>

            {editingFamily ? (
              <div>
                <div style={{ marginBottom: '0.75rem' }}>
                  <label style={labelStyle}>Email</label>
                  <input type="email" value={familyForm.email} onChange={e => setFamilyForm(f => ({ ...f, email: e.target.value }))} style={inputStyle} />
                </div>
                <div style={{ marginBottom: '0.75rem' }}>
                  <label style={labelStyle}>Street</label>
                  <input type="text" value={familyForm.street} onChange={e => setFamilyForm(f => ({ ...f, street: e.target.value }))} style={inputStyle} />
                </div>
                <div style={{ marginBottom: '0.75rem' }}>
                  <label style={labelStyle}>Street 2</label>
                  <input type="text" value={familyForm.street2} onChange={e => setFamilyForm(f => ({ ...f, street2: e.target.value }))} style={inputStyle} />
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 80px 100px', gap: '0.5rem', marginBottom: '1rem' }}>
                  <div>
                    <label style={labelStyle}>City</label>
                    <input type="text" value={familyForm.city} onChange={e => setFamilyForm(f => ({ ...f, city: e.target.value }))} style={inputStyle} />
                  </div>
                  <div>
                    <label style={labelStyle}>State</label>
                    <select value={familyForm.state} onChange={e => setFamilyForm(f => ({ ...f, state: e.target.value }))} style={inputStyle}>
                      <option value="">—</option>
                      {US_STATES.map(s => <option key={s} value={s}>{s}</option>)}
                    </select>
                  </div>
                  <div>
                    <label style={labelStyle}>ZIP</label>
                    <input type="text" value={familyForm.zip} onChange={e => setFamilyForm(f => ({ ...f, zip: e.target.value }))} style={inputStyle} />
                  </div>
                </div>
                <div style={{ display: 'flex', gap: '0.5rem' }}>
                  <button onClick={saveFamily} disabled={saving} style={btnPrimary}>{saving ? 'Saving...' : 'Save'}</button>
                  <button onClick={() => setEditingFamily(false)} style={btnSecondary}>Cancel</button>
                </div>
              </div>
            ) : (
              <div>
                <Row label="Email"  value={family.email} />
                <Row label="Street" value={[family.street, family.street2].filter(Boolean).join(', ')} />
                <Row label="City"   value={[family.city, family.state, family.zip].filter(Boolean).join(', ')} />
                <Row label="Stripe" value={family.stripe_customer_id || 'Not linked'} />
              </div>
            )}
          </div>

          {/* Contacts */}
          <div style={cardStyle}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
              <p style={sectionTitle}>Contacts</p>
              {!editingContacts && <button onClick={() => setEditingContacts(true)} style={{ ...btnSecondary, padding: '0.3rem 0.75rem', fontSize: '0.65rem' }}>Edit</button>}
            </div>

            {editingContacts ? (
              <div>
                {contactForms.map((c, i) => (
                  <div key={c.priority} style={{ marginBottom: '1.25rem', paddingBottom: '1.25rem', borderBottom: i < 3 ? '1px solid #f3f4f6' : 'none' }}>
                    <p style={{ fontFamily: 'var(--font-display)', fontSize: '0.65rem', fontWeight: 600, letterSpacing: '0.1em', textTransform: 'uppercase', color: '#9ca3af', margin: '0 0 0.5rem 0' }}>
                      {c.priority <= 2 ? `Guardian ${c.priority}` : `Emergency Contact ${c.priority - 2}`}
                    </p>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.5rem', marginBottom: '0.5rem' }}>
                      <div>
                        <label style={labelStyle}>First Name</label>
                        <input type="text" value={c.first_name} onChange={e => setContactForms(f => f.map((cf, j) => j === i ? { ...cf, first_name: e.target.value } : cf))} style={inputStyle} />
                      </div>
                      <div>
                        <label style={labelStyle}>Last Name</label>
                        <input type="text" value={c.last_name} onChange={e => setContactForms(f => f.map((cf, j) => j === i ? { ...cf, last_name: e.target.value } : cf))} style={inputStyle} />
                      </div>
                    </div>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.5rem', marginBottom: '0.5rem' }}>
                      <div>
                        <label style={labelStyle}>Phone</label>
                        <input type="tel" value={c.phone} onChange={e => setContactForms(f => f.map((cf, j) => j === i ? { ...cf, phone: e.target.value } : cf))} style={inputStyle} />
                      </div>
                      <div>
                        <label style={labelStyle}>Email</label>
                        <input type="email" value={c.email} onChange={e => setContactForms(f => f.map((cf, j) => j === i ? { ...cf, email: e.target.value } : cf))} style={inputStyle} />
                      </div>
                    </div>
                    <div>
                      <label style={labelStyle}>Relationship</label>
                      <select value={c.relationship_id} onChange={e => setContactForms(f => f.map((cf, j) => j === i ? { ...cf, relationship_id: e.target.value } : cf))} style={inputStyle}>
                        <option value="">Select relationship</option>
                        {relationships.map(r => <option key={r.id} value={r.id}>{r.label}</option>)}
                      </select>
                    </div>
                  </div>
                ))}
                <div style={{ display: 'flex', gap: '0.5rem' }}>
                  <button onClick={saveContacts} disabled={saving} style={btnPrimary}>{saving ? 'Saving...' : 'Save Contacts'}</button>
                  <button onClick={() => setEditingContacts(false)} style={btnSecondary}>Cancel</button>
                </div>
              </div>
            ) : (
              <div>
                {contacts.length === 0 ? (
                  <p style={{ fontFamily: 'var(--font-body)', fontSize: '0.875rem', color: '#9ca3af', fontStyle: 'italic' }}>No contacts on file.</p>
                ) : contacts.map(c => (
                  <div key={c.id} style={{ marginBottom: '0.875rem', paddingBottom: '0.875rem', borderBottom: '1px solid #f3f4f6' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
                      <p style={{ fontFamily: 'var(--font-body)', fontSize: '0.875rem', fontWeight: 600, color: '#111', margin: 0 }}>{c.first_name} {c.last_name}</p>
                      <span style={{ fontFamily: 'var(--font-display)', fontSize: '0.6rem', fontWeight: 600, letterSpacing: '0.08em', textTransform: 'uppercase', color: '#e0bf5c', background: '#1a1200', border: '1px solid #e0bf5c30', borderRadius: '3px', padding: '0.15rem 0.4rem' }}>
                        {c.priority <= 2 ? `Guardian ${c.priority}` : `EC ${c.priority - 2}`}
                      </span>
                    </div>
                    {c.relationships?.label && <p style={{ fontFamily: 'var(--font-body)', fontSize: '0.78rem', color: '#6b7280', margin: '2px 0' }}>{c.relationships.label}</p>}
                    {c.phone && <p style={{ fontFamily: 'var(--font-body)', fontSize: '0.8rem', color: '#374151', margin: 0 }}>📞 {c.phone}</p>}
                    {c.email && <p style={{ fontFamily: 'var(--font-body)', fontSize: '0.8rem', color: '#374151', margin: 0 }}>✉ {c.email}</p>}
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* RIGHT */}
        <div>

          {/* Participants */}
          <div style={cardStyle}>
            <p style={sectionTitle}>Participants ({participants.length})</p>
            {participants.length === 0 ? (
              <p style={{ fontFamily: 'var(--font-body)', fontSize: '0.875rem', color: '#9ca3af', fontStyle: 'italic' }}>No participants.</p>
            ) : participants.map(p => (
              <div key={p.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '0.5rem 0', borderBottom: '1px solid #f3f4f6' }}>
                <div>
                  <p style={{ fontFamily: 'var(--font-body)', fontSize: '0.875rem', fontWeight: 600, color: '#111', margin: 0 }}>{displayName(p)}</p>
                  <p style={{ fontFamily: 'var(--font-body)', fontSize: '0.75rem', color: '#9ca3af', margin: 0 }}>{getGrade(p.yog)}</p>
                </div>
                <Link href={`/backstage/participants/${p.id}`} style={{ fontFamily: 'var(--font-display)', fontSize: '0.65rem', fontWeight: 600, letterSpacing: '0.08em', textTransform: 'uppercase', color: '#374151', textDecoration: 'none', border: '1px solid #e5e7eb', borderRadius: '4px', padding: '0.3rem 0.75rem' }}>
                  View
                </Link>
              </div>
            ))}
          </div>

          {/* Registration history */}
          <div style={cardStyle}>
            <p style={sectionTitle}>Registration History ({registrations.length})</p>
            {registrations.length === 0 ? (
              <p style={{ fontFamily: 'var(--font-body)', fontSize: '0.875rem', color: '#9ca3af', fontStyle: 'italic' }}>No registrations.</p>
            ) : registrations.map(r => {
              const regStatus = r.registration_statuses?.label;
              const payStatus = r.payments?.[0]?.payment_statuses?.label;
              const balance   = (parseFloat(r.total_fee) || 0) - (parseFloat(r.amount_paid) || 0);
              const regColor  = regStatus === 'Active' ? '#16a34a' : regStatus === 'Cancelled' ? '#b40000' : '#d97706';
              const payColor  = payStatus === 'Paid'   ? '#16a34a' : payStatus === 'Overdue'  ? '#b40000' : '#d97706';

              return (
                <div key={r.id} style={{ padding: '0.75rem 0', borderBottom: '1px solid #f3f4f6' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                    <div>
                      <p style={{ fontFamily: 'var(--font-body)', fontSize: '0.875rem', fontWeight: 600, color: '#111', margin: 0 }}>{displayName(r.participants)}</p>
                      <p style={{ fontFamily: 'var(--font-body)', fontSize: '0.75rem', color: '#9ca3af', margin: 0 }}>{r.carts?.programs?.label || '—'} · #{r.registration_number} · {fmtDate(r.registered_at)}</p>
                    </div>
                    <div style={{ textAlign: 'right' }}>
                      <p style={{ fontFamily: 'var(--font-body)', fontSize: '0.875rem', color: '#111', margin: 0 }}>{fmt(r.amount_paid)}</p>
                      {balance > 0.01 && <p style={{ fontFamily: 'var(--font-body)', fontSize: '0.75rem', color: '#b40000', margin: 0 }}>{fmt(balance)} due</p>}
                    </div>
                  </div>
                  <div style={{ display: 'flex', gap: '0.4rem', marginTop: '0.4rem' }}>
                    <span style={{ fontFamily: 'var(--font-display)', fontSize: '0.6rem', fontWeight: 600, letterSpacing: '0.06em', textTransform: 'uppercase', color: regColor, background: `${regColor}15`, border: `1px solid ${regColor}30`, borderRadius: '3px', padding: '0.15rem 0.4rem' }}>{regStatus}</span>
                    {payStatus && <span style={{ fontFamily: 'var(--font-display)', fontSize: '0.6rem', fontWeight: 600, letterSpacing: '0.06em', textTransform: 'uppercase', color: payColor, background: `${payColor}15`, border: `1px solid ${payColor}30`, borderRadius: '3px', padding: '0.15rem 0.4rem' }}>{payStatus}</span>}
                    <Link href={`/backstage/registrations/${r.id}`} style={{ fontFamily: 'var(--font-display)', fontSize: '0.6rem', fontWeight: 600, letterSpacing: '0.06em', textTransform: 'uppercase', color: '#6b7280', textDecoration: 'none', border: '1px solid #e5e7eb', borderRadius: '3px', padding: '0.15rem 0.4rem' }}>View →</Link>
                  </div>
                </div>
              );
            })}
          </div>

        </div>
      </div>
    </div>
  );
}