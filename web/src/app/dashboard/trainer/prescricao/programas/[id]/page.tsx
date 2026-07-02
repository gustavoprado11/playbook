import { redirect, notFound } from 'next/navigation';
import { getProfile } from '@/app/actions/auth';
import {
    getExercises,
    getCatalogTaxonomy,
    getTrainingMethods,
    getProgramTemplate,
    getPrescribableStudents,
} from '@/app/actions/prescription';
import { ProgramBuilder } from '../program-builder';

export default async function EditProgramPage({ params }: { params: Promise<{ id: string }> }) {
    const { id } = await params;

    const profile = await getProfile();
    if (!profile || profile.role !== 'trainer') {
        redirect('/dashboard');
    }

    const [tree, exercises, taxonomy, methods, students] = await Promise.all([
        getProgramTemplate(id),
        getExercises(),
        getCatalogTaxonomy(),
        getTrainingMethods(),
        getPrescribableStudents(),
    ]);

    if (!tree) notFound();

    return (
        <ProgramBuilder
            initial={tree}
            exercises={exercises}
            patterns={taxonomy.patterns}
            categories={taxonomy.categories}
            methods={methods}
            students={students}
        />
    );
}
