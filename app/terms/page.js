import Image from 'next/image';
import Link from 'next/link';

export const metadata = {
  title: 'Terms of Service – TYT Family Portal',
  description: 'Terms of Service for the Triboro Youth Theatre Family Registration Portal.',
};

const LAST_UPDATED = 'May 2025';

const sections = [
  {
    title: '1. Acceptance of Terms',
    body: `By creating an account and using the Triboro Youth Theatre (TYT) Family Portal, you agree to be bound by these Terms of Service. If you do not agree to these terms, please do not use this portal. These terms apply to all users of the portal, including parents, guardians, and authorized family members registering participants in TYT programs.`,
  },
  {
    title: '2. Eligibility & Account Responsibility',
    body: `You must be at least 18 years old and a parent or legal guardian of any participant you register through this portal. You are responsible for maintaining the confidentiality of your account credentials and for all activity that occurs under your account. Please notify us immediately at info@triboroyouththeatre.org if you suspect unauthorized access to your account.`,
  },
  {
    title: '3. Registration & Enrollment',
    body: `Submitting a registration through this portal constitutes an offer to enroll a participant in a TYT program. Enrollment is not confirmed until TYT accepts the registration and the required deposit or full payment is received. TYT reserves the right to decline or cancel any registration at its discretion, including if a program is at capacity or if eligibility requirements are not met. Waitlist placement does not guarantee enrollment.`,
  },
  {
    title: '4. Fees & Payment',
    body: `Program fees, deposit amounts, and payment deadlines are displayed during the registration process and are subject to change between seasons. Deposits are collected at the time of registration. Remaining balances are due by the date specified for each program. Late payments may result in registration cancellation. All payments are processed securely through Stripe. TYT does not store your full payment card information.`,
  },
  {
    title: '5. Refund & Cancellation Policy',
    body: `Cancellation requests must be submitted in writing to info@triboroyouththeatre.org. Refund eligibility depends on the timing of the cancellation relative to the program start date and the specific program's refund policy, which will be communicated at the time of registration. Deposits may be non-refundable once a program has begun casting or rehearsals. TYT is not responsible for fees incurred due to participant withdrawal after the refund deadline.`,
  },
  {
    title: '6. Health & Medical Information',
    body: `You agree that the health, allergy, and medical information you provide during registration is accurate and complete to the best of your knowledge. This information is used solely to ensure participant safety during TYT activities. You authorize TYT staff to take reasonable emergency action if a participant requires medical attention and a parent or guardian cannot be reached promptly.`,
  },
  {
    title: '7. Photography & Media Release',
    body: `Unless you opt out in writing, you grant TYT a non-exclusive, royalty-free license to use photographs, video, and other media featuring participants taken during TYT programs and events for promotional, educational, and non-commercial purposes, including on TYT's website and social media channels. Opt-out requests should be submitted to info@triboroyouththeatre.org.`,
  },
  {
    title: '8. Code of Conduct',
    body: `Participants and their families are expected to treat all TYT staff, volunteers, and fellow participants with respect. TYT reserves the right to dismiss a participant from a program without refund if, in TYT's sole judgment, the participant's conduct is harmful, disruptive, or contrary to the values of TYT. Parents and guardians are expected to model respectful behavior at all TYT events and facilities.`,
  },
  {
    title: '9. Limitation of Liability',
    body: `To the fullest extent permitted by law, Triboro Youth Theatre, its directors, staff, and volunteers shall not be liable for any indirect, incidental, or consequential damages arising from your use of this portal or participation in TYT programs. TYT's total liability for any claim related to the portal or its programs shall not exceed the amount you paid to TYT in the twelve months preceding the claim.`,
  },
  {
    title: '10. Changes to These Terms',
    body: `TYT may update these Terms of Service from time to time. We will notify registered families of material changes via email. Continued use of the portal after changes take effect constitutes your acceptance of the revised terms.`,
  },
  {
    title: '11. Contact',
    body: `Questions about these Terms of Service may be directed to Triboro Youth Theatre at info@triboroyouththeatre.org.`,
  },
];

export default function TermsPage() {
  return (
    <main style={{
      minHeight: '100vh',
      background: 'var(--bg-dark)',
      padding: '3rem 1.5rem',
    }}>
      <div style={{ width: '100%', maxWidth: '760px', margin: '0 auto' }}>

        {/* Logo & back link */}
        <div style={{ textAlign: 'center', marginBottom: '2.5rem' }}>
          <Link href="/signup">
            <Image
              src="/images/tyt-logo.png"
              alt="Triboro Youth Theatre"
              width={80}
              height={80}
              style={{ objectFit: 'contain' }}
              priority
            />
          </Link>
        </div>

        {/* Header */}
        <div style={{ marginBottom: '2.5rem' }}>
          <h1 style={{
            fontFamily: 'var(--font-display)',
            fontSize: 'clamp(2rem, 5vw, 2.8rem)',
            fontWeight: 800,
            letterSpacing: '0.06em',
            textTransform: 'uppercase',
            color: 'var(--text-primary)',
            marginBottom: '0.5rem',
          }}>
            Terms of Service
          </h1>
          <p style={{
            fontFamily: 'var(--font-accent)',
            fontStyle: 'italic',
            color: 'var(--text-muted)',
            fontSize: '0.9rem',
          }}>
            Last updated: {LAST_UPDATED}
          </p>
          <hr className="tyt-divider" style={{ marginTop: '1.25rem' }} />
          <p style={{
            fontFamily: 'var(--font-body)',
            color: 'var(--text-muted)',
            fontSize: '0.95rem',
            lineHeight: 1.75,
            marginTop: '1.25rem',
          }}>
            Please read these terms carefully before creating an account or registering a
            participant through the TYT Family Portal. By using this portal, you agree to
            the terms below.
          </p>
        </div>

        {/* Sections */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0' }}>
          {sections.map((section, i) => (
            <div
              key={i}
              className="tyt-card"
              style={{ marginBottom: '1rem', padding: '1.5rem 2rem' }}
            >
              <h2 style={{
                fontFamily: 'var(--font-display)',
                fontSize: '1rem',
                fontWeight: 700,
                letterSpacing: '0.08em',
                textTransform: 'uppercase',
                color: 'var(--gold)',
                marginBottom: '0.75rem',
              }}>
                {section.title}
              </h2>
              <p style={{
                fontFamily: 'var(--font-body)',
                color: 'var(--text-muted)',
                fontSize: '0.92rem',
                lineHeight: 1.8,
              }}>
                {section.body}
              </p>
            </div>
          ))}
        </div>

        {/* Footer nav */}
        <div style={{
          marginTop: '2.5rem',
          paddingTop: '1.5rem',
          borderTop: '1px solid var(--border)',
          display: 'flex',
          flexWrap: 'wrap',
          gap: '1.5rem',
          justifyContent: 'space-between',
          alignItems: 'center',
        }}>
          <Link href="/signup" style={{
            fontFamily: 'var(--font-accent)',
            fontStyle: 'italic',
            color: 'var(--gold)',
            fontSize: '0.9rem',
          }}>
            ← Back to Sign Up
          </Link>
          <Link href="/privacy" style={{
            fontFamily: 'var(--font-body)',
            color: 'var(--text-muted)',
            fontSize: '0.85rem',
          }}>
            Privacy Policy →
          </Link>
        </div>

        <p style={{
          textAlign: 'center',
          color: 'var(--text-faint)',
          fontSize: '0.75rem',
          marginTop: '2rem',
          fontFamily: 'var(--font-body)',
        }}>
          &copy; {new Date().getFullYear()} Triboro Youth Theatre
        </p>

      </div>
    </main>
  );
}