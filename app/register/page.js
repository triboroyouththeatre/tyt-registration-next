import { createClient } from '@/lib/supabase/server';
import { redirect } from 'next/navigation';
import Image from 'next/image';
import LogoutButton from '@/components/LogoutButton';

export default async function RegisterPage() {
  const supabase = await createClient();

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  // Get family info
  const { data: profile } = await supabase
    .from('profiles')
    .select('family_id')
    .eq('id', user.id)
    .single();

  // Get active participants for this family
  const { data: participants } = await supabase
    .from('participants')
    .select('id, first_name, last_name, yog')
    .eq('family_id', profile.family_id)
    .eq('is_active', true)
    .order('first_name');

  // Get all programs in active sessions with registration open or closed
  const { data: programs } = await supabase
    .from('programs')
    .select(`
      id, label, description, schedule, fee, deposit_amount,
      balance_due_date, enrollment_limit, yog_min, yog_max,
      is_registration_open, is_active,
      sessions(
        name,
        seasons(name)
      )
    `)
    .eq('is_active', true)
    .order('label');

  // Get current enrollment counts
  const { data: enrollments } = await supabase
    .from('registrations')
    .select('id, registration_programs(program_id)')
    .neq('status_id', (
      await supabase.from('registration_statuses').select('id').eq('label', 'Cancelled').single()
    ).data?.id);

  // Count enrollments per program
  const enrollmentCounts = {};
  enrollments?.forEach(reg => {
    reg.registration_programs?.forEach(rp => {
      enrollmentCounts[rp.program_id] = (enrollmentCounts[rp.program_id] || 0) + 1;
    });
  });

  // Get active grade levels for display
  const { data: gradeLevels } = await supabase
    .from('grade_levels')
    .select('yog, label, seasons!inner(is_active)')
    .eq('seasons.is_active', true)
    .order('yog');

  function getGradeLabel(yog) {
    return gradeLevels?.find(g => g.yog === yog)?.label || `Class of ${yog}`;
  }

  function getGradeRange(yog_min, yog_max) {
    if (!yog_min || !yog_max) return null;
    const minLabel = getGradeLabel(yog_min);
    const maxLabel = getGradeLabel(yog_max);
    // Strip "Grade" text and just show numbers
    const minNum = minLabel.replace(' Grade', '').replace('th', '').replace('st', '').replace('nd', '').replace('rd', '');
    const maxNum = maxLabel.replace(' Grade', '').replace('th', '').replace('st', '').replace('nd', '').replace('rd', '');
    return `${maxLabel} – ${minLabel}`;
  }

  function formatCurrency(amount) {
    return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(amount);
  }

  function formatDate(dateStr) {
    if (!dateStr) return null;
    const d = new Date(dateStr + 'T00:00:00');
    return d.toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' });
  }

  // Check if a participant is eligible for a program
  function isEligible(participant, program) {
    if (!program.yog_min || !program.yog_max) return true;
    return participant.yog >= program.yog_min && participant.yog <= program.yog_max;
  }

  const openPrograms = programs?.filter(p => p.is_registration_open) || [];
  const closedPrograms = programs?.filter(p => !p.is_registration_open) || [];

  return (
    <>
      <style>{`
        .program-card {
          background: var(--bg-card);
          border: 1px solid var(--border);
          border-radius: var(--radius-md);
          overflow: hidden;
          transition: border-color 0.2s;
        }
        .program-card:hover {
          border-color: var(--gold);
        }
        .program-card-closed {
          opacity: 0.6;
        }
        .program-card-closed:hover {
          border-color: var(--border);
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
          <a href="/dashboard" style={{ display: 'flex', alignItems: 'center', textDecoration: 'none' }}>
            <Image src="/images/tyt-logo.png" alt="Triboro Youth Theatre" width={48} height={48} style={{ objectFit: 'contain' }} />
          </a>
          <span style={{ fontFamily: 'var(--font-display)', fontSize: '1.1rem', fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase', color: 'var(--text-primary)' }}>
            Register
          </span>
          <LogoutButton />
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

          {/* Open programs */}
          {openPrograms.length > 0 && (
            <section style={{ marginBottom: '2.5rem' }}>
              <h2 style={{ fontFamily: 'var(--font-display)', fontSize: '0.85rem', fontWeight: 700, letterSpacing: '0.12em', textTransform: 'uppercase', color: 'var(--gold)', marginBottom: '1rem' }}>
                Registration Open
              </h2>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                {openPrograms.map(program => {
                  const enrolled = enrollmentCounts[program.id] || 0;
                  const spotsLeft = program.enrollment_limit - enrolled;
                  const isFull = spotsLeft <= 0;
                  const gradeRange = getGradeRange(program.yog_min, program.yog_max);

                  return (
                    <a
                      key={program.id}
                      href={`/register/${program.id}`}
                      className="program-card"
                      style={{ textDecoration: 'none' }}
                    >
                      <div style={{ padding: '1.25rem 1.5rem' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '1rem', flexWrap: 'wrap', marginBottom: '0.75rem' }}>
                          <div>
                            <h3 style={{ fontFamily: 'var(--font-display)', fontSize: '1.4rem', fontWeight: 800, letterSpacing: '0.04em', textTransform: 'uppercase', color: 'var(--text-primary)', marginBottom: '0.2rem' }}>
                              {program.label}
                            </h3>
                            <p style={{ fontFamily: 'var(--font-body)', fontSize: '0.82rem', color: 'var(--text-muted)' }}>
                              {program.sessions?.seasons?.name} Season · {program.sessions?.name}
                            </p>
                          </div>
                          <div style={{ textAlign: 'right', flexShrink: 0 }}>
                            {isFull ? (
                              <span style={{ fontFamily: 'var(--font-display)', fontSize: '0.75rem', fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase', color: 'var(--red)', border: '1px solid var(--red)', borderRadius: '3px', padding: '0.2rem 0.6rem' }}>
                                Waitlist
                              </span>
                            ) : (
                              <span style={{ fontFamily: 'var(--font-display)', fontSize: '0.75rem', fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase', color: 'var(--gold)', border: '1px solid var(--gold)', borderRadius: '3px', padding: '0.2rem 0.6rem' }}>
                                {spotsLeft} spot{spotsLeft !== 1 ? 's' : ''} left
              </span>
                            )}
                          </div>
                        </div>

                        {/* Details row */}
                        <div style={{ display: 'flex', gap: '1.5rem', flexWrap: 'wrap', marginBottom: '0.75rem' }}>
                          {gradeRange && (
                            <div>
                              <p style={{ fontFamily: 'var(--font-display)', fontSize: '0.65rem', fontWeight: 600, letterSpacing: '0.1em', textTransform: 'uppercase', color: 'var(--text-faint)', marginBottom: '0.15rem' }}>Eligibility</p>
                              <p style={{ fontFamily: 'var(--font-body)', fontSize: '0.85rem', color: 'var(--text-primary)' }}>{gradeRange}</p>
                            </div>
                          )}
                          <div>
                            <p style={{ fontFamily: 'var(--font-display)', fontSize: '0.65rem', fontWeight: 600, letterSpacing: '0.1em', textTransform: 'uppercase', color: 'var(--text-faint)', marginBottom: '0.15rem' }}>Schedule</p>
                            <p style={{ fontFamily: 'var(--font-body)', fontSize: '0.85rem', color: 'var(--text-primary)' }}>{program.schedule || 'TBD'}</p>
                          </div>
                          <div>
                            <p style={{ fontFamily: 'var(--font-display)', fontSize: '0.65rem', fontWeight: 600, letterSpacing: '0.1em', textTransform: 'uppercase', color: 'var(--text-faint)', marginBottom: '0.15rem' }}>Fee</p>
                            <p style={{ fontFamily: 'var(--font-body)', fontSize: '0.85rem', color: 'var(--text-primary)' }}>{formatCurrency(program.fee)}</p>
                          </div>
                          <div>
                            <p style={{ fontFamily: 'var(--font-display)', fontSize: '0.65rem', fontWeight: 600, letterSpacing: '0.1em', textTransform: 'uppercase', color: 'var(--text-faint)', marginBottom: '0.15rem' }}>Deposit Due Now</p>
                            <p style={{ fontFamily: 'var(--font-body)', fontSize: '0.85rem', color: 'var(--gold)' }}>{formatCurrency(program.deposit_amount)}</p>
                          </div>
                          {program.balance_due_date && (
                            <div>
                              <p style={{ fontFamily: 'var(--font-display)', fontSize: '0.65rem', fontWeight: 600, letterSpacing: '0.1em', textTransform: 'uppercase', color: 'var(--text-faint)', marginBottom: '0.15rem' }}>Balance Due</p>
                              <p style={{ fontFamily: 'var(--font-body)', fontSize: '0.85rem', color: 'var(--text-primary)' }}>{formatDate(program.balance_due_date)}</p>
                            </div>
                          )}
                        </div>

                        {/* Eligible participants */}
                        {participants && participants.length > 0 && (
                          <div style={{ borderTop: '1px solid var(--border)', paddingTop: '0.75rem', marginTop: '0.25rem' }}>
                            <p style={{ fontFamily: 'var(--font-display)', fontSize: '0.65rem', fontWeight: 600, letterSpacing: '0.1em', textTransform: 'uppercase', color: 'var(--text-faint)', marginBottom: '0.4rem' }}>
                              Your Participants
                            </p>
                            <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
                              {participants.map(p => {
                                const eligible = isEligible(p, program);
                                const gradeLabel = getGradeLabel(p.yog);
                                return (
                                  <span key={p.id} style={{
                                    fontFamily: 'var(--font-body)',
                                    fontSize: '0.8rem',
                                    color: eligible ? 'var(--text-primary)' : 'var(--text-faint)',
                                    background: eligible ? 'var(--bg-hover)' : 'transparent',
                                    border: `1px solid ${eligible ? 'var(--border)' : 'var(--border)'}`,
                                    borderRadius: '3px',
                                    padding: '0.2rem 0.6rem',
                                    textDecoration: eligible ? 'none' : 'line-through',
                                  }}>
                                    {p.first_name} {p.last_name}
                                    {!eligible && <span style={{ fontSize: '0.7rem', marginLeft: '0.3rem', color: 'var(--text-faint)' }}>(ineligible)</span>}
                                  </span>
                                );
                              })}
                            </div>
                          </div>
                        )}
                      </div>
                    </a>
                  );
                })}
              </div>
            </section>
          )}

          {/* Closed programs */}
          {closedPrograms.length > 0 && (
            <section>
              <h2 style={{ fontFamily: 'var(--font-display)', fontSize: '0.85rem', fontWeight: 700, letterSpacing: '0.12em', textTransform: 'uppercase', color: 'var(--text-muted)', marginBottom: '1rem' }}>
                Registration Closed
              </h2>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                {closedPrograms.map(program => {
                  const gradeRange = getGradeRange(program.yog_min, program.yog_max);
                  return (
                    <div key={program.id} className="program-card program-card-closed">
                      <div style={{ padding: '1.25rem 1.5rem' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '1rem' }}>
                          <div>
                            <h3 style={{ fontFamily: 'var(--font-display)', fontSize: '1.4rem', fontWeight: 800, letterSpacing: '0.04em', textTransform: 'uppercase', color: 'var(--text-primary)', marginBottom: '0.2rem' }}>
                              {program.label}
                            </h3>
                            <p style={{ fontFamily: 'var(--font-body)', fontSize: '0.82rem', color: 'var(--text-muted)' }}>
                              {program.sessions?.seasons?.name} Season · {program.sessions?.name}
                              {gradeRange && ` · ${gradeRange}`}
                            </p>
                          </div>
                          <span style={{ fontFamily: 'var(--font-display)', fontSize: '0.75rem', fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase', color: 'var(--text-faint)', border: '1px solid var(--border)', borderRadius: '3px', padding: '0.2rem 0.6rem', flexShrink: 0 }}>
                            Registration Closed
                          </span>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </section>
          )}

          {/* No programs at all */}
          {(!programs || programs.length === 0) && (
            <div style={{ background: 'var(--bg-card)', border: '1px dashed var(--border)', borderRadius: 'var(--radius-md)', padding: '3rem', textAlign: 'center' }}>
              <p style={{ fontFamily: 'var(--font-display)', fontSize: '1.2rem', fontWeight: 700, letterSpacing: '0.05em', textTransform: 'uppercase', color: 'var(--text-muted)', marginBottom: '0.5rem' }}>
                No Programs Available
              </p>
              <p style={{ fontFamily: 'var(--font-accent)', fontStyle: 'italic', color: 'var(--text-faint)' }}>
                Check back soon for upcoming programs.
              </p>
            </div>
          )}

        </main>
      </div>
    </>
  );
}