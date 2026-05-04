import { createClient } from '@supabase/supabase-js';

const admin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

/**
 * Delete registration drafts that haven't been touched in 30 days.
 *
 * Drafts are normally consumed when payment succeeds in /api/save-registration.
 * Anything still sitting in this table after 30 days is an abandoned wizard
 * — not worth keeping around, and the JSONB blobs add up over time.
 */
export async function GET(request) {
  // Verify request is from Vercel cron
  const authHeader = request.headers.get('authorization');
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return Response.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const cutoff = new Date();
    cutoff.setDate(cutoff.getDate() - 30);

    const { data, error } = await admin
      .from('registration_drafts')
      .delete()
      .lt('updated_at', cutoff.toISOString())
      .select('id');

    if (error) {
      console.error('[cleanup-drafts] error:', error);
      return Response.json({ error: error.message }, { status: 500 });
    }

    const count = data?.length || 0;
    console.log(`[cleanup-drafts] deleted ${count} drafts older than ${cutoff.toISOString()}`);
    return Response.json({ deleted: count });
  } catch (err) {
    console.error('[cleanup-drafts] unexpected error:', err);
    return Response.json({ error: 'Server error' }, { status: 500 });
  }
}