import { listMyPhysioPatients, listPhysioSessions, listTreatmentPlans } from '@/app/actions/physio';
import { Button } from '@/components/ui/button';
import { ArrowLeft } from 'lucide-react';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { PatientRecord } from './patient-record';

interface Props {
    params: Promise<{ id: string }>;
}

export default async function PatientDetailPage({ params }: Props) {
    const { id } = await params;

    const [patientsResult, sessionsResult, plansResult] = await Promise.all([
        listMyPhysioPatients(),
        listPhysioSessions(id),
        listTreatmentPlans(id),
    ]);

    const patient = patientsResult.data?.find((sp: any) => sp.student?.id === id)?.student;
    if (!patient) {
        notFound();
    }

    return (
        <div className="space-y-6">
            <div className="flex items-center gap-3">
                <Link href="/dashboard/physiotherapist/patients">
                    <Button variant="ghost" size="icon">
                        <ArrowLeft className="h-4 w-4" />
                    </Button>
                </Link>
                <div>
                    <h1 className="text-2xl font-bold text-zinc-900">{patient.full_name}</h1>
                    <p className="text-sm text-zinc-500">
                        {patient.email && `${patient.email} · `}{patient.phone || ''}
                    </p>
                </div>
            </div>

            <PatientRecord
                patient={patient}
                sessions={sessionsResult.data || []}
                treatmentPlans={plansResult.data || []}
            />
        </div>
    );
}
