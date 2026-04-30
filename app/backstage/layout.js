import { createClient } from '@/lib/supabase/server';
import { redirect } from 'next/navigation';
import Image from 'next/image';
import Link from 'next/link';

const NAV_TABS = [
  { label: 'Dashboard',     href: '/backstage' },
  { label: 'Registrations', href: '/backstage/registrations' },
  { label: 'Reports',       href: '/backstage/reports' },
  { label: 'Programs',      href: '/backstage/programs' },
  { label: 'Families',      href: '/backstage/families' },
  { label: 'Participants',  href: '/backstage/participants' },
  { label: 'Settings',      href: '/backstage/settings' },
];

export default async function BackstageLayout({ children }) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  const { data: profile } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .single();

  if (!profile || profile.role !== 'admin') redirect('/dashboard');

  return (
    <div style={{ minHeight: '100vh', background: '#f3f4f6', fontFamily: 'var(--font-body)' }}>
      <style>{`
        .bs-nav-tab:hover { color: #ffffff !important; border-bottom-color: #e0bf5c !important; }
        .bs-nav-tab { border-bottom: 3px solid transparent; margin-bottom: -3px; transition: color 0.15s, border-color 0.15s; }
      `}</style>

      {/* Top header */}
      <header style={{
        background: '#ffffff',
        borderBottom: '1px solid #e5e7eb',
        padding: '0 1.5rem',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        height: '56px',
        position: 'sticky',
        top: 0,
        zIndex: 100,
        boxShadow: '0 1px 3px rgba(0,0,0,0.08)',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.875rem' }}>
          <Image src="/images/tyt-logo.png" alt="TYT" width={36} height={36} style={{ objectFit: 'contain' }} />
          <div>
            <p style={{ fontFamily: 'var(--font-display)', fontSize: '0.85rem', fontWeight: 800, letterSpacing: '0.08em', textTransform: 'uppercase', color: '#111', lineHeight: 1, margin: 0 }}>
              Triboro Youth Theatre
            </p>
            <p style={{ fontFamily: 'var(--font-display)', fontSize: '0.6rem', fontWeight: 600, letterSpacing: '0.12em', textTransform: 'uppercase', color: '#b40000', margin: 0, lineHeight: 1, marginTop: '2px' }}>
              Backstage Admin
            </p>
          </div>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
          <span style={{ fontFamily: 'var(--font-body)', fontSize: '0.8rem', color: '#6b7280' }}>
            {user.email}
          </span>
          <a
            href="/api/auth/logout"
            style={{
              fontFamily: 'var(--font-display)', fontSize: '0.65rem', fontWeight: 600,
              letterSpacing: '0.1em', textTransform: 'uppercase',
              color: '#6b7280', textDecoration: 'none',
              border: '1px solid #e5e7eb', borderRadius: '4px',
              padding: '0.3rem 0.75rem',
            }}
          >
            Sign Out
          </a>
        </div>
      </header>

      {/* Tab navigation */}
      <nav style={{
        background: '#111111',
        borderBottom: '3px solid #b40000',
        padding: '0 1.5rem',
        display: 'flex',
        alignItems: 'stretch',
        height: '44px',
        position: 'sticky',
        top: '56px',
        zIndex: 99,
      }}>
        {NAV_TABS.map(tab => (
          <NavTab key={tab.href} label={tab.label} href={tab.href} />
        ))}
        <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center' }}>
          <a
            href="/dashboard"
            style={{
              fontFamily: 'var(--font-display)', fontSize: '0.65rem', fontWeight: 600,
              letterSpacing: '0.1em', textTransform: 'uppercase',
              color: '#9ca3af', textDecoration: 'none',
              padding: '0 0.75rem',
            }}
          >
            ← Family Portal
          </a>
        </div>
      </nav>

      {/* Page content */}
      <main style={{ padding: '1.5rem', maxWidth: '1400px', margin: '0 auto' }}>
        {children}
      </main>
    </div>
  );
}

// Client component for active tab detection would be ideal but
// for SSR simplicity we'll use a server-safe approach
function NavTab({ label, href }) {
  return (
    <Link
      href={href}
      className="bs-nav-tab"
      style={{
        fontFamily: 'var(--font-display)', fontSize: '0.75rem', fontWeight: 700,
        letterSpacing: '0.08em', textTransform: 'uppercase',
        color: '#d1d5db', textDecoration: 'none',
        padding: '0 1rem',
        display: 'flex', alignItems: 'center',
        whiteSpace: 'nowrap',
      }}
    >
      {label}
    </Link>
  );
}