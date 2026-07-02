import { redirect } from 'next/navigation';
import { getProfile } from '@/app/actions/auth';
import { getExercises, getCatalogTaxonomy } from '@/app/actions/prescription';
import { ExerciseCatalog } from './exercise-catalog';

export default async function ExerciseCatalogPage() {
    const profile = await getProfile();

    if (!profile || profile.role !== 'trainer') {
        redirect('/dashboard');
    }

    const [exercises, taxonomy] = await Promise.all([
        getExercises(),
        getCatalogTaxonomy(),
    ]);

    return (
        <ExerciseCatalog
            exercises={exercises}
            patterns={taxonomy.patterns}
            categories={taxonomy.categories}
        />
    );
}
