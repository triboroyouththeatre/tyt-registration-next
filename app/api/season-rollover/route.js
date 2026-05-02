import { createClient } from '@/lib/supabase/server';
import { createClient as createAdminClient } from '@supabase/supabase-js';

// Grade level labels indexed by grade number (0 = Kindergarten, 12 = 12th Grade)
const GRADE_LABELS = [
  'Kindergarten',
  '1st Grade',
  '2nd Grade',
  '3rd Grade',
  '4th Grade',
  '5th Grade',
  '6th Grade',
  '7th Grade',
  '8th Grade',
  '9th Grade',
  '10th Grade',
  '11th Grade',
  '12th Grade',
];

export async function POST(request) {
  try {
    // Verify admin
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return Response.json({ error: 'Not authenticated' }, { status: 401 });
    const { data: profile } = await supabase.from('profiles').select('role').eq('id', user.id).single();
    if (profile?.role !== 'admin') return Response.json({ error: 'Not authorized' }, { status: 403 });

    const { action } = await request.json();
    if (!action || !['preview', 'execute'].includes(action)) {
      return Response.json({ error: 'Invalid action' }, { status: 400 });
    }

    const admin = createAdminClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL,
      process.env.SUPABASE_SERVICE_ROLE_KEY
    );

    // ── Find the current active season ────────────────────────────────────────
    const { data: activeSeason } = await admin
      .from('seasons')
      .select('id, name, display_name, start_date, end_date')
      .eq('is_active', true)
      .single();

    if (!activeSeason) {
      return Response.json({ error: 'No active season found.' }, { status: 400 });
    }

    // Derive new season values
    const currentYear = parseInt(activeSeason.name, 10);
    if (isNaN(currentYear)) {
      return Response.json({ error: `Cannot parse season year from "${activeSeason.name}".` }, { status: 400 });
    }

    const newYear = currentYear + 1;
    const newName = String(newYear);
    const newDisplayName = `${newYear - 1}-${newYear}`;
    // Operational cycle: Sep 1 → Aug 31 regardless of when rollover runs
    const newStartDate = `${newYear - 1}-09-01`;
    const newEndDate   = `${newYear}-08-31`;

    // ── Check new season doesn't already exist ─────────────────────────────
    const { data: existing } = await admin
      .from('seasons')
      .select('id')
      .eq('name', newName)
      .maybeSingle();

    if (existing) {
      return Response.json({
        error: `Season "${newName}" (${newDisplayName}) already exists. The rollover may have already been run.`,
      }, { status: 400 });
    }

    // ── Count things that will be affected ────────────────────────────────
    // Graduating participants (yog = current year)
    const { count: graduatingCount } = await admin
      .from('participants')
      .select('id', { count: 'exact', head: true })
      .eq('yog', currentYear)
      .eq('is_active', true);

    // Waitlist entries tied to programs in the current season
    // (via programs → sessions → seasons)
    const { data: currentSessionIds } = await admin
      .from('sessions')
      .select('id')
      .eq('season_id', activeSeason.id);

    const sessionIdList = (currentSessionIds || []).map(s => s.id);

    let waitlistCount = 0;
    if (sessionIdList.length > 0) {
      const { data: currentProgramIds } = await admin
        .from('programs')
        .select('id')
        .in('session_id', sessionIdList);

      const programIdList = (currentProgramIds || []).map(p => p.id);

      if (programIdList.length > 0) {
        const { count } = await admin
          .from('waitlist')
          .select('id', { count: 'exact', head: true })
          .in('program_id', programIdList)
          .in('status', ['waiting', 'offered']);
        waitlistCount = count || 0;
      }
    }

    // ── PREVIEW — return counts only, no writes ────────────────────────────
    if (action === 'preview') {
      return Response.json({
        preview: true,
        currentSeason:    { name: activeSeason.name, displayName: activeSeason.display_name },
        newSeason:        { name: newName, displayName: newDisplayName, startDate: newStartDate, endDate: newEndDate },
        graduatingCount:  graduatingCount || 0,
        waitlistCount,
        gradeLevelsCount: 13,
      });
    }

    // ── EXECUTE — perform the rollover atomically ──────────────────────────

    // 1. Create new season (not yet active)
    const { data: newSeason, error: seasonErr } = await admin
      .from('seasons')
      .insert({
        name:         newName,
        display_name: newDisplayName,
        start_date:   newStartDate,
        end_date:     newEndDate,
        is_active:    false,
      })
      .select('id')
      .single();
    if (seasonErr) throw new Error('Failed to create new season: ' + seasonErr.message);

    // 2. Insert 13 grade levels for the new season
    // Grade 12 = yog of newYear, Grade 0 (K) = yog of newYear + 12
    const gradeLevelsToInsert = GRADE_LABELS.map((label, gradeIndex) => ({
      season_id: newSeason.id,
      yog:       newYear + (12 - gradeIndex), // grade 12 → yog = newYear, grade 0 → yog = newYear + 12
      label,
    }));
    const { error: glErr } = await admin.from('grade_levels').insert(gradeLevelsToInsert);
    if (glErr) throw new Error('Failed to insert grade levels: ' + glErr.message);

    // 3. Mark graduating participants inactive
    if (graduatingCount > 0) {
      const { error: partErr } = await admin
        .from('participants')
        .update({ is_active: false })
        .eq('yog', currentYear)
        .eq('is_active', true);
      if (partErr) throw new Error('Failed to mark graduates inactive: ' + partErr.message);
    }

    // 4. Wipe active waitlist entries for current season's programs
    if (sessionIdList.length > 0) {
      const { data: currentProgramIds } = await admin
        .from('programs')
        .select('id')
        .in('session_id', sessionIdList);

      const programIdList = (currentProgramIds || []).map(p => p.id);

      if (programIdList.length > 0) {
        const { error: wlErr } = await admin
          .from('waitlist')
          .delete()
          .in('program_id', programIdList)
          .in('status', ['waiting', 'offered']);
        if (wlErr) throw new Error('Failed to clear waitlists: ' + wlErr.message);
      }
    }

    // 5. Flip seasons — deactivate old, activate new
    const { error: deactivateErr } = await admin
      .from('seasons')
      .update({ is_active: false })
      .eq('id', activeSeason.id);
    if (deactivateErr) throw new Error('Failed to deactivate old season: ' + deactivateErr.message);

    const { error: activateErr } = await admin
      .from('seasons')
      .update({ is_active: true })
      .eq('id', newSeason.id);
    if (activateErr) throw new Error('Failed to activate new season: ' + activateErr.message);

    return Response.json({
      success: true,
      newSeason:       { name: newName, displayName: newDisplayName },
      graduatingCount: graduatingCount || 0,
      waitlistCount,
    });

  } catch (err) {
    console.error('[season-rollover] error:', err);
    return Response.json({ error: err.message }, { status: 500 });
  }
}