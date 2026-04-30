import { createClient } from '@supabase/supabase-js';

const admin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

export async function GET(request) {
  const authHeader = request.headers.get('authorization');
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return Response.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const now = new Date().toISOString();
    let opened = 0;
    let closed = 0;

    // Auto-open programs whose open time has passed and are still closed
    const { data: toOpen } = await admin
      .from('programs')
      .select('id, label')
      .eq('is_registration_open', false)
      .not('registration_opens_at', 'is', null)
      .lte('registration_opens_at', now)
      .or('registration_closes_at.is.null,registration_closes_at.gt.' + now);

    if (toOpen?.length) {
      await admin
        .from('programs')
        .update({ is_registration_open: true })
        .in('id', toOpen.map(p => p.id));
      opened = toOpen.length;
      console.log(`[registration-schedule] Opened ${opened} program(s):`, toOpen.map(p => p.label));
    }

    // Auto-close programs whose close time has passed and are still open
    const { data: toClose } = await admin
      .from('programs')
      .select('id, label')
      .eq('is_registration_open', true)
      .not('registration_closes_at', 'is', null)
      .lte('registration_closes_at', now);

    if (toClose?.length) {
      await admin
        .from('programs')
        .update({ is_registration_open: false })
        .in('id', toClose.map(p => p.id));
      closed = toClose.length;
      console.log(`[registration-schedule] Closed ${closed} program(s):`, toClose.map(p => p.label));
    }

    return Response.json({
      success: true,
      opened,
      closed,
      message: `Opened ${opened}, closed ${closed} program(s).`,
    });

  } catch (err) {
    console.error('[registration-schedule] error:', err.message);
    return Response.json({ error: err.message }, { status: 500 });
  }
}