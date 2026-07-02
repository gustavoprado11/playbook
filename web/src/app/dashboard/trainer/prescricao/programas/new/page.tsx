import { redirect } from 'next/navigation';
import { getProfile } from '@/app/actions/auth';
import { getExercises, getCatalogTaxonomy, getTrainingMethods } from '@/app/actions/prescription';
import { ProgramBuilder } from '../program-builder';

export default async function NewProgramPage() {
    const profile = await getProfile();

    if (!profile || profile.role !== 'trainer') {
        redirect('/dashboard');
    }

    const [exercises, taxonomy, methods] = await Promise.all([
        getExercises(),
        getCatalogTaxonomy(),
        getTrainingMethods(),
    ]);

    return (
        <ProgramBuilder
            initial={null}
            exercises={exercises}
            patterns={taxonomy.patterns}
            categories={taxonomy.categories}
            methods={methods}
        />
    );
}
