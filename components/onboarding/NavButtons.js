'use client';

export default function NavButtons({ onBack, saving, submitLabel = 'Continue →', showBack = true }) {
  return (
    <div style={{ display: 'flex', gap: '1rem', marginTop: '0.5rem' }}>
      {showBack && (
        <button type="button" onClick={onBack} className="tyt-btn tyt-btn-secondary" style={{ flex: 1 }}>
          ← Back
        </button>
      )}
      <button type="submit" disabled={saving} className="tyt-btn tyt-btn-primary" style={{ flex: showBack ? 1 : undefined, width: showBack ? undefined : '100%' }}>
        {saving ? 'Saving...' : submitLabel}
      </button>
    </div>
  );
}
