import Image from 'next/image';
import Link from 'next/link';

export const metadata = {
  title: 'Privacy Policy – TYT Family Portal',
  description: 'Privacy Policy for the Triboro Youth Theatre Family Registration Portal.',
};

const LAST_UPDATED = 'May 2025';

const sections = [
  {
    title: '1. Who We Are',
    body: `Triboro Youth Theatre (TYT) operates the TYT Family Portal, a registration platform for youth performing arts programs. Our mailing address is available by contacting us at info@triboroyouththeatre.org. This Privacy Policy describes how we collect, use, and protect information you provide when using this portal.`,
  },
  {
    title: '2. Information We Collect',
    items: [
      { label: 'Account information', detail: 'Email address and password when you create a family account.' },
      { label: 'Family & contact details', detail: 'Names, addresses, phone numbers, and email addresses for parents, guardians, and emergency contacts you enter during onboarding.' },
      { label: 'Participant information', detail: 'Names, dates of birth, grade/year of graduation, and gender for each performer you register.' },
      { label: 'Health & medical information', detail: 'Allergy, medication, and relevant medical history you disclose during the registration process, collected solely for participant safety.' },
      { label: 'Payment information', detail: 'Payments are processed by Stripe. TYT receives confirmation of payment but does not store full card numbers or banking details.' },
      { label: 'Usage data', detail: 'Standard server logs (IP address, browser type, pages visited) used for security monitoring and portal performance.' },
    ],
  },
  {
    title: '3. How We Use Your Information',
    items: [
      { label: 'Program administration', detail: 'To process registrations, manage enrollment, send confirmation emails, and maintain program records.' },
      { label: 'Safety', detail: 'To make health and emergency contact information available to authorized TYT staff during program activities.' },
      { label: 'Communication', detail: 'To send you program updates, payment reminders, and important announcements related to your registration. We do not send unsolicited marketing email.' },
      { label: 'Financial records', detail: 'To process payments, issue invoices, and maintain accounting records as required by law.' },
      { label: 'Portal improvement', detail: 'Aggregated, anonymized usage data may be used to improve portal functionality.' },
    ],
  },
  {
    title: '4. How We Share Your Information',
    body: `TYT does not sell, rent, or trade your personal information to third parties. We share information only in the following limited circumstances:`,
    items: [
      { label: 'Service providers', detail: 'We use Stripe for payment processing, Supabase for secure data storage, and Resend for transactional email delivery. Each operates under its own privacy policy and is contractually prohibited from using your data for purposes other than providing their service.' },
      { label: 'Legal requirements', detail: 'We may disclose information if required to do so by law or in response to a valid legal process.' },
      { label: 'Safety emergencies', detail: 'In a medical or safety emergency, relevant health and contact information may be shared with emergency responders.' },
    ],
  },
  {
    title: '5. Data Retention',
    body: `We retain your account and registration information for as long as your family account is active and for a reasonable period thereafter to comply with legal obligations and resolve disputes. Health records associated with a completed program season are retained for three years and then deleted or anonymized. You may request deletion of your account at any time (see Section 7).`,
  },
  {
    title: '6. Data Security',
    body: `We implement industry-standard security measures including encrypted connections (HTTPS/TLS), role-based access controls, and row-level security in our database to protect your information. No method of transmission over the internet is 100% secure, and we cannot guarantee absolute security. We encourage you to use a strong, unique password and to log out when using shared devices.`,
  },
  {
    title: '7. Your Rights & Choices',
    items: [
      { label: 'Access & correction', detail: 'You may view and update your family information, contact details, and participant profiles at any time through the Family Portal dashboard.' },
      { label: 'Account deletion', detail: 'To request deletion of your account and associated personal data, email info@triboroyouththeatre.org. Note that we may retain certain records required by law or for legitimate business purposes.' },
      { label: 'Email opt-out', detail: 'You may opt out of non-essential communications by contacting us. Transactional emails related to active registrations (payment receipts, program confirmations) cannot be disabled while a registration is in progress.' },
    ],
  },
  {
    title: '8. Children\'s Privacy',
    body: `This portal is operated by and for parents and guardians. We do not knowingly create accounts for individuals under 18. Participant information (names, dates of birth, health data) is collected about minors but is provided to us by a parent or legal guardian who accepts responsibility for its accuracy. We handle all minor participant data with heightened care and it is never used for advertising or shared with third parties beyond what is described in this policy.`,
  },
  {
    title: '9. Cookies & Tracking',
    body: `This portal uses session cookies strictly necessary for authentication and security. We do not use third-party advertising cookies, behavioral tracking, or analytics services that share data with outside parties. You can configure your browser to refuse cookies, but doing so will prevent you from logging in to the portal.`,
  },
  {
    title: '10. Changes to This Policy',
    body: `We may update this Privacy Policy periodically. We will notify registered families of material changes via email at least 14 days before they take effect. The "Last updated" date at the top of this page reflects the most recent revision.`,
  },
  {
    title: '11. Contact Us',
    body: `If you have questions, concerns, or requests regarding this Privacy Policy or the handling of your personal information, please contact Triboro Youth Theatre at info@triboroyouththeatre.org.`,
  },
];

export default function PrivacyPage() {
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
            Privacy Policy
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
            Triboro Youth Theatre is committed to protecting the privacy of the families
            and participants who use this portal. This policy explains what information
            we collect, how we use it, and your rights regarding your data.
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

              {section.body && (
                <p style={{
                  fontFamily: 'var(--font-body)',
                  color: 'var(--text-muted)',
                  fontSize: '0.92rem',
                  lineHeight: 1.8,
                  marginBottom: section.items ? '0.75rem' : 0,
                }}>
                  {section.body}
                </p>
              )}

              {section.items && (
                <ul style={{
                  listStyle: 'none',
                  padding: 0,
                  margin: 0,
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '0.6rem',
                }}>
                  {section.items.map((item, j) => (
                    <li key={j} style={{
                      fontFamily: 'var(--font-body)',
                      fontSize: '0.92rem',
                      lineHeight: 1.75,
                      color: 'var(--text-muted)',
                      paddingLeft: '1rem',
                      borderLeft: '2px solid var(--border)',
                    }}>
                      <strong style={{
                        color: 'var(--text-primary)',
                        fontWeight: 600,
                      }}>
                        {item.label}:
                      </strong>{' '}
                      {item.detail}
                    </li>
                  ))}
                </ul>
              )}
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
          <Link href="/terms" style={{
            fontFamily: 'var(--font-body)',
            color: 'var(--text-muted)',
            fontSize: '0.85rem',
          }}>
            Terms of Service →
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