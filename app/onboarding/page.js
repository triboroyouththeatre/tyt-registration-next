'use client';

import { useState, useEffect } from 'react';
import { createClient } from '@/lib/supabase/client';
import Image from 'next/image';
import StepIndicator from '@/components/onboarding/StepIndicator';
import Step1 from '@/components/onboarding/Step1';
import Step2 from '@/components/onboarding/Step2';
import Step3 from '@/components/onboarding/Step3';
import Step4 from '@/components/onboarding/Step4';

export default function OnboardingPage() {
  const [step, setStep] = useState(1);
  const [familyId, setFamilyId] = useState(null);
  const [ecForms, setEcForms] = useState(null);

  useEffect(() => {
    async function load() {
      const supabase = createClient();
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { window.location.href = '/login'; return; }
      const { data: profile } = await supabase.from('profiles').select('family_id').eq('id', user.id).single();
      setFamilyId(profile?.family_id || null);
    }
    load();
  }, []);

  function next() { setStep(s => Math.min(s + 1, 4)); }
  function back() { setStep(s => Math.max(s - 1, 1)); }

  if (!familyId) {
    return (
      <div style={{ minHeight: '100vh', background: 'var(--bg-dark)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <p style={{ fontFamily: 'var(--font-accent)', fontStyle: 'italic', color: 'var(--text-muted)' }}>Loading...</p>
      </div>
    );
  }

  return (
    <div style={{ minHeight: '100vh', background: 'var(--bg-dark)', display: 'flex', flexDirection: 'column' }}>
      <div style={{ textAlign: 'center', padding: '2rem 1.5rem 0' }}>
        <Image src="/images/tyt-logo.png" alt="Triboro Youth Theatre" width={80} height={80} style={{ objectFit: 'contain' }} priority />
        <h1 style={{ fontFamily: 'var(--font-display)', fontSize: '1.4rem', fontWeight: 800, letterSpacing: '0.08em', textTransform: 'uppercase', color: 'var(--text-primary)', marginTop: '0.5rem', marginBottom: '0.25rem' }}>
          Welcome to TYT
        </h1>
        <p style={{ fontFamily: 'var(--font-accent)', fontStyle: 'italic', color: 'var(--text-muted)', fontSize: '0.9rem', marginBottom: '1.5rem' }}>
          Let&apos;s get your account set up.
        </p>
      </div>

      <div style={{ padding: '0 1.5rem' }}>
        <StepIndicator currentStep={step} />
      </div>

      <main style={{ maxWidth: '560px', width: '100%', margin: '0 auto', padding: '0 1.5rem 3rem' }}>
        <div className="tyt-card">
          {step === 1 && <Step1 onComplete={next} familyId={familyId} />}
          {step === 2 && <Step2 onComplete={next} onBack={back} familyId={familyId} />}
          {step === 3 && <Step3 onComplete={next} onBack={back} onSkip={next} familyId={familyId} />}
          {step === 4 && <Step4 onComplete={() => { window.location.href = '/dashboard'; }} onBack={back} familyId={familyId} ecForms={ecForms} setEcForms={setEcForms} />}
        </div>
      </main>
    </div>
  );
}
