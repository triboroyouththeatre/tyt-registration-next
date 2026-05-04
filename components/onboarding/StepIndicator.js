'use client';

import { STEPS } from './constants';

export default function StepIndicator({ currentStep }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: '2rem' }}>
      {STEPS.map((step, i) => (
        <div key={step.number} style={{ display: 'flex', alignItems: 'center' }}>
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '0.3rem' }}>
            <div style={{
              width: '32px', height: '32px', borderRadius: '50%',
              background: currentStep === step.number ? 'var(--red)' : currentStep > step.number ? 'var(--gold)' : 'var(--bg-hover)',
              border: `2px solid ${currentStep === step.number ? 'var(--red)' : currentStep > step.number ? 'var(--gold)' : 'var(--border)'}`,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontFamily: 'var(--font-display)', fontSize: '0.8rem', fontWeight: 700,
              color: currentStep >= step.number ? '#111' : 'var(--text-faint)',
            }}>
              {currentStep > step.number ? '✓' : step.number}
            </div>
            <span style={{
              fontFamily: 'var(--font-display)', fontSize: '0.6rem', fontWeight: 600,
              letterSpacing: '0.08em', textTransform: 'uppercase', whiteSpace: 'nowrap',
              color: currentStep === step.number ? 'var(--text-primary)' : 'var(--text-faint)',
            }}>
              {step.label}
            </span>
          </div>
          {i < STEPS.length - 1 && (
            <div style={{
              width: '48px', height: '2px',
              background: currentStep > step.number ? 'var(--gold)' : 'var(--border)',
              margin: '0 4px', marginBottom: '18px',
            }} />
          )}
        </div>
      ))}
    </div>
  );
}
