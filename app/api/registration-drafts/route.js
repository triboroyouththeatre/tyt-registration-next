import { createClient } from '@/lib/supabase/server';
import { createClient as createAdminClient } from '@supabase/supabase-js';
import { NextResponse } from 'next/server';

/**
 * Server-side wizard scratch space.
 *
 * GET    /api/registration-drafts?programId=X&participantId=Y
 *          → 200 { draft: {...} } or { draft: null }
 *
 * GET    /api/registration-drafts?programId=X
 *          → 200 { drafts: [...] }   (full cart for the program)
 *
 * PUT    /api/registration-drafts
 *          body: { programId, participantId, current_step, health_data?, agreements_data?, waitlist_token?, financial_aid? }
 *          → 200 { draft: {...} }
 *
 * DELETE /api/registration-drafts?programId=X&participantId=Y
 *          → 200 { deleted: true }
 *
 * All routes require an authenticated user with a family_id. Drafts are
 * scoped to that family — RLS plus an explicit family_id filter on every
 * query (defense in depth, since we use the admin client for writes).
 */

async function authenticate() {
  const supabase = await createClient();
  const { data: { user }, error: userErr } = await supabase.auth.getUser();
  if (userErr || !user) {
    return { error: NextResponse.json({ error: 'Not authenticated' }, { status: 401 }) };
  }

  const { data: profile } = await supabase
    .from('profiles').select('family_id').eq('id', user.id).single();
  const familyId = profile?.family_id;
  if (!familyId) {
    return { error: NextResponse.json({ error: 'No family found' }, { status: 400 }) };
  }

  return { familyId };
}

function adminClient() {
  return createAdminClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY,
    { auth: { autoRefreshToken: false, persistSession: false } }
  );
}

// ─── GET ──────────────────────────────────────────────────────────────────
export async function GET(request) {
  const auth = await authenticate();
  if (auth.error) return auth.error;
  const { familyId } = auth;

  const url = new URL(request.url);
  const programId     = url.searchParams.get('programId');
  const participantId = url.searchParams.get('participantId');

  if (!programId) {
    return NextResponse.json({ error: 'programId is required' }, { status: 400 });
  }

  const admin = adminClient();

  // Single-draft fetch — used by the wizard pages on mount
  if (participantId) {
    const { data, error } = await admin
      .from('registration_drafts')
      .select('*')
      .eq('family_id', familyId)
      .eq('program_id', programId)
      .eq('participant_id', participantId)
      .maybeSingle();

    if (error) {
      console.error('[drafts GET single]', error);
      return NextResponse.json({ error: 'Lookup failed' }, { status: 500 });
    }
    return NextResponse.json({ draft: data || null });
  }

  // Cart fetch — all drafts for this family + program
  const { data, error } = await admin
    .from('registration_drafts')
    .select('*')
    .eq('family_id', familyId)
    .eq('program_id', programId)
    .order('created_at', { ascending: true });

  if (error) {
    console.error('[drafts GET cart]', error);
    return NextResponse.json({ error: 'Lookup failed' }, { status: 500 });
  }
  return NextResponse.json({ drafts: data || [] });
}

// ─── PUT (upsert) ─────────────────────────────────────────────────────────
export async function PUT(request) {
  const auth = await authenticate();
  if (auth.error) return auth.error;
  const { familyId } = auth;

  const body = await request.json();
  const {
    programId,
    participantId,
    current_step,
    health_data,
    agreements_data,
    waitlist_token,
    financial_aid,
  } = body;

  if (!programId || !participantId) {
    return NextResponse.json(
      { error: 'programId and participantId are required' },
      { status: 400 }
    );
  }

  // Verify the participant actually belongs to this family before writing.
  // RLS would catch this on a regular client, but we use the admin client
  // for the write itself (so we can rely on the unique-constraint upsert),
  // which means we have to check ownership ourselves.
  const admin = adminClient();
  const { data: pcheck } = await admin
    .from('participants')
    .select('family_id')
    .eq('id', participantId)
    .single();
  if (!pcheck || pcheck.family_id !== familyId) {
    return NextResponse.json({ error: 'Participant not in your family' }, { status: 403 });
  }

  // Build the upsert payload. Only include fields the client actually sent
  // — undefined values would otherwise overwrite existing data with null.
  const payload = {
    family_id:      familyId,
    program_id:     programId,
    participant_id: participantId,
  };
  if (current_step    !== undefined) payload.current_step    = current_step;
  if (health_data     !== undefined) payload.health_data     = health_data;
  if (agreements_data !== undefined) payload.agreements_data = agreements_data;
  if (waitlist_token  !== undefined) payload.waitlist_token  = waitlist_token;
  if (financial_aid   !== undefined) payload.financial_aid   = financial_aid;

  const { data, error } = await admin
    .from('registration_drafts')
    .upsert(payload, { onConflict: 'family_id,program_id,participant_id' })
    .select('*')
    .single();

  if (error) {
    console.error('[drafts PUT]', error);
    return NextResponse.json({ error: 'Save failed' }, { status: 500 });
  }
  return NextResponse.json({ draft: data });
}

// ─── DELETE ───────────────────────────────────────────────────────────────
export async function DELETE(request) {
  const auth = await authenticate();
  if (auth.error) return auth.error;
  const { familyId } = auth;

  const url = new URL(request.url);
  const programId     = url.searchParams.get('programId');
  const participantId = url.searchParams.get('participantId');

  if (!programId) {
    return NextResponse.json({ error: 'programId is required' }, { status: 400 });
  }

  const admin = adminClient();

  // Build the delete query. If participantId is omitted, we delete all
  // drafts for this family+program (used after successful payment).
  let query = admin
    .from('registration_drafts')
    .delete()
    .eq('family_id', familyId)
    .eq('program_id', programId);

  if (participantId) {
    query = query.eq('participant_id', participantId);
  }

  const { error } = await query;

  if (error) {
    console.error('[drafts DELETE]', error);
    return NextResponse.json({ error: 'Delete failed' }, { status: 500 });
  }
  return NextResponse.json({ deleted: true });
}