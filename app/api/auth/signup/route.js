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
    const admin = createAdminClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL,
      process.env.SUPABASE_SERVICE_ROLE_KEY,
      { auth: { autoRefreshToken: false, persistSession: false } }
    );

    const normalizedEmail = email.trim().toLowerCase();

    const { data: existing, error: lookupErr } = await admin.auth.admin.getUserByEmail(normalizedEmail);

    if (lookupErr && lookupErr.status !== 404) {
      // Unexpected error — log and fall through rather than blocking signups entirely
      console.error('[signup] admin getUserByEmail failed:', lookupErr.message);
    } else if (existing?.user) {
      const isConfirmed =
        !!existing.user.email_confirmed_at || !!existing.user.confirmed_at;

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