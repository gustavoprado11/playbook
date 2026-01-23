import { createClient } from '@/lib/supabase/server';
import { getProfile } from '@/app/actions/auth';
import { redirect } from 'next/navigation';
import { NewStudentForm } from './form';
import type { Trainer, Profile } from '@/types/database';

async function getTrainers() {
    const supabase = await createClient();

    const { data } = await supabase
        .from('trainers')
        .select('*, profile:profiles(*)')
        .eq('is_active', true)
        .order('profile(full_name)');

    return (data || []) as (Trainer & { profile: Profile })[];
}

export default async function NewStudentPage() {
    const profile = await getProfile();

    if (!profile || profile.role !== 'manager') {
        redirect('/dashboard');
    }

    const trainers = await getTrainers();

    return (
        <div className="max-w-2xl mx-auto space-y-6">
            <NewStudentForm trainers={trainers} />
        </div>
    );
}
