/**
 * Format a 10-digit phone string as (xxx) xxx-xxxx.
 * Returns the raw value unchanged if it isn't exactly 10 digits,
 * so stored data that pre-dates the validation rule still renders safely.
 */
export function fmtPhone(p) {
  if (!p) return '—';
  const d = String(p).replace(/\D/g, '');
  if (d.length !== 10) return p;
  return `(${d.slice(0, 3)}) ${d.slice(3, 6)}-${d.slice(6)}`;
}
