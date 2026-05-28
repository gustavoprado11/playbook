import { getProfile } from '@/app/actions/auth';
import {
    listMyPatients,
    listNutritionConsultations,
    getNutritionConsultation,
    listMealPlans,
    listLabResults,
} from '@/app/actions/nutrition';
import { redirect } from 'next/navigation';
import { ArrowLeft } from 'lucide-react';
import Link from 'next/link';
import { PatientRecord } from './patient-record';
import { getSharedNotes } from '@/app/actions/shared-notes';
import { getCoProfessionals } from '@/app/actions/referrals';
import { getActiveClearances } from '@/app/actions/clearances';
import { NewReferralDialog } from '@/components/referrals/new-referral-dialog';
import { SharedNotesPanel } from '@/components/shared-notes/shared-notes-panel';
import { ClearanceBanner } from '@/components/clearances/clearance-banner';
import type { NutritionConsultation } from '@/types/database';

export default async function NutritionistPatientDetailPage({ params }: { params: Promise<{ id: string }> }) {
    const { id } = await params;
    const profile = await getProfile();
    if (!profile || profile.profession_type !== 'nutritionist') {
        redirect('/dashboard');
    }

    const [patientsResult, consultationsResult, mealPlansResult, labResultsResult] = await Promise.all([
        listMyPatients(),
        listNutritionConsultations(id),
        listMealPlans(id),
        listLabResults(id),
    ]);

    const patient = patientsResult.data?.find((sp) => sp.student?.id === id)?.student;
    if (!patient) {
        redirect('/dashboard/nutritionist/patients');
    }

    // Fetch full details for each consultation (includes anamnesis + metrics)
    const basicConsultations = consultationsResult.data || [];
    const fullConsultationResults = await Promise.all(
        basicConsultations.map((c) => getNutritionConsultation(c.id))
    );
    const consultations = fullConsultationResults
        .map((r) => r.data)
        .filter(Boolean) as NutritionConsultation[];

    const mealPlans = mealPlansResult.data || [];
    const labResults = labResultsResult.data || [];

    const [sharedNotes, coProfessionals, activeClearances] = await Promise.all([
        getSharedNotes(id),
        getCoProfessionals(id),
        getActiveClearances(id),
    ]);

    return (
        <div className="space-y-6 pb-12">
            <div className="flex items-center gap-4">
                <Link
                    href="/dashboard/nutritionist/patients"
                    className="p-2 hover:bg-zinc-100 rounded-full transition-colors"
                >
                    <ArrowLeft className="h-5 w-5 text-zinc-500" />
                </Link>
                <div className="flex-1">
                    <h1 className="text-2xl font-bold text-zinc-900">{patient.full_name}</h1>
                    <p className="text-zinc-500 text-sm">Prontuário nutricional</p>
                </div>
                <NewReferralDialog studentId={id} studentName={patient.full_name} coProfessionals={coProfessionals} />
            </div>

            <ClearanceBanner clearances={activeClearances} />

            <PatientRecord
                patient={patient}
                consultations={consultations}
                mealPlans={mealPlans}
                labResults={labResults}
            />

            <div>
                <h2 className="mb-3 text-lg font-semibold text-zinc-900">Notas compartilhadas</h2>
                <SharedNotesPanel studentId={id} notes={sharedNotes} currentProfileId={profile.id} />
            </div>
        </div>
    );
}
