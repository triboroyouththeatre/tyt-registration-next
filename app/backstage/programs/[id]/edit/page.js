import { createClient } from '@/lib/supabase/server';
import { redirect } from 'next/navigation';
import ProgramForm from '@/components/backstage/ProgramForm';

export default async function EditProgramPage({ params }) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/login');
  const { data: profile } = await supabase.from('profiles').select('role').eq('id', user.id).single();
  if (profile?.role !== 'admin') redirect('/dashboard');

  const { id } = await params;

  const [{ data: program }, { data: seasons }, { data: sessions }, { data: programTypes }] = await Promise.all([
    supabase.from('programs').select('*').eq('id', id).single(),
    supabase.from('seasons').select('id, name, display_name, is_active').order('name', { ascending: false }),
    supabase.from('sessions').select('id, name, season_id, is_active').order('name'),
    supabase.from('program_types').select('id, label').order('label'),
  ]);

  if (!program) redirect('/backstage/programs');

  const session = sessions?.find(s => s.id === program.session_id);
  const programWithSeason = { ...program, season_id: session?.season_id || '' };

  return (
    <ProgramForm
      program={programWithSeason}
      seasons={seasons || []}
      sessions={sessions || []}
      programTypes={programTypes || []}
    />
  );
}