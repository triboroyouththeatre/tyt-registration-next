'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';

function fmtDate(str) {
  if (!str) return '—';
  return new Date(str).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

function fmtDateTime(str) {
  if (!str) return '—';
  return new Date(str).toLocaleDateString('en-US', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' });
}

function StatusBadge({ label, color, bg }) {
  return (
    <span style={{
      fontFamily: 'var(--font-display)', fontSize: '0.65rem', fontWeight: 600,
      letterSpacing: '0.06em', textTransform: 'uppercase',
      color, background: bg,
      border: `1px solid ${color}30`,
      borderRadius: '3px', padding: '0.2rem 0.5rem',
      whiteSpace: 'nowrap',
    }}>
      {label}
    </span>
  );
}

const STATUS_BADGE = {
  waiting:   { label: 'Waiting',   color: '#6b7280', bg: '#f9fafb' },
  offered:   { label: 'Offered',   color: '#7c3aed', bg: '#f5f3ff' },
  accepted:  { label: 'Accepted',  color: '#16a34a', bg: '#f0fdf4' },
  cancelled: { label: 'Cancelled', color: '#b40000', bg: '#fff5f5' },
};

const sectionStyle = {
  background: '#fff',
  border: '1px solid #e5e7eb',
  borderRadius: '8px',
  marginBottom: '1.25rem',
  overflow: 'hidden',
};

const sectionHeaderStyle = {
  padding: '0.875rem 1.25rem',
  borderBottom: '1px solid #e5e7eb',
  background: '#fafafa',
  display: 'flex',
  justifyContent: 'space-between',
  alignItems: 'center',
};

const sectionTitleStyle = {
  fontFamily: 'var(--font-display)',
  fontSize: '0.75rem',
  fontWeight: 700,
  letterSpacing: '0.1em',
  textTransform: 'uppercase',
  color: '#111',
  margin: 0,
};

const thStyle = {
  padding: '0.625rem 1rem',
  fontFamily: 'var(--font-display)',
  fontSize: '0.65rem',
  fontWeight: 600,
  letterSpacing: '0.1em',
  textTransform: 'uppercase',
  color: '#6b7280',
  background: '#f9fafb',
  borderBottom: '1px solid #e5e7eb',
  textAlign: 'left',
  whiteSpace: 'nowrap',
};

const tdStyle = {
  padding: '0.75rem 1rem',
  fontFamily: 'var(--font-body)',
  fontSize: '0.85rem',
  color: '#374151',
};

const btnStyle = {
  fontFamily: 'var(--font-display)', fontSize: '0.65rem', fontWeight: 700,
  letterSpacing: '0.08em', textTransform: 'uppercase',
  textDecoration: 'none', borderRadius: '4px',
  padding: '0.35rem 0.75rem', cursor: 'pointer', border: 'none',
};

const btnGold = {
  ...btnStyle, background: '#e0bf5c', color: '#111',
};
const btnGoldOutline = {
  ...btnStyle, background: '#fff', color: '#7c3aed', border: '1px solid #d8b4fe',
};
const btnRedOutline = {
  ...btnStyle, background: '#fff', color: '#b40000', border: '1px solid #fecaca',
};
const btnGray = {
  ...btnStyle, background: '#fff', color: '#6b7280', border: '1px solid #e5e7eb',
};
const btnRedSolid = {
  ...btnStyle, background: '#b40000', color: '#fff',
};

export default function WaitlistManager({ programId, entries }) {
  const router = useRouter();
  const [confirmModal, setConfirmModal] = useState(null);
  // confirmModal shape: { action: 'offer' | 'withdraw' | 'cancel', entry, busy: boolean, error: string }

  const waiting = entries.filter(e => e.status === 'waiting');
  const offered = entries.filter(e => e.status === 'offered');
  const accepted = entries.filter(e => e.status === 'accepted');
  const cancelled = entries.filter(e => e.status === 'cancelled');

  // Show waiting + offered as the active list. Accepted/cancelled get a smaller secondary list.
  const active = [...offered, ...waiting];

  function participantName(p) {
    if (!p) return '';
    return p.nickname ? `${p.nickname} ${p.last_name}` : `${p.first_name} ${p.last_name}`;
  }

  function openConfirm(action, entry) {
    if (action === 'withdraw') {
      // Withdraw is silent / no email — go straight to API
      runAction(action, entry);
      return;
    }
    setConfirmModal({ action, entry, busy: false, error: '' });
  }

  async function runAction(action, entry) {
    if (confirmModal) setConfirmModal(c => ({ ...c, busy: true, error: '' }));

    try {
      const res = await fetch('/api/waitlist-action', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ waitlistId: entry.id, action }),
      });
      const data = await res.json();
      if (!res.ok) {
        if (confirmModal) {
          setConfirmModal(c => ({ ...c, busy: false, error: data.error || 'Action failed.' }));
        }
        return;
      }
      setConfirmModal(null);
      router.refresh();
    } catch (err) {
      if (confirmModal) {
        setConfirmModal(c => ({ ...c, busy: false, error: 'Unexpected error.' }));
      }
    }
  }

  return (
    <>
      <div style={sectionStyle}>
        <div style={sectionHeaderStyle}>
          <h2 style={sectionTitleStyle}>Waitlist · {active.length}</h2>
          {accepted.length > 0 || cancelled.length > 0 ? (
            <span style={{ fontFamily: 'var(--font-body)', fontSize: '0.75rem', color: '#9ca3af' }}>
              {accepted.length} accepted · {cancelled.length} cancelled
            </span>
          ) : null}
        </div>

        {active.length === 0 ? (
          <p style={{ padding: '2rem', textAlign: 'center', fontFamily: 'var(--font-body)', color: '#9ca3af', fontStyle: 'italic', margin: 0 }}>
            No active waitlist entries.
          </p>
        ) : (
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr>
                <th style={thStyle}>Participant</th>
                <th style={thStyle}>Family Email</th>
                <th style={thStyle}>Status</th>
                <th style={thStyle}>Joined</th>
                <th style={thStyle}>Offered At</th>
                <th style={thStyle}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {active.map((entry, i) => {
                const p = entry.participants;
                const pName = participantName(p);
                const badge = STATUS_BADGE[entry.status] || STATUS_BADGE.waiting;
                return (
                  <tr key={entry.id} style={{ background: i % 2 === 0 ? '#fff' : '#fafafa', borderBottom: '1px solid #f3f4f6' }}>
                    <td style={tdStyle}>
                      <p style={{ margin: 0, fontWeight: 600, color: '#111' }}>{pName}</p>
                      {p?.yog && <p style={{ margin: 0, fontSize: '0.75rem', color: '#9ca3af' }}>Class of {p.yog}</p>}
                    </td>
                    <td style={tdStyle}>
                      {entry.families?.email || '—'}
                    </td>
                    <td style={tdStyle}>
                      <StatusBadge label={badge.label} color={badge.color} bg={badge.bg} />
                    </td>
                    <td style={tdStyle}>{fmtDate(entry.created_at)}</td>
                    <td style={tdStyle}>{entry.notified_at ? fmtDateTime(entry.notified_at) : '—'}</td>
                    <td style={tdStyle}>
                      <div style={{ display: 'flex', gap: '0.4rem', flexWrap: 'wrap' }}>
                        {entry.status === 'waiting' && (
                          <>
                            <button onClick={() => openConfirm('offer', entry)} style={btnGold}>Offer Spot</button>
                            <button onClick={() => openConfirm('cancel', entry)} style={btnRedOutline}>Remove</button>
                          </>
                        )}
                        {entry.status === 'offered' && (
                          <>
                            <button onClick={() => openConfirm('withdraw', entry)} style={btnGoldOutline}>Withdraw Offer</button>
                            <button onClick={() => openConfirm('cancel', entry)} style={btnRedOutline}>Remove</button>
                          </>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>

      {/* Accepted + cancelled (history) */}
      {(accepted.length > 0 || cancelled.length > 0) && (
        <details style={{ ...sectionStyle }}>
          <summary style={{ ...sectionHeaderStyle, cursor: 'pointer', listStyle: 'none' }}>
            <h2 style={sectionTitleStyle}>Waitlist History · {accepted.length + cancelled.length}</h2>
            <span style={{ fontFamily: 'var(--font-body)', fontSize: '0.75rem', color: '#9ca3af' }}>Click to expand</span>
          </summary>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr>
                <th style={thStyle}>Participant</th>
                <th style={thStyle}>Status</th>
                <th style={thStyle}>Joined</th>
              </tr>
            </thead>
            <tbody>
              {[...accepted, ...cancelled].map((entry, i) => {
                const p = entry.participants;
                const pName = participantName(p);
                const badge = STATUS_BADGE[entry.status];
                return (
                  <tr key={entry.id} style={{ background: i % 2 === 0 ? '#fff' : '#fafafa', borderBottom: '1px solid #f3f4f6', opacity: 0.7 }}>
                    <td style={tdStyle}>{pName}</td>
                    <td style={tdStyle}><StatusBadge label={badge.label} color={badge.color} bg={badge.bg} /></td>
                    <td style={tdStyle}>{fmtDate(entry.created_at)}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </details>
      )}

      {/* Confirm modal */}
      {confirmModal && (
        <ConfirmModal
          action={confirmModal.action}
          entry={confirmModal.entry}
          busy={confirmModal.busy}
          error={confirmModal.error}
          onCancel={() => setConfirmModal(null)}
          onConfirm={() => runAction(confirmModal.action, confirmModal.entry)}
          participantName={participantName(confirmModal.entry?.participants)}
          familyEmail={confirmModal.entry?.families?.email}
        />
      )}
    </>
  );
}

function ConfirmModal({ action, busy, error, onCancel, onConfirm, participantName, familyEmail }) {
  const config = {
    offer: {
      title: 'Offer this spot?',
      body: (
        <>
          An email will be sent to <strong>{familyEmail || 'the family'}</strong> with a registration link for <strong>{participantName}</strong>.
          <br /><br />
          This action sends an immediate email and cannot be silently undone.
        </>
      ),
      confirmLabel: 'Send Offer',
      confirmStyle: btnGold,
    },
    cancel: {
      title: 'Remove from waitlist?',
      body: (
        <>
          <strong>{participantName}</strong> will be removed from the waitlist.
          <br /><br />
          No email will be sent. The family will need to rejoin the waitlist if they want to be added back.
        </>
      ),
      confirmLabel: 'Remove',
      confirmStyle: btnRedSolid,
    },
  }[action];

  if (!config) return null;

  return (
    <div style={{
      position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      zIndex: 1000, padding: '1rem',
    }}>
      <div style={{
        background: '#fff', borderRadius: '8px', maxWidth: '440px', width: '100%',
        padding: '1.5rem', boxShadow: '0 20px 50px rgba(0,0,0,0.3)',
      }}>
        <h3 style={{
          fontFamily: 'var(--font-display)', fontSize: '1rem', fontWeight: 700,
          letterSpacing: '0.04em', textTransform: 'uppercase', color: '#111',
          margin: 0, marginBottom: '0.75rem',
        }}>
          {config.title}
        </h3>
        <p style={{
          fontFamily: 'var(--font-body)', fontSize: '0.9rem', color: '#374151',
          lineHeight: 1.5, margin: 0, marginBottom: '1.25rem',
        }}>
          {config.body}
        </p>

        {error && (
          <div style={{
            background: '#fff5f5', border: '1px solid #fecaca', color: '#b40000',
            padding: '0.6rem 0.875rem', borderRadius: '4px',
            fontFamily: 'var(--font-body)', fontSize: '0.8rem',
            marginBottom: '1rem',
          }}>
            {error}
          </div>
        )}

        <div style={{ display: 'flex', gap: '0.5rem', justifyContent: 'flex-end' }}>
          <button onClick={onCancel} disabled={busy} style={btnGray}>Cancel</button>
          <button onClick={onConfirm} disabled={busy} style={{ ...config.confirmStyle, opacity: busy ? 0.7 : 1 }}>
            {busy ? 'Working...' : config.confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}