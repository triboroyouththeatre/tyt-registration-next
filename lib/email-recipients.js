/**
 * Fetch all email recipients for a family — primary contact (priority 1)
 * plus secondary contact (priority 2) if one exists. Used by every
 * automated email site so both parents stay in the loop.
 *
 * Returns an array suitable for passing directly to Resend's `to` field.
 * Resend accepts either a string or an array of strings.
 *
 * Falls back gracefully:
 *   - If no contacts exist, returns an empty array (caller should check)
 *   - If only priority 1 exists, returns just that one
 *   - Filters out null/empty emails so a contact missing an email doesn't
 *     break the send
 *
 * Pass an admin (service-role) Supabase client. RLS would otherwise scope
 * the query to the calling user, which usually isn't what we want from
 * server-side email routes.
 */
export async function getFamilyRecipients(adminClient, familyId) {
  const { data: contacts, error } = await adminClient
    .from('contacts')
    .select('email, priority')
    .eq('family_id', familyId)
    .in('priority', [1, 2])
    .order('priority');

  if (error) {
    console.error('[getFamilyRecipients] lookup failed:', error.message);
    return [];
  }

  return (contacts || [])
    .map(c => c.email?.trim())
    .filter(Boolean);
}