import { createClient } from '@/lib/supabase/server';
import { redirect } from 'next/navigation';
import ProgramForm from '@/components/backstage/ProgramForm';

export default async function NewProgramPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/login');
  const { data: profile } = await supabase.from('profiles').select('role').eq('id', user.id).single();
  if (profile?.role !== 'admin') redirect('/dashboard');

  const [{ data: seasons }, { data: sessions }, { data: programTypes }] = await Promise.all([
    supabase.from('seasons').select('id, name, display_name, is_active').order('name', { ascending: false }),
    supabase.from('sessions').select('id, name, season_id, is_active').order('name'),
    supabase.from('program_types').select('id, label').order('label'),
  ]);

  // Add season_id to sessions for filtering
  const enrichedSeasons = seasons || [];

  return (
    <ProgramForm
      program={null}
      seasons={enrichedSeasons}
      sessions={sessions || []}
      programTypes={programTypes || []}
    />
  );
}