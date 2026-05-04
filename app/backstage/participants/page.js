import { createClient } from '@/lib/supabase/server';
import { redirect } from 'next/navigation';
import Link from 'next/link';

export default async function ParticipantsPage({ searchParams }) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/login');
  const { data: profile } = await supabase.from('profiles').select('role').eq('id', user.id).single();
  if (profile?.role !== 'admin') redirect('/dashboard');

  const sp = await searchParams;
  const search = sp?.q || '';
  const filterGrade = sp?.grade || '';

  const { data: participants } = await supabase
    .from('participants')
    .select(`
      id, first_name, last_name, nickname, yog, is_active,
      genders(label),
      families(email, contacts(first_name, last_name, priority))
    `)
    .order('last_name');

  const { data: gradeLevels } = await supabase
    .from('grade_levels')
    .select('yog, label, seasons!inner(is_active)')
    .eq('seasons.is_active', true)
    .order('yog');

  const participantIds = (participants || []).map(p => p.id);
  const { data: regCounts } = await supabase
    .from('registrations')
    .select('participant_id')
    .in('participant_id', participantIds.length > 0 ? participantIds : ['00000000-0000-0000-0000-000000000000']);

  const regCountMap = {};
  (regCounts || []).forEach(r => {
    regCountMap[r.participant_id] = (regCountMap[r.participant_id] || 0) + 1;
  });

  function getGrade(yog) {
    return gradeLevels?.find(g => g.yog === yog)?.label || `YOG ${yog}`;
  }

  function displayName(p) {
    return p.nickname ? `${p.nickname} ${p.last_name}` : `${p.first_name} ${p.last_name}`;
  }

  let filtered = (participants || []).filter(p => {
    if (!p.is_active) return false;
    if (filterGrade && String(p.yog) !== filterGrade) return false;
    if (!search) return true;
    const q = search.toLowerCase();
    const guardian = p.families?.contacts?.find(c => c.priority === 1);
    return (
      p.first_name?.toLowerCase().includes(q) ||
      p.last_name?.toLowerCase().includes(q) ||
      p.nickname?.toLowerCase().includes(q) ||
      p.families?.email?.toLowerCase().includes(q) ||
      guardian?.last_name?.toLowerCase().includes(q)
    );
  });

  const thStyle = { padding: '0.625rem 1rem', fontFamily: 'var(--font-display)', fontSize: '0.65rem', fontWeight: 600, letterSpacing: '0.1em', textTransform: 'uppercase', color: '#6b7280', background: '#f9fafb', borderBottom: '1px solid #e5e7eb', textAlign: 'left', whiteSpace: 'nowrap' };

  return (
    <div>
      <div style={{ marginBottom: '1.25rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <h1 style={{ fontFamily: 'var(--font-display)', fontSize: '1.5rem', fontWeight: 800, letterSpacing: '0.05em', textTransform: 'uppercase', color: '#111', margin: 0 }}>Participants</h1>
        <span style={{ fontFamily: 'var(--font-body)', fontSize: '0.875rem', color: '#9ca3af' }}>{filtered.length} participants</span>
      </div>

      {/* Search + filter */}
      <form method="GET" style={{ marginBottom: '1rem', display: 'flex', gap: '0.75rem' }}>
        <input type="text" name="q" defaultValue={search} placeholder="Search by name, nickname, or family email..." style={{ fontFamily: 'var(--font-body)', fontSize: '0.875rem', color: '#111', border: '1px solid #d1d5db', borderRadius: '6px', padding: '0.5rem 0.875rem', flex: 1, background: '#fff' }} />
        <select name="grade" defaultValue={filterGrade} style={{ fontFamily: 'var(--font-body)', fontSize: '0.8rem', color: '#374151', border: '1px solid #d1d5db', borderRadius: '6px', padding: '0.5rem 0.75rem', background: '#fff', cursor: 'pointer' }}>
          <option value="">All Grades</option>
          {(gradeLevels || []).map(gl => <option key={gl.yog} value={String(gl.yog)}>{gl.label}</option>)}
        </select>
        <button type="submit" style={{ fontFamily: 'var(--font-display)', fontSize: '0.7rem', fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase', background: '#111', color: '#fff', border: 'none', borderRadius: '6px', padding: '0.5rem 1rem', cursor: 'pointer' }}>Search</button>
        {(search || filterGrade) && <Link href="/backstage/participants" style={{ fontFamily: 'var(--font-display)', fontSize: '0.7rem', fontWeight: 600, letterSpacing: '0.08em', textTransform: 'uppercase', color: '#b40000', textDecoration: 'none', display: 'flex', alignItems: 'center' }}>✕ Clear</Link>}
      </form>

      <div style={{ background: '#fff', border: '1px solid #e5e7eb', borderRadius: '8px', overflow: 'hidden' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead>
            <tr>
              {['Name', 'Nickname', 'Grade', 'Gender', 'Family Email', 'Registrations', ''].map(col => (
                <th key={col} style={thStyle}>{col}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {filtered.length === 0 ? (
              <tr><td colSpan={7} style={{ padding: '3rem', textAlign: 'center', fontFamily: 'var(--font-body)', color: '#9ca3af', fontStyle: 'italic' }}>No participants found.</td></tr>
            ) : filtered.map((p, i) => (
              <tr key={p.id} style={{ background: i % 2 === 0 ? '#fff' : '#fafafa', borderBottom: '1px solid #f3f4f6' }}>
                <td style={{ padding: '0.75rem 1rem', fontFamily: 'var(--font-body)', fontSize: '0.875rem', fontWeight: 600, color: '#111' }}>
                  {p.first_name} {p.last_name}
                </td>
                <td style={{ padding: '0.75rem 1rem', fontFamily: 'var(--font-body)', fontSize: '0.875rem', color: '#6b7280' }}>
                  {p.nickname || '—'}
                </td>
                <td style={{ padding: '0.75rem 1rem', fontFamily: 'var(--font-body)', fontSize: '0.875rem', color: '#374151' }}>
                  {getGrade(p.yog)}
                </td>
                <td style={{ padding: '0.75rem 1rem', fontFamily: 'var(--font-body)', fontSize: '0.875rem', color: '#374151' }}>
                  {p.genders?.label || '—'}
                </td>
                <td style={{ padding: '0.75rem 1rem', fontFamily: 'var(--font-body)', fontSize: '0.875rem', color: '#374151' }}>
                  {p.families?.email || '—'}
                </td>
                <td style={{ padding: '0.75rem 1rem', fontFamily: 'var(--font-display)', fontSize: '0.875rem', fontWeight: 700, color: '#111', textAlign: 'center' }}>
                  {regCountMap[p.id] || 0}
                </td>
                <td style={{ padding: '0.75rem 1rem' }}>
                  <Link href={`/backstage/participants/${p.id}`} style={{ fontFamily: 'var(--font-display)', fontSize: '0.65rem', fontWeight: 600, letterSpacing: '0.08em', textTransform: 'uppercase', color: '#374151', textDecoration: 'none', border: '1px solid #e5e7eb', borderRadius: '4px', padding: '0.3rem 0.75rem' }}>View</Link>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}