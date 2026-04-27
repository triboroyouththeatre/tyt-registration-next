import Image from 'next/image';

export default function ConfirmSuccessPage() {
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
        <div style={{ fontSize: '3rem', marginBottom: '1rem' }}>✓</div>
        <h1 style={{
          fontFamily: 'var(--font-display)',
          fontSize: '1.8rem',
          fontWeight: 800,
          letterSpacing: '0.08em',
          textTransform: 'uppercase',
          color: 'var(--gold)',
          marginBottom: '0.5rem',
        }}>
          Email Confirmed!
        </h1>
        <p style={{
          fontFamily: 'var(--font-accent)',
          fontStyle: 'italic',
          color: 'var(--text-muted)',
          marginBottom: '1.5rem',
        }}>
          Your account is ready. Please sign in to continue.
        </p>
        <a href="/login" className="tyt-btn tyt-btn-primary" style={{ display: 'inline-flex' }}>
          Sign In
        </a>
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