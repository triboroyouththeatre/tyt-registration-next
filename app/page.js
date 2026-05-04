import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';

export default async function Home() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    redirect('/login');
  }

  // Authed users: let the proxy figure out where they belong
  // (admin → /backstage, family → /dashboard or /onboarding).
  redirect('/dashboard');
}