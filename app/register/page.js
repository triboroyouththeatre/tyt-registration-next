import { createClient } from '@/lib/supabase/server';
import { redirect } from 'next/navigation';
import Image from 'next/image';
import ProgramList from '@/components/ProgramList';

const REGISTRATION_STATUS_CANCELLED = '1878c625-8ce3-472c-b6d1-b84fdb04d90b';

export default async function RegisterPage() {
  const supabase = await createClient();

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  const { data: profile } = await supabase
    .from('profiles')
    .select('family_id')
    .eq('id', user.id)
    .single();

  // Defense in depth: the proxy should have already routed admins away and
  // sent incomplete-onboarding families to /onboarding, but if a profile
  // somehow lacks a family_id, send the user back to the dashboard rather
  // than crashing on the participants query below.
  if (!profile?.family_id) {
    redirect('/dashboard');
  }

  const { data: participants } = await supabase
    .from('participants')
    .select('id, first_name, last_name, yog')
    .eq('family_id', profile.family_id)
    .eq('is_active', true)
    .order('first_name');

  const { data: programs } = await supabase
    .from('programs')
    .select(`
      id, label, description, schedule, fee, deposit_amount,
      balance_due_date, enrollment_limit, yog_min, yog_max,
      is_registration_open, is_active,
      sessions(
        name,
        seasons(name, display_name)
      )
    `)
    .eq('is_active', true)
    .order('label');

  // Count current enrollments per program via carts, which holds the
  // program_id. registration_programs is not used by this app.
  const { data: enrolledCarts } = await supabase
    .from('registrations')
    .select('cart_id, carts!inner(program_id)')
    .neq('status_id', REGISTRATION_STATUS_CANCELLED);

  const enrollmentCounts = {};
  enrolledCarts?.forEach(r => {
    const programId = r.carts?.program_id;
    if (programId) {
      enrollmentCounts[programId] = (enrollmentCounts[programId] || 0) + 1;
    }
  });

  const { data: gradeLevels } = await supabase
    .from('grade_levels')
    .select('yog, label, seasons!inner(is_active)')
    .eq('seasons.is_active', true)
    .order('yog');

  return (
    <div style={{ minHeight: '100vh', background: 'var(--bg-dark)' }}>
      <nav style={{
        background: 'var(--bg-card)', borderBottom: '1px solid var(--border)',
        padding: '0 1.5rem', display: 'flex', alignItems: 'center',
        justifyContent: 'space-between', height: '64px',
        position: 'sticky', top: 0, zIndex: 100,
      }}>
        <a href="/dashboard" style={{ display: 'flex', alignItems: 'center', textDecoration: 'none' }}>
          <Image src="/images/tyt-logo.png" alt="Triboro Youth Theatre" width={48} height={48} style={{ objectFit: 'contain' }} />
        </a>
        <span style={{ fontFamily: 'var(--font-display)', fontSize: '1.1rem', fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase', color: 'var(--text-primary)' }}>
          Programs
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
          transition: 'background 0.2s',
        }}>
          ← Back
        </a>
      </nav>

      <main style={{ maxWidth: '780px', margin: '0 auto', padding: '2rem 1.5rem' }}>
        <div style={{ marginBottom: '2rem' }}>
          <h1 style={{ fontFamily: 'var(--font-display)', fontSize: '2rem', fontWeight: 800, letterSpacing: '0.05em', textTransform: 'uppercase', color: 'var(--text-primary)', marginBottom: '0.25rem' }}>
            Programs
          </h1>
          <p style={{ fontFamily: 'var(--font-accent)', fontStyle: 'italic', color: 'var(--text-muted)', fontSize: '1rem' }}>
            Select a program to view details and register your participant.
          </p>
        </div>

        <ProgramList
          programs={programs || []}
          participants={participants || []}
          enrollmentCounts={enrollmentCounts}
          gradeLevels={gradeLevels || []}
        />
      </main>
    </div>
  );
}