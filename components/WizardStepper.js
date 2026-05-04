'use client';

/**
 * Visual progress indicator for the multi-step registration wizard.
 *
 * Pass `currentStep` (1-4) and the component figures out which step is
 * active and which are done. This replaces the duplicated step-array
 * declarations and inline render blocks that used to live in each
 * wizard page.
 *
 * To add or rename a step, edit STEPS below — change propagates to all
 * four wizard pages automatically.
 */

const STEPS = [
  { n: 1, label: 'Health'     },
  { n: 2, label: 'Agreements' },
  { n: 3, label: 'Review'     },
  { n: 4, label: 'Payment'    },
];

export default function WizardStepper({ currentStep }) {
  return (
    <div style={{
      background: 'var(--bg-card)',
      borderBottom: '1px solid var(--border)',
      padding: '0.75rem 1.5rem',
    }}>
      <div style={{
        maxWidth: '680px',
        margin: '0 auto',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
      }}>
        {STEPS.map((s, i) => {
          const done   = s.n <  currentStep;
          const active = s.n === currentStep;
          return (
            <div key={s.n} style={{ display: 'flex', alignItems: 'center' }}>
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '0.2rem' }}>
                <div style={{
                  width: '28px', height: '28px', borderRadius: '50%',
                  background: done ? 'var(--gold)' : active ? 'var(--red)' : 'var(--bg-hover)',
                  border: `2px solid ${done ? 'var(--gold)' : active ? 'var(--red)' : 'var(--border)'}`,
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontFamily: 'var(--font-display)', fontSize: '0.75rem', fontWeight: 700,
                  color: done ? '#111' : active ? '#fff' : 'var(--text-faint)',
                }}>
                  {done ? '✓' : s.n}
                </div>
                <span style={{
                  fontFamily: 'var(--font-display)', fontSize: '0.55rem', fontWeight: 600,
                  letterSpacing: '0.08em', textTransform: 'uppercase', whiteSpace: 'nowrap',
                  color: done || active ? 'var(--text-primary)' : 'var(--text-faint)',
                }}>
                  {s.label}
                </span>
              </div>
              {i < STEPS.length - 1 && (
                <div style={{
                  width: '40px', height: '2px',
                  background: done ? 'var(--gold)' : 'var(--border)',
                  margin: '0 4px', marginBottom: '16px',
                }} />
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}