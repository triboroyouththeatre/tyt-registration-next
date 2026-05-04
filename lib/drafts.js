/**
 * Client-side wrapper around /api/registration-drafts.
 *
 * Used by the wizard pages to read/write server-side draft state instead
 * of sessionStorage. All wizard pages should funnel through these so the
 * URL paths and request shapes are consistent.
 */

export async function fetchDraft(programId, participantId) {
  const res = await fetch(
    `/api/registration-drafts?programId=${encodeURIComponent(programId)}&participantId=${encodeURIComponent(participantId)}`,
    { method: 'GET' }
  );
  if (!res.ok) return null;
  const data = await res.json();
  return data.draft;
}

export async function fetchCart(programId) {
  const res = await fetch(
    `/api/registration-drafts?programId=${encodeURIComponent(programId)}`,
    { method: 'GET' }
  );
  if (!res.ok) return [];
  const data = await res.json();
  return data.drafts || [];
}

export async function saveDraft(payload) {
  const res = await fetch('/api/registration-drafts', {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    throw new Error(data.error || 'Failed to save draft');
  }
  const data = await res.json();
  return data.draft;
}

export async function deleteDraft(programId, participantId) {
  const params = new URLSearchParams({ programId });
  if (participantId) params.set('participantId', participantId);
  const res = await fetch(`/api/registration-drafts?${params.toString()}`, {
    method: 'DELETE',
  });
  return res.ok;
}