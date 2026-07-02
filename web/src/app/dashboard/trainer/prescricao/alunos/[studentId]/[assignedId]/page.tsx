import { redirect, notFound } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { getProfile } from '@/app/actions/auth';
import {
    getAssignedProgram, getExercises, getCatalogTaxonomy, getTrainingMethods,
} from '@/app/actions/prescription';
import { AssignedBuilder } from '../../assigned-builder';

export default async function AssignedProgramEditorPage({
    params,
}: {
    params: Promise<{ studentId: string; assignedId: string }>;
}) {
    const { studentId, assignedId } = await params;

    const profile = await getProfile();
    if (!profile || profile.role !== 'trainer') {
        redirect('/dashboard');
    }

    const [tree, exercises, taxonomy, methods] = await Promise.all([
        getAssignedProgram(assignedId),
        getExercises(),
        getCatalogTaxonomy(),
        getTrainingMethods(),
    ]);

    if (!tree || tree.student_id !== studentId) notFound();

    const supabase = await createClient();
    const { data: student } = await supabase
        .from('students')
        .select('full_name')
        .eq('id', studentId)
        .single();

    return (
        <AssignedBuilder
            initial={tree}
            studentName={student?.full_name ?? 'Aluno'}
            exercises={exercises}
            patterns={taxonomy.patterns}
            categories={taxonomy.categories}
            methods={methods}
        />
    );
}
