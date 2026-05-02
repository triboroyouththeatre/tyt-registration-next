'use client';

import { useState } from 'react';

function formatCurrency(amount) {
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(amount);
}

function formatDate(dateStr) {
  if (!dateStr) return null;
  const d = new Date(dateStr + 'T00:00:00');
  return d.toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' });
}

function getGradeLabel(gradeLevels, yog) {
  return gradeLevels?.find(g => g.yog === yog)?.label || `Class of ${yog}`;
}

function getGradeRange(gradeLevels, yog_min, yog_max) {
  if (!yog_min || !yog_max) return null;
  const minLabel = getGradeLabel(gradeLevels, yog_min);
  const maxLabel = getGradeLabel(gradeLevels, yog_max);
  return `${maxLabel} – ${minLabel}`;
}

function isEligible(participant, program) {
  if (!program.yog_min || !program.yog_max) return true;
  return participant.yog >= program.yog_min && participant.yog <= program.yog_max;
}

function ProgramCard({ program, participants, enrollmentCounts, gradeLevels }) {
  const [expanded, setExpanded] = useState(false);

  const enrolled = enrollmentCounts[program.id] || 0;
  const spotsLeft = program.enrollment_limit - enrolled;
  const isFull = spotsLeft <= 0;
  const gradeRange = getGradeRange(gradeLevels, program.yog_min, program.yog_max);
  const seasonDisplay = program.sessions?.seasons?.display_name || program.sessions?.seasons?.name;
  const eligibleParticipants = participants.filter(p => isEligible(p, program));

  return (
    <div style={{
      background: 'var(--bg-card)',
      border: `1px solid ${expanded ? 'var(--gold)' : 'var(--border)'}`,
      borderRadius: 'var(--radius-md)',
      overflow: 'hidden',
      transition: 'border-color 0.2s',
    }}>
      {/* Clickable header */}
      <button
        onClick={() => setExpanded(e => !e)}
        style={{
          width: '100%',
          background: 'none',
          border: 'none',
          cursor: 'pointer',
          padding: '1.25rem 1.5rem',
          textAlign: 'left',
        }}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '1rem', flexWrap: 'wrap', marginBottom: '0.75rem' }}>
          <div>
            <h3 style={{ fontFamily: 'var(--font-display)', fontSize: '1.4rem', fontWeight: 800, letterSpacing: '0.04em', textTransform: 'uppercase', color: 'var(--text-primary)', marginBottom: '0.2rem' }}>
              {program.label}
            </h3>
            <p style={{ fontFamily: 'var(--font-body)', fontSize: '0.82rem', color: 'var(--text-muted)' }}>
              {seasonDisplay} Season · {program.sessions?.name} Session
            </p>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', flexShrink: 0 }}>
            {isFull ? (
              <span style={{ fontFamily: 'var(--font-display)', fontSize: '0.75rem', fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase', color: 'var(--red)', border: '1px solid var(--red)', borderRadius: '3px', padding: '0.2rem 0.6rem' }}>
                Waitlist
              </span>
            ) : (
              <span style={{ fontFamily: 'var(--font-display)', fontSize: '0.75rem', fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase', color: 'var(--gold)', border: '1px solid var(--gold)', borderRadius: '3px', padding: '0.2rem 0.6rem' }}>
                {spotsLeft} spot{spotsLeft !== 1 ? 's' : ''} left
              </span>
            )}
            <span style={{ color: 'var(--gold)', fontSize: '1.2rem', transition: 'transform 0.2s', display: 'inline-block', transform: expanded ? 'rotate(90deg)' : 'none' }}>›</span>
          </div>
        </div>

        {/* Summary row — always visible */}
        <div style={{ display: 'flex', gap: '1.5rem', flexWrap: 'wrap' }}>
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
            <p style={{ fontFamily: 'var(--font-display)', fontSize: '0.65rem', fontWeight: 600, letterSpacing: '0.1em', textTransform: 'uppercase', color: 'var(--text-faint)', marginBottom: '0.15rem' }}>Registration Fee</p>
            <p style={{ fontFamily: 'var(--font-body)', fontSize: '0.85rem', color: 'var(--text-primary)' }}>{formatCurrency(program.fee)}</p>
          </div>
        </div>
      </button>

      {/* Expanded content */}
      {expanded && (
        <div style={{ borderTop: '1px solid var(--border)', padding: '1.25rem 1.5rem' }}>

          {/* Description */}
          {program.description && (
            <div style={{ marginBottom: '1.5rem' }}>
              <div
  style={{ fontFamily: 'var(--font-body)', fontSize: '0.875rem', color: 'var(--text-muted)', lineHeight: 1.7 }}
  dangerouslySetInnerHTML={{ __html: program.description }}
/>
            </div>
          )}

          {/* Payment details */}
          <div style={{
            background: 'var(--bg-hover)',
            border: '1px solid var(--border)',
            borderRadius: 'var(--radius-sm)',
            padding: '1rem 1.25rem',
            marginBottom: '1.5rem',
            display: 'flex',
            gap: '2rem',
            flexWrap: 'wrap',
          }}>
            <div>
              <p style={{ fontFamily: 'var(--font-display)', fontSize: '0.65rem', fontWeight: 600, letterSpacing: '0.1em', textTransform: 'uppercase', color: 'var(--text-faint)', marginBottom: '0.25rem' }}>Deposit Due at Registration</p>
              <p style={{ fontFamily: 'var(--font-display)', fontSize: '1.2rem', fontWeight: 800, color: 'var(--gold)' }}>{formatCurrency(program.deposit_amount)}</p>
            </div>
            <div>
              <p style={{ fontFamily: 'var(--font-display)', fontSize: '0.65rem', fontWeight: 600, letterSpacing: '0.1em', textTransform: 'uppercase', color: 'var(--text-faint)', marginBottom: '0.25rem' }}>Balance Due</p>
              <p style={{ fontFamily: 'var(--font-display)', fontSize: '1.2rem', fontWeight: 800, color: 'var(--text-primary)' }}>
                {program.balance_due_date ? formatDate(program.balance_due_date) : 'TBD'}
              </p>
            </div>
            <div>
              <p style={{ fontFamily: 'var(--font-display)', fontSize: '0.65rem', fontWeight: 600, letterSpacing: '0.1em', textTransform: 'uppercase', color: 'var(--text-faint)', marginBottom: '0.25rem' }}>Balance Amount</p>
              <p style={{ fontFamily: 'var(--font-display)', fontSize: '1.2rem', fontWeight: 800, color: 'var(--text-primary)' }}>{formatCurrency(program.fee - program.deposit_amount)}</p>
            </div>
          </div>

          {/* Participants & register button */}
          {participants.length > 0 && (
            <div>
              <p style={{ fontFamily: 'var(--font-display)', fontSize: '0.75rem', fontWeight: 600, letterSpacing: '0.1em', textTransform: 'uppercase', color: 'var(--text-muted)', marginBottom: '0.75rem' }}>
                Register a Participant
              </p>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                {participants.map(p => {
                  const eligible = isEligible(p, program);
                  const gradeLabel = getGradeLabel(gradeLevels, p.yog);
                  return (
                    <div key={p.id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '1rem' }}>
                      <div>
                        <p style={{ fontFamily: 'var(--font-body)', fontSize: '0.9rem', color: eligible ? 'var(--text-primary)' : 'var(--text-faint)', textDecoration: eligible ? 'none' : 'line-through' }}>
                          {p.first_name} {p.last_name}
                        </p>
                        {!eligible && (
                          <p style={{ fontFamily: 'var(--font-body)', fontSize: '0.75rem', color: 'var(--text-faint)' }}>
                            Not eligible — {gradeLabel} ({gradeRange} only)
                          </p>
                        )}
                      </div>
                      {eligible && (
                        isFull ? (
                          <a
                            href={`/register/${program.id}/waitlist?participant=${p.id}`}
                            className="tyt-btn tyt-btn-secondary"
                            style={{ fontSize: '0.8rem', padding: '0.4rem 1rem', whiteSpace: 'nowrap' }}
                          >
                            Join Waitlist
                          </a>
                        ) : (
                          <a
                            href={`/register/${program.id}?participant=${p.id}`}
                            className="tyt-btn tyt-btn-primary"
                            style={{ fontSize: '0.8rem', padding: '0.4rem 1rem', whiteSpace: 'nowrap' }}
                          >
                            Register →
                          </a>
                        )
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {participants.length === 0 && (
            <div style={{ textAlign: 'center', padding: '1rem 0' }}>
              <p style={{ fontFamily: 'var(--font-accent)', fontStyle: 'italic', color: 'var(--text-muted)', marginBottom: '1rem' }}>
                You need to add a participant before registering.
              </p>
              <a href="/dashboard/participants/new" className="tyt-btn tyt-btn-secondary" style={{ fontSize: '0.85rem' }}>
                Add Participant
              </a>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export default function ProgramList({ programs, participants, enrollmentCounts, gradeLevels }) {
  const openPrograms = programs.filter(p => p.is_registration_open);
  const closedPrograms = programs.filter(p => !p.is_registration_open);

  if (programs.length === 0) {
    return (
      <div style={{ background: 'var(--bg-card)', border: '1px dashed var(--border)', borderRadius: 'var(--radius-md)', padding: '3rem', textAlign: 'center' }}>
        <p style={{ fontFamily: 'var(--font-display)', fontSize: '1.2rem', fontWeight: 700, letterSpacing: '0.05em', textTransform: 'uppercase', color: 'var(--text-muted)', marginBottom: '0.5rem' }}>
          No Programs Available
        </p>
        <p style={{ fontFamily: 'var(--font-accent)', fontStyle: 'italic', color: 'var(--text-faint)' }}>
          Check back soon for upcoming programs.
        </p>
      </div>
    );
  }

  return (
    <>
      {openPrograms.length > 0 && (
        <section style={{ marginBottom: '2.5rem' }}>
          <h2 style={{ fontFamily: 'var(--font-display)', fontSize: '0.85rem', fontWeight: 700, letterSpacing: '0.12em', textTransform: 'uppercase', color: 'var(--gold)', marginBottom: '1rem' }}>
            Registration Open
          </h2>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
            {openPrograms.map(program => (
              <ProgramCard
                key={program.id}
                program={program}
                participants={participants}
                enrollmentCounts={enrollmentCounts}
                gradeLevels={gradeLevels}
              />
            ))}
          </div>
        </section>
      )}

      {closedPrograms.length > 0 && (
        <section>
          <h2 style={{ fontFamily: 'var(--font-display)', fontSize: '0.85rem', fontWeight: 700, letterSpacing: '0.12em', textTransform: 'uppercase', color: 'var(--text-muted)', marginBottom: '1rem' }}>
            Registration Closed
          </h2>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
            {closedPrograms.map(program => {
              const gradeRange = getGradeRange(gradeLevels, program.yog_min, program.yog_max);
              const seasonDisplay = program.sessions?.seasons?.display_name || program.sessions?.seasons?.name;
              return (
                <div key={program.id} style={{ background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 'var(--radius-md)', padding: '1.25rem 1.5rem', opacity: 0.6 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '1rem' }}>
                    <div>
                      <h3 style={{ fontFamily: 'var(--font-display)', fontSize: '1.4rem', fontWeight: 800, letterSpacing: '0.04em', textTransform: 'uppercase', color: 'var(--text-primary)', marginBottom: '0.2rem' }}>
                        {program.label}
                      </h3>
                      <p style={{ fontFamily: 'var(--font-body)', fontSize: '0.82rem', color: 'var(--text-muted)' }}>
                        {seasonDisplay} Season · {program.sessions?.name} Session
                        {gradeRange && ` · ${gradeRange}`}
                      </p>
                    </div>
                    <span style={{ fontFamily: 'var(--font-display)', fontSize: '0.75rem', fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase', color: 'var(--text-faint)', border: '1px solid var(--border)', borderRadius: '3px', padding: '0.2rem 0.6rem', flexShrink: 0 }}>
                      Registration Closed
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        </section>
      )}
    </>
  );
}