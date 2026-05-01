import { createClient } from '@/lib/supabase/server';
import { redirect } from 'next/navigation';
import Image from 'next/image';
import LogoutButton from '@/components/LogoutButton';

export default async function DashboardPage() {
  const supabase = await createClient();

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  const { data: profile } = await supabase
    .from('profiles')
    .select('*, families(*)')
    .eq('id', user.id)
    .single();

  const family = profile?.families;

  // Get primary contact for first name
  const { data: primaryContact } = await supabase
    .from('contacts')
    .select('first_name')
    .eq('family_id', family?.id)
    .eq('priority', 1)
    .single();

  const firstName = primaryContact?.first_name || null;

  const { data: participants } = await supabase
    .from('participants')
    .select('*')
    .eq('family_id', family?.id)
    .eq('is_active', true)
    .order('first_name');

  const { data: registrations } = await supabase
    .from('registrations')
    .select(`
      *,
      participants(first_name, last_name),
      registration_statuses(label),
      registration_programs(
        programs(
          label,
          sessions(
            name,
            seasons(name, display_name)
          )
        )
      )
    `)
    .eq('family_id', family?.id)
    .order('registered_at', { ascending: false });

  // Fetch waitlist entries for this family (only active states)
  const { data: waitlistEntries } = await supabase
    .from('waitlist')
    .select(`
      id, status, offer_token, notified_at, created_at,
      participants(first_name, last_name, nickname),
      programs(
        id, label,
        sessions(name, seasons(name, display_name))
      )
    `)
    .eq('family_id', family?.id)
    .in('status', ['waiting', 'offered'])
    .order('created_at', { ascending: false });

  // Get active sessions with display name
  const { data: activeSessions } = await supabase
    .from('sessions')
    .select('id, name, seasons(name, display_name)')
    .eq('is_active', true)
    .limit(1);

  // Check if any programs have registration open
  const { data: openPrograms } = await supabase
    .from('programs')
    .select('id, sessions!inner(is_active)')
    .eq('is_registration_open', true)
    .eq('sessions.is_active', true)
    .limit(1);

  const registrationOpen = openPrograms && openPrograms.length > 0;
  const currentSession = activeSessions?.[0];
  const currentSeasonDisplay = currentSession?.seasons?.display_name || currentSession?.seasons?.name;

  const currentRegistrations = registrations?.filter(r =>
    r.registration_programs?.some(rp =>
      rp.programs?.sessions?.seasons?.name === currentSession?.seasons?.name
    )
  ) || [];

  const pastRegistrations = registrations?.filter(r =>
    !currentRegistrations.includes(r)
  ) || [];

  const totalOwed = currentRegistrations.reduce((sum, r) =>
    sum + ((r.total_fee || 0) - (r.amount_paid || 0)), 0
  );

  const offeredEntries = (waitlistEntries || []).filter(w => w.status === 'offered');
  const waitingEntries = (waitlistEntries || []).filter(w => w.status === 'waiting');

  const formatCurrency = (amount) =>
    new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(amount);

  function participantDisplayName(p) {
    if (!p) return '';
    return p.nickname ? `${p.nickname} ${p.last_name}` : `${p.first_name} ${p.last_name}`;
  }

  return (
    <>
      <style>{`
        .dash-link {
          display: flex;
          align-items: center;
          justify-content: space-between;
          background: var(--bg-card);
          border: 1px solid var(--border);
          border-radius: var(--radius-md);
          padding: 1rem 1.25rem;
          text-decoration: none;
          gap: 1rem;
          transition: border-color 0.2s, background 0.2s;
        }
        .dash-link:hover {
          border-color: var(--gold);
          background: var(--bg-hover);
        }
        .dash-link-muted { opacity: 0.7; }
        .dash-link-muted:hover { opacity: 1; }
        .account-link {
          display: flex;
          align-items: center;
          justify-content: space-between;
          padding: 1rem 1.25rem;
          text-decoration: none;
          transition: background 0.15s;
        }
        .account-link:hover { background: var(--bg-hover); }
        .waitlist-entry {
          display: flex;
          align-items: center;
          justify-content: space-between;
          background: var(--bg-card);
          border: 1px solid var(--border);
          border-radius: var(--radius-md);
          padding: 1rem 1.25rem;
          gap: 1rem;
        }
      `}</style>

      <div style={{ minHeight: '100vh', background: 'var(--bg-dark)' }}>

        {/* Nav */}
        <nav style={{
          background: 'var(--bg-card)', borderBottom: '1px solid var(--border)',
          padding: '0 1.5rem', display: 'flex', alignItems: 'center',
          justifyContent: 'space-between', height: '64px',
          position: 'sticky', top: 0, zIndex: 100,
        }}>
          <Image src="/images/tyt-logo.png" alt="Triboro Youth Theatre" width={48} height={48} style={{ objectFit: 'contain' }} />
          <span style={{ fontFamily: 'var(--font-display)', fontSize: '1.1rem', fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase', color: 'var(--text-primary)' }}>
            Family Portal
          </span>
          <LogoutButton />
        </nav>

        <main style={{ maxWidth: '800px', margin: '0 auto', padding: '2rem 1.5rem' }}>

          {/* Welcome */}
          <div style={{ marginBottom: '2rem' }}>
            <h1 style={{
              fontFamily: 'var(--font-display)', fontSize: '2rem', fontWeight: 800,
              letterSpacing: '0.05em', textTransform: 'uppercase',
              color: 'var(--text-primary)', marginBottom: '0',
            }}>
              Welcome Back{firstName ? `, ${firstName.toUpperCase()}` : ''}
            </h1>
          </div>

          {/* Waitlist offer banner(s) — top priority action item */}
          {offeredEntries.length > 0 && offeredEntries.map(entry => {
            const pName = participantDisplayName(entry.participants);
            const progLabel = entry.programs?.label || 'Program';
            const link = `/register/${entry.programs?.id}?waitlist_token=${entry.offer_token}`;
            return (
              <div key={entry.id} style={{
                background: '#0d1a0a', border: '1px solid var(--gold)',
                borderRadius: 'var(--radius-md)', padding: '1.25rem 1.5rem',
                marginBottom: '1.25rem', display: 'flex', alignItems: 'center',
                justifyContent: 'space-between', gap: '1rem', flexWrap: 'wrap',
              }}>
                <div>
                  <p style={{ fontFamily: 'var(--font-display)', fontSize: '0.75rem', fontWeight: 600, letterSpacing: '0.12em', textTransform: 'uppercase', color: 'var(--gold)', marginBottom: '0.25rem' }}>
                    Spot Available
                  </p>
                  <p style={{ fontFamily: 'var(--font-display)', fontSize: '1.1rem', fontWeight: 700, color: 'var(--text-primary)', marginBottom: '0.15rem' }}>
                    {pName} &middot; {progLabel}
                  </p>
                  <p style={{ fontFamily: 'var(--font-accent)', fontStyle: 'italic', color: 'var(--text-muted)', fontSize: '0.85rem' }}>
                    A spot has opened up. Complete registration to claim it.
                  </p>
                </div>
                <a href={link} className="tyt-btn tyt-btn-gold">Complete Registration</a>
              </div>
            );
          })}

          {/* Balance banner */}
          {totalOwed > 0 && (
            <div style={{
              background: '#1a0a0a', border: '1px solid var(--red)',
              borderRadius: 'var(--radius-md)', padding: '1.25rem 1.5rem',
              marginBottom: '2rem', display: 'flex', alignItems: 'center',
              justifyContent: 'space-between', gap: '1rem', flexWrap: 'wrap',
            }}>
              <div>
                <p style={{ fontFamily: 'var(--font-display)', fontSize: '0.75rem', fontWeight: 600, letterSpacing: '0.12em', textTransform: 'uppercase', color: 'var(--text-muted)', marginBottom: '0.25rem' }}>Balance Due</p>
                <p style={{ fontFamily: 'var(--font-display)', fontSize: '2rem', fontWeight: 800, color: 'var(--red)', lineHeight: 1 }}>{formatCurrency(totalOwed)}</p>
              </div>
              <a href="/dashboard/pay" className="tyt-btn tyt-btn-primary">Pay Now</a>
            </div>
          )}

          {/* Registration open banner */}
          {registrationOpen && (
            <div style={{
              background: '#0d1a0a', border: '1px solid var(--gold)',
              borderRadius: 'var(--radius-md)', padding: '1.25rem 1.5rem',
              marginBottom: '2rem', display: 'flex', alignItems: 'center',
              justifyContent: 'space-between', gap: '1rem', flexWrap: 'wrap',
            }}>
              <div>
                <p style={{ fontFamily: 'var(--font-display)', fontSize: '0.85rem', fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase', color: 'var(--gold)', marginBottom: '0.15rem' }}>
                  {currentSeasonDisplay} Programs
                </p>
                <p style={{ fontFamily: 'var(--font-accent)', fontStyle: 'italic', color: 'var(--text-muted)', fontSize: '0.875rem' }}>
                  Registration is now open
                </p>
              </div>
              <a href="/register" className="tyt-btn tyt-btn-gold">Register Now</a>
            </div>
          )}

          {/* Participants */}
          <section style={{ marginBottom: '2.5rem' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1rem' }}>
              <h2 style={{ fontFamily: 'var(--font-display)', fontSize: '1.3rem', fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase', color: 'var(--text-primary)' }}>
                Participants
              </h2>
              <a href="/dashboard/participants/new" style={{ fontFamily: 'var(--font-display)', fontSize: '0.75rem', fontWeight: 600, letterSpacing: '0.1em', textTransform: 'uppercase', color: 'var(--gold)', textDecoration: 'none' }}>
                + Add Participant
              </a>
            </div>

            {participants && participants.length > 0 ? (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                {participants.map(p => (
                  <a key={p.id} href={`/dashboard/participants/${p.id}`} className="dash-link">
                    <div>
                      <p style={{ fontFamily: 'var(--font-display)', fontSize: '1.1rem', fontWeight: 700, letterSpacing: '0.04em', color: 'var(--text-primary)', marginBottom: '0.15rem' }}>
                        {p.nickname ? p.nickname : p.first_name} {p.last_name}
                      </p>
                      <p style={{ fontFamily: 'var(--font-body)', fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                        Class of {p.yog}
                      </p>
                    </div>
                    <span style={{ color: 'var(--gold)', fontSize: '1.2rem' }}>›</span>
                  </a>
                ))}
              </div>
            ) : (
              <div style={{ background: 'var(--bg-card)', border: '1px dashed var(--border)', borderRadius: 'var(--radius-md)', padding: '2rem', textAlign: 'center' }}>
                <p style={{ fontFamily: 'var(--font-accent)', fontStyle: 'italic', color: 'var(--text-muted)', marginBottom: '1rem' }}>No participants added yet.</p>
                <a href="/dashboard/participants/new" className="tyt-btn tyt-btn-secondary">Add Your First Participant</a>
              </div>
            )}
          </section>

          {/* Waitlist (waiting entries only — offered ones live in the top banner) */}
          {waitingEntries.length > 0 && (
            <section style={{ marginBottom: '2.5rem' }}>
              <h2 style={{ fontFamily: 'var(--font-display)', fontSize: '1.3rem', fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase', color: 'var(--text-primary)', marginBottom: '1rem' }}>
                Waitlist
              </h2>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                {waitingEntries.map(entry => {
                  const pName = participantDisplayName(entry.participants);
                  const progLabel = entry.programs?.label || 'Program';
                  const seasonDisplay = entry.programs?.sessions?.seasons?.display_name || entry.programs?.sessions?.seasons?.name;
                  return (
                    <div key={entry.id} className="waitlist-entry">
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <p style={{ fontFamily: 'var(--font-display)', fontSize: '1rem', fontWeight: 700, letterSpacing: '0.04em', color: 'var(--text-primary)', marginBottom: '0.15rem' }}>
                          {pName}
                        </p>
                        <p style={{ fontFamily: 'var(--font-body)', fontSize: '0.82rem', color: 'var(--text-muted)' }}>
                          {progLabel}{seasonDisplay ? ` · ${seasonDisplay} Season` : ''}
                        </p>
                      </div>
                      <span style={{
                        fontFamily: 'var(--font-display)',
                        fontSize: '0.7rem',
                        fontWeight: 700,
                        letterSpacing: '0.1em',
                        textTransform: 'uppercase',
                        color: 'var(--text-muted)',
                        border: '1px solid var(--border)',
                        borderRadius: '3px',
                        padding: '0.25rem 0.65rem',
                        flexShrink: 0,
                      }}>
                        Waiting
                      </span>
                    </div>
                  );
                })}
              </div>
            </section>
          )}

          {/* Current Season */}
          <section style={{ marginBottom: '2.5rem' }}>
            <h2 style={{ fontFamily: 'var(--font-display)', fontSize: '1.3rem', fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase', color: 'var(--text-primary)', marginBottom: '1rem' }}>
              {currentSeasonDisplay ? `${currentSeasonDisplay} Season` : 'Current Season'}
            </h2>

            {currentRegistrations.length > 0 ? (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                {currentRegistrations.map(r => {
                  const balance = (r.total_fee || 0) - (r.amount_paid || 0);
                  const programs = r.registration_programs?.map(rp => rp.programs?.label).filter(Boolean);
                  return (
                    <a key={r.id} href={`/dashboard/registrations/${r.id}`} className="dash-link">
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <p style={{ fontFamily: 'var(--font-display)', fontSize: '1rem', fontWeight: 700, letterSpacing: '0.04em', color: 'var(--text-primary)', marginBottom: '0.15rem' }}>
                          {r.participants?.first_name} {r.participants?.last_name}
                        </p>
                        <p style={{ fontFamily: 'var(--font-body)', fontSize: '0.82rem', color: 'var(--text-muted)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                          {programs?.join(', ') || 'No programs'}
                        </p>
                      </div>
                      <div style={{ textAlign: 'right', flexShrink: 0 }}>
                        {balance > 0 ? (
                          <p style={{ fontFamily: 'var(--font-display)', fontSize: '1rem', fontWeight: 700, color: 'var(--red)' }}>{formatCurrency(balance)} due</p>
                        ) : (
                          <p style={{ fontFamily: 'var(--font-display)', fontSize: '0.85rem', fontWeight: 600, color: 'var(--gold)' }}>Paid in full</p>
                        )}
                        <p style={{ fontFamily: 'var(--font-body)', fontSize: '0.75rem', color: 'var(--text-faint)' }}>#{r.registration_number}</p>
                      </div>
                    </a>
                  );
                })}
              </div>
            ) : (
              <div style={{ background: 'var(--bg-card)', border: '1px dashed var(--border)', borderRadius: 'var(--radius-md)', padding: '2rem', textAlign: 'center' }}>
                <p style={{ fontFamily: 'var(--font-accent)', fontStyle: 'italic', color: 'var(--text-muted)' }}>No registrations for the current season.</p>
              </div>
            )}
          </section>

          {/* Registration History */}
          {pastRegistrations.length > 0 && (
            <section style={{ marginBottom: '2.5rem' }}>
              <h2 style={{ fontFamily: 'var(--font-display)', fontSize: '1.3rem', fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase', color: 'var(--text-muted)', marginBottom: '1rem' }}>
                Registration History
              </h2>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                {pastRegistrations.map(r => {
                  const programs = r.registration_programs?.map(rp => rp.programs?.label).filter(Boolean);
                  const seasonDisplay = r.registration_programs?.[0]?.programs?.sessions?.seasons?.display_name ||
                                       r.registration_programs?.[0]?.programs?.sessions?.seasons?.name;
                  return (
                    <a key={r.id} href={`/dashboard/registrations/${r.id}`} className="dash-link dash-link-muted">
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <p style={{ fontFamily: 'var(--font-display)', fontSize: '0.95rem', fontWeight: 700, color: 'var(--text-primary)', marginBottom: '0.15rem' }}>
                          {r.participants?.first_name} {r.participants?.last_name}
                        </p>
                        <p style={{ fontFamily: 'var(--font-body)', fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                          {programs?.join(', ') || 'No programs'}
                        </p>
                      </div>
                      <div style={{ textAlign: 'right', flexShrink: 0 }}>
                        {seasonDisplay && (
                          <p style={{ fontFamily: 'var(--font-display)', fontSize: '0.8rem', color: 'var(--text-faint)', letterSpacing: '0.05em' }}>
                            {seasonDisplay} Season
                          </p>
                        )}
                        <p style={{ fontFamily: 'var(--font-body)', fontSize: '0.75rem', color: 'var(--text-faint)' }}>#{r.registration_number}</p>
                      </div>
                    </a>
                  );
                })}
              </div>
            </section>
          )}

          {/* Account */}
          <section>
            <h2 style={{ fontFamily: 'var(--font-display)', fontSize: '1.3rem', fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase', color: 'var(--text-primary)', marginBottom: '1rem' }}>
              Account
            </h2>
            <div style={{ background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 'var(--radius-md)', overflow: 'hidden' }}>
              {[
                { label: 'Account Information', href: '/dashboard/account' },
                { label: 'Contacts & Emergency Contacts', href: '/dashboard/contacts' },
                { label: 'Payment History', href: '/dashboard/payments' },
                { label: 'Change Password', href: '/dashboard/change-password' },
              ].map((item, i, arr) => (
                <a key={item.href} href={item.href} className="account-link" style={{ borderBottom: i < arr.length - 1 ? '1px solid var(--border)' : 'none' }}>
                  <span style={{ fontFamily: 'var(--font-body)', fontSize: '0.95rem', color: 'var(--text-primary)' }}>{item.label}</span>
                  <span style={{ color: 'var(--gold)', fontSize: '1.2rem' }}>›</span>
                </a>
              ))}
            </div>
          </section>

        </main>
      </div>
    </>
  );
}