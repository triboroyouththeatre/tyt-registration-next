import { createClient } from '@/lib/supabase/server';
import { NextResponse } from 'next/server';

export async function POST(request) {
  try {
    const { email, password } = await request.json();
    const supabase = await createClient();

    const { data, error } = await supabase.auth.signInWithPassword({ email, password });

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 401 });
    }

    if (!data.session) {
      return NextResponse.json({ error: 'No session returned' }, { status: 401 });
    }

    // Check onboarding status
    const { data: profile } = await supabase
      .from('profiles')
      .select('family_id')
      .eq('id', data.user.id)
      .single();

    // Default to false — a missing profile means the account is brand new
    // and hasn't completed onboarding. Only treat as complete when the
    // families row explicitly says so.
    let onboardingComplete = false;
    if (profile?.family_id) {
      const { data: family } = await supabase
        .from('families')
        .select('is_onboarding_complete')
        .eq('id', profile.family_id)
        .single();
      onboardingComplete = family?.is_onboarding_complete ?? false;
    }

    return NextResponse.json({
      success: true,
      accessToken: data.session.access_token,
      refreshToken: data.session.refresh_token,
      onboardingComplete,
    });
  } catch (err) {
    return NextResponse.json({ error: 'Server error' }, { status: 500 });
  }
}