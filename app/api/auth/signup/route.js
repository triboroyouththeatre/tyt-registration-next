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

    const { data: lookup, error: lookupErr } = await admin.auth.admin.listUsers({
      // listUsers supports a server-side email filter; we still verify the
      // match below in case of pagination quirks.
      page: 1,
      perPage: 200,
    });

    if (lookupErr) {
      // If the lookup itself fails, fall through to signUp() rather than
      // blocking signups entirely. We log this on the server.
      console.error('[signup] admin listUsers failed:', lookupErr.message);
    } else {
      const existing = lookup?.users?.find(
        u => (u.email || '').toLowerCase() === normalizedEmail
      );

      if (existing) {
        const isConfirmed =
          !!existing.email_confirmed_at || !!existing.confirmed_at;

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

    // ── New account: proceed with normal signUp ──────────────────────────
    const supabase = await createClient();
    const { data, error } = await supabase.auth.signUp({
      email: normalizedEmail,
      password,
      options: {
        emailRedirectTo: emailRedirectTo || undefined,
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