import { createClient } from '@/lib/supabase/server';
import { NextResponse } from 'next/server';

export async function GET(request) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get('code');
  const next = searchParams.get('next') || '/dashboard';

  if (code) {
    const supabase = await createClient();
    const { error } = await supabase.auth.exchangeCodeForSession(code);

    if (!error) {
      // Sign out immediately so they land on login fresh
      await supabase.auth.signOut();
      return NextResponse.redirect(`${origin}/confirm/success`);
    }
  }

  return NextResponse.redirect(`${origin}/confirm/error`);
}