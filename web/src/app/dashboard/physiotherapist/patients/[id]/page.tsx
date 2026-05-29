import { listMyPhysioPatients, listPhysioSessions, listTreatmentPlans, getPhysioSessionCounts } from '@/app/actions/physio';
import { Button } from '@/components/ui/button';
import { ArrowLeft } from 'lucide-react';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { PatientRecord } from './patient-record';
import { getProfile } from '@/app/actions/auth';
import { getClearanceHistory } from '@/app/actions/clearances';
import { getSharedNotes } from '@/app/actions/shared-notes';
import { getCoProfessionals } from '@/app/actions/referrals';
import { ClearanceDialog } from '@/components/clearances/clearance-dialog';
import { ClearanceBanner } from '@/components/clearances/clearance-banner';
import { NewReferralDialog } from '@/components/referrals/new-referral-dialog';
import { SharedNotesPanel } from '@/components/shared-notes/shared-notes-panel';
import { PhysioStatusControl } from '@/components/physio/physio-status-control';

interface Props {
    params: Promise<{ id: string }>;
}

export default async function PatientDetailPage({ params }: Props) {
    const { id } = await params;

    const [patientsResult, sessionsResult, plansResult, clearanceHistory, sharedNotes, coProfessionals, profile, sessionCounts] = await Promise.all([
        listMyPhysioPatients(),
        listPhysioSessions(id),
        listTreatmentPlans(id),
        getClearanceHistory(id),
        getSharedNotes(id),
        getCoProfessionals(id),
        getProfile(),
        getPhysioSessionCounts(id),
    ]);

    const link = patientsResult.data?.find((sp: any) => sp.student?.id === id);
    const patient = link?.student;
    if (!patient) {
        notFound();
    }

    const activeClearances = clearanceHistory.filter((c) => c.status === 'active');
    const countItems = [
        { label: 'Avaliações', value: sessionCounts.avaliacao },
        { label: 'Recovery', value: sessionCounts.recovery },
        { label: 'Sessões', value: sessionCounts.sessao },
    ];

    return (
        <div className="space-y-6">
            <div className="flex items-center gap-3">
                <Link href="/dashboard/physiotherapist/patients">
                    <Button variant="ghost" size="icon">
                        <ArrowLeft className="h-4 w-4" />
                    </Button>
                </Link>
                <div className="flex-1">
                    <h1 className="text-2xl font-bold text-zinc-900">{patient.full_name}</h1>
                    <p className="text-sm text-zinc-500">
                        {patient.email && `${patient.email} · `}{patient.phone || ''}
                    </p>
                </div>
                <div className="flex items-center gap-2">
                    <ClearanceDialog studentId={id} />
                    <NewReferralDialog studentId={id} studentName={patient.full_name} coProfessionals={coProfessionals} />
                </div>
            </div>

            <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-zinc-200 bg-white p-3">
                <PhysioStatusControl studentId={id} careStatus={link?.care_status} dischargedAt={link?.discharged_at} />
                <div className="flex gap-2">
                    {countItems.map((c) => (
                        <div key={c.label} className="rounded-lg bg-zinc-50 px-3 py-1.5 text-center">
                            <div className="text-lg font-semibold text-zinc-900">{c.value}</div>
                            <div className="text-[11px] text-zinc-500">{c.label}</div>
                        </div>
                    ))}
                </div>
            </div>

            <ClearanceBanner clearances={activeClearances} />

            <PatientRecord
                patient={patient}
                sessions={sessionsResult.data || []}
                treatmentPlans={plansResult.data || []}
            />

            <div>
                <h2 className="mb-3 text-lg font-semibold text-zinc-900">Notas compartilhadas</h2>
                <SharedNotesPanel studentId={id} notes={sharedNotes} currentProfileId={profile?.id ?? ''} />
            </div>
        </div>
    );
}
