import { createClient } from '@/lib/supabase/server';
import { redirect } from 'next/navigation';
import Image from 'next/image';
import LogoutButton from '@/components/LogoutButton';

export default async function DashboardPage() {
  const supabase = await createClient();

  // Get current user
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  // Get profile and family
  const { data: profile } = await supabase
    .from('profiles')
    .select('*, families(*)')
    .eq('id', user.id)
    .single();

  const family = profile?.families;

  // Get participants for this family
  const { data: participants } = await supabase
    .from('participants')
    .select('*')
    .eq('family_id', family?.id)
    .order('first_name');

  // Get registrations with program info
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
            seasons(name)
          )
        )
      )
    `)
    .eq('family_id', family?.id)
    .order('registered_at', { ascending: false });

  // Get active session to determine if registration is open
  const { data: activeSessions } = await supabase
    .from('sessions')
    .select('id, name, seasons(name)')
    .eq('is_active', true)
    .limit(1);

  const registrationOpen = activeSessions && activeSessions.length > 0;

  // Split registrations into current and past
  const currentSeason = activeSessions?.[0]?.seasons?.name;
  const currentRegistrations = registrations?.filter(r =>
    r.registration_programs?.some(rp =>
      rp.programs?.sessions?.seasons?.name === currentSeason
    )
  ) || [];
  const pastRegistrations = registrations?.filter(r =>
    !currentRegistrations.includes(r)
  ) || [];

  // Calculate total balance owed
  const totalOwed = currentRegistrations.reduce((sum, r) => {
    return sum + ((r.total_fee || 0) - (r.amount_paid || 0));
  }, 0);

  const formatCurrency = (amount) =>
    new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(amount);

  return (
    <div style={{ minHeight: '100vh', background: 'var(--bg-dark)' }}>

      {/* Nav */}
      <nav style={{
        background: 'var(--bg-card)',
        borderBottom: '1px solid var(--border)',
        padding: '0 1.5rem',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        height: '64px',
        position: 'sticky',
        top: 0,
        zIndex: 100,
      }}>
        <Image
          src="/images/tyt-logo.png"
          alt="Triboro Youth Theatre"
          width={48}
          height={48}
          style={{ objectFit: 'contain' }}
        />
        <span style={{
          fontFamily: 'var(--font-display)',
          fontSize: '1.1rem',
          fontWeight: 700,
          letterSpacing: '0.08em',
          textTransform: 'uppercase',
          color: 'var(--text-primary)',
        }}>
          Family Portal
        </span>
        <LogoutButton />
      </nav>

      {/* Main content */}
      <main style={{
        maxWidth: '800px',
        margin: '0 auto',
        padding: '2rem 1.5rem',
      }}>

        {/* Welcome header */}
        <div style={{ marginBottom: '2rem' }}>
          <h1 style={{
            fontFamily: 'var(--font-display)',
            fontSize: '2rem',
            fontWeight: 800,
            letterSpacing: '0.05em',
            textTransform: 'uppercase',
            color: 'var(--text-primary)',
            marginBottom: '0.25rem',
          }}>
            Welcome Back
          </h1>
          <p style={{
            fontFamily: 'var(--font-accent)',
            fontStyle: 'italic',
            color: 'var(--text-muted)',
            fontSize: '1rem',
          }}>
            {user.email}
            {currentSeason && (
              <span style={{ color: 'var(--gold)', marginLeft: '0.75rem' }}>
                · Season {currentSeason}
              </span>
            )}
          </p>
        </div>

        {/* Balance banner — only show if money is owed */}
        {totalOwed > 0 && (
          <div style={{
            background: '#1a0a0a',
            border: '1px solid var(--red)',
            borderRadius: 'var(--radius-md)',
            padding: '1.25rem 1.5rem',
            marginBottom: '2rem',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: '1rem',
            flexWrap: 'wrap',
          }}>
            <div>
              <p style={{
                fontFamily: 'var(--font-display)',
                fontSize: '0.75rem',
                fontWeight: 600,
                letterSpacing: '0.12em',
                textTransform: 'uppercase',
                color: 'var(--text-muted)',
                marginBottom: '0.25rem',
              }}>
                Balance Due
              </p>
              <p style={{
                fontFamily: 'var(--font-display)',
                fontSize: '2rem',
                fontWeight: 800,
                color: 'var(--red)',
                lineHeight: 1,
              }}>
                {formatCurrency(totalOwed)}
              </p>
            </div>
            <a href="/dashboard/pay" className="tyt-btn tyt-btn-primary">
              Pay Now
            </a>
          </div>
        )}

        {/* Register Now banner — only when registration is open */}
        {registrationOpen && (
          <div style={{
            background: '#0a1a0a',
            border: '1px solid var(--gold)',
            borderRadius: 'var(--radius-md)',
            padding: '1.25rem 1.5rem',
            marginBottom: '2rem',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: '1rem',
            flexWrap: 'wrap',
          }}>
            <div>
              <p style={{
                fontFamily: 'var(--font-display)',
                fontSize: '0.75rem',
                fontWeight: 600,
                letterSpacing: '0.12em',
                textTransform: 'uppercase',
                color: 'var(--gold)',
                marginBottom: '0.25rem',
              }}>
                Registration is Open
              </p>
              <p style={{
                fontFamily: 'var(--font-accent)',
                fontStyle: 'italic',
                color: 'var(--text-muted)',
                fontSize: '0.9rem',
              }}>
                {activeSessions[0].name} · Season {activeSessions[0].seasons?.name}
              </p>
            </div>
            <a href="/register" className="tyt-btn tyt-btn-gold">
              Register Now
            </a>
          </div>
        )}

        {/* Participants */}
        <section style={{ marginBottom: '2.5rem' }}>
          <div style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            marginBottom: '1rem',
          }}>
            <h2 style={{
              fontFamily: 'var(--font-display)',
              fontSize: '1.3rem',
              fontWeight: 700,
              letterSpacing: '0.08em',
              textTransform: 'uppercase',
              color: 'var(--text-primary)',
            }}>
              Participants
            </h2>
            <a href="/dashboard/participants/new" style={{
              fontFamily: 'var(--font-display)',
              fontSize: '0.75rem',
              fontWeight: 600,
              letterSpacing: '0.1em',
              textTransform: 'uppercase',
              color: 'var(--gold)',
            }}>
              + Add Participant
            </a>
          </div>

          {participants && participants.length > 0 ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
              {participants.map(p => (
                <a
                  key={p.id}
                  href={`/dashboard/participants/${p.id}`}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    background: 'var(--bg-card)',
                    border: '1px solid var(--border)',
                    borderRadius: 'var(--radius-md)',
                    padding: '1rem 1.25rem',
                    textDecoration: 'none',
                    transition: 'border-color 0.2s',
                  }}
                  onMouseEnter={e => e.currentTarget.style.borderColor = 'var(--gold)'}
                  onMouseLeave={e => e.currentTarget.style.borderColor = 'var(--border)'}
                >
                  <div>
                    <p style={{
                      fontFamily: 'var(--font-display)',
                      fontSize: '1.1rem',
                      fontWeight: 700,
                      letterSpacing: '0.04em',
                      color: 'var(--text-primary)',
                      marginBottom: '0.15rem',
                    }}>
                      {p.first_name} {p.last_name}
                      {p.nickname && (
                        <span style={{
                          fontFamily: 'var(--font-accent)',
                          fontStyle: 'italic',
                          fontWeight: 400,
                          fontSize: '0.9rem',
                          color: 'var(--text-muted)',
                          marginLeft: '0.5rem',
                        }}>
                          &ldquo;{p.nickname}&rdquo;
                        </span>
                      )}
                    </p>
                    <p style={{
                      fontFamily: 'var(--font-body)',
                      fontSize: '0.8rem',
                      color: 'var(--text-muted)',
                    }}>
                      Class of {p.yog}
                    </p>
                  </div>
                  <span style={{ color: 'var(--gold)', fontSize: '1.2rem' }}>›</span>
                </a>
              ))}
            </div>
          ) : (
            <div style={{
              background: 'var(--bg-card)',
              border: '1px dashed var(--border)',
              borderRadius: 'var(--radius-md)',
              padding: '2rem',
              textAlign: 'center',
            }}>
              <p style={{
                fontFamily: 'var(--font-accent)',
                fontStyle: 'italic',
                color: 'var(--text-muted)',
                marginBottom: '1rem',
              }}>
                No participants added yet.
              </p>
              <a href="/dashboard/participants/new" className="tyt-btn tyt-btn-secondary">
                Add Your First Participant
              </a>
            </div>
          )}
        </section>

        {/* Current Registrations */}
        <section style={{ marginBottom: '2.5rem' }}>
          <h2 style={{
            fontFamily: 'var(--font-display)',
            fontSize: '1.3rem',
            fontWeight: 700,
            letterSpacing: '0.08em',
            textTransform: 'uppercase',
            color: 'var(--text-primary)',
            marginBottom: '1rem',
          }}>
            Current Season
          </h2>

          {currentRegistrations.length > 0 ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
              {currentRegistrations.map(r => {
                const balance = (r.total_fee || 0) - (r.amount_paid || 0);
                const programs = r.registration_programs?.map(rp => rp.programs?.label).filter(Boolean);
                return (
                  <a
                    key={r.id}
                    href={`/dashboard/registrations/${r.id}`}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      background: 'var(--bg-card)',
                      border: '1px solid var(--border)',
                      borderRadius: 'var(--radius-md)',
                      padding: '1rem 1.25rem',
                      textDecoration: 'none',
                      gap: '1rem',
                      transition: 'border-color 0.2s',
                    }}
                    onMouseEnter={e => e.currentTarget.style.borderColor = 'var(--gold)'}
                    onMouseLeave={e => e.currentTarget.style.borderColor = 'var(--border)'}
                  >
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <p style={{
                        fontFamily: 'var(--font-display)',
                        fontSize: '1rem',
                        fontWeight: 700,
                        letterSpacing: '0.04em',
                        color: 'var(--text-primary)',
                        marginBottom: '0.15rem',
                      }}>
                        {r.participants?.first_name} {r.participants?.last_name}
                      </p>
                      <p style={{
                        fontFamily: 'var(--font-body)',
                        fontSize: '0.82rem',
                        color: 'var(--text-muted)',
                        whiteSpace: 'nowrap',
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                      }}>
                        {programs?.join(', ') || 'No programs'}
                      </p>
                    </div>
                    <div style={{ textAlign: 'right', flexShrink: 0 }}>
                      {balance > 0 ? (
                        <p style={{
                          fontFamily: 'var(--font-display)',
                          fontSize: '1rem',
                          fontWeight: 700,
                          color: 'var(--red)',
                        }}>
                          {formatCurrency(balance)} due
                        </p>
                      ) : (
                        <p style={{
                          fontFamily: 'var(--font-display)',
                          fontSize: '0.85rem',
                          fontWeight: 600,
                          color: 'var(--gold)',
                        }}>
                          Paid in full
                        </p>
                      )}
                      <p style={{
                        fontFamily: 'var(--font-body)',
                        fontSize: '0.75rem',
                        color: 'var(--text-faint)',
                      }}>
                        #{r.registration_number}
                      </p>
                    </div>
                  </a>
                );
              })}
            </div>
          ) : (
            <div style={{
              background: 'var(--bg-card)',
              border: '1px dashed var(--border)',
              borderRadius: 'var(--radius-md)',
              padding: '2rem',
              textAlign: 'center',
            }}>
              <p style={{
                fontFamily: 'var(--font-accent)',
                fontStyle: 'italic',
                color: 'var(--text-muted)',
              }}>
                No registrations for the current season.
              </p>
            </div>
          )}
        </section>

        {/* Past Registrations */}
        {pastRegistrations.length > 0 && (
          <section style={{ marginBottom: '2.5rem' }}>
            <h2 style={{
              fontFamily: 'var(--font-display)',
              fontSize: '1.3rem',
              fontWeight: 700,
              letterSpacing: '0.08em',
              textTransform: 'uppercase',
              color: 'var(--text-muted)',
              marginBottom: '1rem',
            }}>
              Registration History
            </h2>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
              {pastRegistrations.map(r => {
                const programs = r.registration_programs?.map(rp => rp.programs?.label).filter(Boolean);
                const season = r.registration_programs?.[0]?.programs?.sessions?.seasons?.name;
                return (
                  <a
                    key={r.id}
                    href={`/dashboard/registrations/${r.id}`}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      background: 'var(--bg-card)',
                      border: '1px solid var(--border)',
                      borderRadius: 'var(--radius-md)',
                      padding: '0.875rem 1.25rem',
                      textDecoration: 'none',
                      gap: '1rem',
                      opacity: 0.7,
                      transition: 'opacity 0.2s, border-color 0.2s',
                    }}
                    onMouseEnter={e => {
                      e.currentTarget.style.opacity = '1';
                      e.currentTarget.style.borderColor = 'var(--border)';
                    }}
                    onMouseLeave={e => {
                      e.currentTarget.style.opacity = '0.7';
                      e.currentTarget.style.borderColor = 'var(--border)';
                    }}
                  >
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <p style={{
                        fontFamily: 'var(--font-display)',
                        fontSize: '0.95rem',
                        fontWeight: 700,
                        color: 'var(--text-primary)',
                        marginBottom: '0.15rem',
                      }}>
                        {r.participants?.first_name} {r.participants?.last_name}
                      </p>
                      <p style={{
                        fontFamily: 'var(--font-body)',
                        fontSize: '0.8rem',
                        color: 'var(--text-muted)',
                      }}>
                        {programs?.join(', ') || 'No programs'}
                      </p>
                    </div>
                    <div style={{ textAlign: 'right', flexShrink: 0 }}>
                      {season && (
                        <p style={{
                          fontFamily: 'var(--font-display)',
                          fontSize: '0.8rem',
                          color: 'var(--text-faint)',
                          letterSpacing: '0.05em',
                        }}>
                          Season {season}
                        </p>
                      )}
                      <p style={{
                        fontFamily: 'var(--font-body)',
                        fontSize: '0.75rem',
                        color: 'var(--text-faint)',
                      }}>
                        #{r.registration_number}
                      </p>
                    </div>
                  </a>
                );
              })}
            </div>
          </section>
        )}

        {/* Account section */}
        <section>
          <h2 style={{
            fontFamily: 'var(--font-display)',
            fontSize: '1.3rem',
            fontWeight: 700,
            letterSpacing: '0.08em',
            textTransform: 'uppercase',
            color: 'var(--text-primary)',
            marginBottom: '1rem',
          }}>
            Account
          </h2>
          <div style={{
            background: 'var(--bg-card)',
            border: '1px solid var(--border)',
            borderRadius: 'var(--radius-md)',
            overflow: 'hidden',
          }}>
            {[
              { label: 'Account Information', href: '/dashboard/account' },
              { label: 'Contacts & Emergency Contacts', href: '/dashboard/contacts' },
              { label: 'Payment History', href: '/dashboard/payments' },
              { label: 'Change Password', href: '/dashboard/change-password' },
            ].map((item, i, arr) => (
              <a
                key={item.href}
                href={item.href}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  padding: '1rem 1.25rem',
                  borderBottom: i < arr.length - 1 ? '1px solid var(--border)' : 'none',
                  textDecoration: 'none',
                  transition: 'background 0.15s',
                }}
                onMouseEnter={e => e.currentTarget.style.background = 'var(--bg-hover)'}
                onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
              >
                <span style={{
                  fontFamily: 'var(--font-body)',
                  fontSize: '0.95rem',
                  color: 'var(--text-primary)',
                }}>
                  {item.label}
                </span>
                <span style={{ color: 'var(--gold)', fontSize: '1.2rem' }}>›</span>
              </a>
            ))}
          </div>
        </section>

      </main>
    </div>
  );
}