import { createClient } from '@/lib/supabase/server';
import { redirect } from 'next/navigation';
import Image from 'next/image';
import Link from 'next/link';
import BackstageLogoutButton from '@/components/BackstageLogoutButton';

const NAV_TABS = [
  { label: 'Dashboard',    href: '/backstage' },
  { label: 'Reports',      href: '/backstage/reports' },
  { label: 'Programs',     href: '/backstage/programs' },
  { label: 'Families',     href: '/backstage/families' },
  { label: 'Participants', href: '/backstage/participants' },
  { label: 'Settings',     href: '/backstage/settings' },
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
        .bs-dropdown { position: relative; display: flex; align-items: stretch; }
        .bs-dropdown-trigger { border-bottom: 3px solid transparent; margin-bottom: -3px; transition: color 0.15s, border-color 0.15s; display: flex; align-items: center; }
        .bs-dropdown:hover .bs-dropdown-trigger { color: #ffffff !important; border-bottom-color: #e0bf5c !important; }
        .bs-dropdown-menu { display: none; position: absolute; top: 100%; left: 0; background: #1a1a1a; border: 1px solid #333; border-top: 2px solid #b40000; min-width: 180px; z-index: 200; box-shadow: 0 4px 12px rgba(0,0,0,0.3); }
        .bs-dropdown:hover .bs-dropdown-menu { display: block; }
        .bs-dropdown-item { display: block; padding: 0.625rem 1rem; font-family: var(--font-display); font-size: 0.7rem; font-weight: 600; letter-spacing: 0.08em; text-transform: uppercase; color: #d1d5db; text-decoration: none; white-space: nowrap; }
        .bs-dropdown-item:hover { color: #ffffff; background: #2a2a2a; }
        .bs-dropdown-divider { height: 1px; background: #333; margin: 0; }
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
          <BackstageLogoutButton />
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
        {/* Dashboard always first */}
        <NavTab href="/backstage" label="Dashboard" />

        {/* Registrations dropdown */}
        <div className="bs-dropdown">
          <Link
            href="/backstage/registrations"
            className="bs-dropdown-trigger"
            style={{
              fontFamily: 'var(--font-display)', fontSize: '0.75rem', fontWeight: 700,
              letterSpacing: '0.08em', textTransform: 'uppercase',
              color: '#d1d5db', textDecoration: 'none',
              padding: '0 1rem',
              whiteSpace: 'nowrap',
            }}
          >
            Registrations ▾
          </Link>
          <div className="bs-dropdown-menu">
            <a href="/backstage/registrations" className="bs-dropdown-item">All Registrations</a>
            <div className="bs-dropdown-divider" />
            <a href="/backstage/in-progress" className="bs-dropdown-item">In Progress</a>
          </div>
        </div>

        {/* Remaining tabs */}
        {NAV_TABS.filter(t => t.href !== '/backstage').map(tab => (
          <NavTab key={tab.href} label={tab.label} href={tab.href} />
        ))}
      </nav>

      {/* Page content */}
      <main style={{ padding: '1.5rem', maxWidth: '1400px', margin: '0 auto' }}>
        {children}
      </main>
    </div>
  );
}

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
