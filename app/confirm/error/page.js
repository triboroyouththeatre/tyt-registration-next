import Image from 'next/image';

export default function ConfirmErrorPage() {
  return (
    <main style={{
      minHeight: '100vh',
      background: 'var(--bg-dark)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      padding: '1.5rem',
    }}>
      <div style={{ width: '100%', maxWidth: '440px', textAlign: 'center' }}>
        <Image
          src="/images/tyt-logo.png"
          alt="Triboro Youth Theatre"
          width={160}
          height={160}
          style={{ objectFit: 'contain', marginBottom: '1.5rem' }}
          priority
        />
        <div style={{ fontSize: '3rem', marginBottom: '1rem' }}>✗</div>
        <h1 style={{
          fontFamily: 'var(--font-display)',
          fontSize: '1.8rem',
          fontWeight: 800,
          letterSpacing: '0.08em',
          textTransform: 'uppercase',
          color: 'var(--red)',
          marginBottom: '0.5rem',
        }}>
          Link Expired
        </h1>
        <p style={{
          fontFamily: 'var(--font-accent)',
          fontStyle: 'italic',
          color: 'var(--text-muted)',
          marginBottom: '1.5rem',
        }}>
          This confirmation link is invalid or has expired.
          Please sign up again or request a new link.
        </p>
        <div style={{ display: 'flex', gap: '1rem', justifyContent: 'center', flexWrap: 'wrap' }}>
          <a href="/signup" className="tyt-btn tyt-btn-primary">Sign Up Again</a>
          <a href="/login" className="tyt-btn tyt-btn-secondary">Back to Login</a>
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