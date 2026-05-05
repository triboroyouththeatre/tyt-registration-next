import { createClient } from '@/lib/supabase/server';
import { createClient as createAdminClient } from '@supabase/supabase-js';
import { NextResponse } from 'next/server';

export async function POST(request) {
  try {
    const { email, password, emailRedirectTo } = await request.json();

    // ── Basic validation ─────────────────────────────────────────────────
    if (!email || !password) {
      return NextResponse.json(
        { error: 'Email and password are required.' },
        { status: 400 }
      );
    }
    if (password.length < 8) {
      return NextResponse.json(
        { error: 'Password must be at least 8 characters.' },
        { status: 400 }
      );
    }

    // ── Pre-check: does an account already exist for this email? ─────────
    // We use the service-role admin client to look up users in auth.users
    // by email. This bypasses Supabase's user-enumeration protection on
    // signUp(), which silently succeeds for already-registered emails and
    // would otherwise leave the family staring at "check your email" forever.
    //
    // Guard: if SUPABASE_SERVICE_ROLE_KEY is not configured, skip the
    // pre-check and fall through to signUp() rather than crashing. The
    // key is required — add it to your Vercel env vars.
    const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
    if (!serviceRoleKey) {
      console.error('[signup] SUPABASE_SERVICE_ROLE_KEY is not set — skipping duplicate email pre-check');
    }

    const normalizedEmail = email.trim().toLowerCase();

    if (serviceRoleKey) {
      const admin = createAdminClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL,
        serviceRoleKey,
        { auth: { autoRefreshToken: false, persistSession: false } }
      );

      // listUsers supports a filter param for server-side narrowing, but we
      // do an exact client-side match to avoid false positives on partial hits.
      const { data: listData, error: lookupErr } = await admin.auth.admin.listUsers({
        filter: normalizedEmail,
        page: 1,
        perPage: 10,
      });

      if (lookupErr) {
        // Unexpected error — log and fall through rather than blocking signups entirely
        console.error('[signup] admin listUsers failed:', lookupErr.message);
      } else {
        const existingUser = listData?.users?.find(u => u.email === normalizedEmail);

        if (existingUser) {
          const isConfirmed =
            !!existingUser.email_confirmed_at || !!existingUser.confirmed_at;

          if (isConfirmed) {
            return NextResponse.json(
              {
                error: 'An account with this email already exists.',
                code: 'already_registered',
              },
              { status: 409 }
            );
          }

          // Exists but not yet confirmed. Surface a distinct code so the UI
          // can offer a resend-confirmation path instead of a sign-in link.
          return NextResponse.json(
            {
              error:
                'An account with this email was started but not yet confirmed. Please check your email for the confirmation link, or use Forgot Password to reset it.',
              code: 'unconfirmed',
            },
            { status: 409 }
          );
        }
      }
    } // end if (serviceRoleKey)

    // ── New account: proceed with normal signUp ──────────────────────────
    // Validate emailRedirectTo against our own origin to prevent open redirects
    let safeRedirectTo;
    if (emailRedirectTo) {
      try {
        const appUrl = process.env.NEXT_PUBLIC_APP_URL || '';
        const redirectUrl = new URL(emailRedirectTo);
        const appOrigin  = new URL(appUrl).origin;
        safeRedirectTo = redirectUrl.origin === appOrigin ? emailRedirectTo : undefined;
      } catch {
        safeRedirectTo = undefined;
      }
    }

    const supabase = await createClient();
    const { data, error } = await supabase.auth.signUp({
      email: normalizedEmail,
      password,
      options: {
        emailRedirectTo: safeRedirectTo,
      },
    });

    if (error) {
      // Map Supabase's own duplicate detection (covers race conditions
      // where the lookup missed and signUp catches it).
      if (/already registered|already exists/i.test(error.message)) {
        return NextResponse.json(
          {
            error: 'An account with this email already exists.',
            code: 'already_registered',
          },
          { status: 409 }
        );
      }
      return NextResponse.json({ error: error.message }, { status: 400 });
    }

    return NextResponse.json({
      success: true,
      // Mirror the relevant bits of Supabase's response without leaking
      // anything sensitive. The client only needs to know it worked.
      needsConfirmation: !data.session,
    });
  } catch (err) {
    console.error('[signup] unexpected error:', err);
    return NextResponse.json({ error: 'Server error' }, { status: 500 });
  }
}