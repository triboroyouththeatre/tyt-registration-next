import { createClient } from '@/lib/supabase/server';
import { redirect } from 'next/navigation';
import Link from 'next/link';

export default async function FamiliesPage({ searchParams }) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/login');
  const { data: profile } = await supabase.from('profiles').select('role').eq('id', user.id).single();
  if (profile?.role !== 'admin') redirect('/dashboard');

  const sp = await searchParams;
  const search = sp?.q || '';

  // Only show family-role accounts — exclude admin accounts
  const { data: familyProfiles } = await supabase
    .from('profiles')
    .select('family_id')
    .eq('role', 'family');

  const familyIds = (familyProfiles || []).map(p => p.family_id).filter(Boolean);

  const { data: families } = await supabase
    .from('families')
    .select(`
      id, email, street, city, state, zip, stripe_customer_id, created_at,
      participants(id, first_name, last_name, nickname, is_active),
      contacts(id, first_name, last_name, priority)
    `)
    .in('id', familyIds.length > 0 ? familyIds : ['00000000-0000-0000-0000-000000000000'])
    .order('email');

  // Get registration counts per family
  const { data: regCounts } = await supabase
    .from('registrations')
    .select('family_id');

  const regCountMap = {};
  (regCounts || []).forEach(r => {
    regCountMap[r.family_id] = (regCountMap[r.family_id] || 0) + 1;
  });

  // Filter by search
  let filtered = (families || []).filter(f => {
    if (!search) return true;
    const q = search.toLowerCase();
    const primaryContact = f.contacts?.find(c => c.priority === 1);
    return (
      f.email?.toLowerCase().includes(q) ||
      primaryContact?.first_name?.toLowerCase().includes(q) ||
      primaryContact?.last_name?.toLowerCase().includes(q) ||
      f.city?.toLowerCase().includes(q)
    );
  });

  const thStyle = { padding: '0.625rem 1rem', fontFamily: 'var(--font-display)', fontSize: '0.65rem', fontWeight: 600, letterSpacing: '0.1em', textTransform: 'uppercase', color: '#6b7280', background: '#f9fafb', borderBottom: '1px solid #e5e7eb', textAlign: 'left', whiteSpace: 'nowrap' };

  return (
    <div>
      <div style={{ marginBottom: '1.25rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <h1 style={{ fontFamily: 'var(--font-display)', fontSize: '1.5rem', fontWeight: 800, letterSpacing: '0.05em', textTransform: 'uppercase', color: '#111', margin: 0 }}>
          Families
        </h1>
        <span style={{ fontFamily: 'var(--font-body)', fontSize: '0.875rem', color: '#9ca3af' }}>{filtered.length} families</span>
      </div>

      {/* Search */}
      <form method="GET" style={{ marginBottom: '1rem' }}>
        <input
          type="text"
          name="q"
          defaultValue={search}
          placeholder="Search by email, guardian name, or city..."
          style={{ fontFamily: 'var(--font-body)', fontSize: '0.875rem', color: '#111', border: '1px solid #d1d5db', borderRadius: '6px', padding: '0.5rem 0.875rem', width: '100%', boxSizing: 'border-box', background: '#fff' }}
        />
      </form>

      <div style={{ background: '#fff', border: '1px solid #e5e7eb', borderRadius: '8px', overflow: 'hidden' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead>
            <tr>
              {['Email', 'Primary Guardian', 'City', 'Participants', 'Registrations', 'Stripe', ''].map(col => (
                <th key={col} style={thStyle}>{col}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {filtered.length === 0 ? (
              <tr><td colSpan={7} style={{ padding: '3rem', textAlign: 'center', fontFamily: 'var(--font-body)', color: '#9ca3af', fontStyle: 'italic' }}>No families found.</td></tr>
            ) : filtered.map((family, i) => {
              const primary = family.contacts?.find(c => c.priority === 1);
              const activeParticipants = family.participants?.filter(p => p.is_active).length || 0;
              const regCount = regCountMap[family.id] || 0;

              return (
                <tr key={family.id} style={{ background: i % 2 === 0 ? '#fff' : '#fafafa', borderBottom: '1px solid #f3f4f6' }}>
                  <td style={{ padding: '0.75rem 1rem', fontFamily: 'var(--font-body)', fontSize: '0.875rem', color: '#111', fontWeight: 500 }}>
                    {family.email}
                  </td>
                  <td style={{ padding: '0.75rem 1rem', fontFamily: 'var(--font-body)', fontSize: '0.875rem', color: '#374151' }}>
                    {primary ? `${primary.first_name} ${primary.last_name}` : '—'}
                  </td>
                  <td style={{ padding: '0.75rem 1rem', fontFamily: 'var(--font-body)', fontSize: '0.875rem', color: '#374151' }}>
                    {family.city || '—'}{family.state ? `, ${family.state}` : ''}
                  </td>
                  <td style={{ padding: '0.75rem 1rem', fontFamily: 'var(--font-display)', fontSize: '0.875rem', fontWeight: 700, color: '#111', textAlign: 'center' }}>
                    {activeParticipants}
                  </td>
                  <td style={{ padding: '0.75rem 1rem', fontFamily: 'var(--font-display)', fontSize: '0.875rem', fontWeight: 700, color: '#111', textAlign: 'center' }}>
                    {regCount}
                  </td>
                  <td style={{ padding: '0.75rem 1rem' }}>
                    {family.stripe_customer_id ? (
                      <span style={{ fontFamily: 'var(--font-display)', fontSize: '0.6rem', fontWeight: 600, letterSpacing: '0.06em', textTransform: 'uppercase', color: '#16a34a', background: '#f0fdf4', border: '1px solid #bbf7d0', borderRadius: '3px', padding: '0.2rem 0.5rem' }}>✓ Linked</span>
                    ) : (
                      <span style={{ fontFamily: 'var(--font-display)', fontSize: '0.6rem', fontWeight: 600, letterSpacing: '0.06em', textTransform: 'uppercase', color: '#9ca3af', background: '#f9fafb', border: '1px solid #e5e7eb', borderRadius: '3px', padding: '0.2rem 0.5rem' }}>None</span>
                    )}
                  </td>
                  <td style={{ padding: '0.75rem 1rem' }}>
                    <Link href={`/backstage/families/${family.id}`} style={{ fontFamily: 'var(--font-display)', fontSize: '0.65rem', fontWeight: 600, letterSpacing: '0.08em', textTransform: 'uppercase', color: '#374151', textDecoration: 'none', border: '1px solid #e5e7eb', borderRadius: '4px', padding: '0.3rem 0.75rem' }}>
                      View
                    </Link>
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