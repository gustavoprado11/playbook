import { getProtocols, getStudentAssessments } from '@/app/actions/results';
import { createClient } from '@/lib/supabase/server';
import { ArrowLeft } from 'lucide-react';
import Link from 'next/link';
import { redirect } from 'next/navigation';
import { NewResultDialog } from '@/app/dashboard/trainer/students/new-result-dialog';
import { processAssessmentHistory, getManagementStatus } from '@/lib/assessment-logic';
import { StudentHeader } from './components/student-header';
import { ProtocolTimeline } from './components/protocol-timeline';

export default async function StudentDetailsPage({ params }: { params: Promise<{ id: string }> }) {
    const { id } = await params;
    const supabase = await createClient();

    // Fetch student details
    const { data: student, error } = await supabase
        .from('students')
        .select('*')
        .eq('id', id)
        .single();

    if (error || !student) {
        redirect('/dashboard/trainer/students');
    }

    // Parallel fetch: Protocols (for form) and Assessment History
    const [protocols, assessments] = await Promise.all([
        getProtocols(),
        getStudentAssessments(id)
    ]);

    // Process Data
    const groups = processAssessmentHistory(assessments);
    const managementStatus = getManagementStatus(assessments);
    const lastAssessmentDate = assessments.length > 0 ? assessments[0].performed_at : undefined;

    return (
        <div className="space-y-8 pb-12">
            {/* Top Nav */}
            <div className="flex items-center justify-between">
                <div className="flex items-center gap-4">
                    <Link
                        href="/dashboard/trainer/students"
                        className="p-2 hover:bg-zinc-100 rounded-full transition-colors"
                    >
                        <ArrowLeft className="h-5 w-5 text-zinc-500" />
                    </Link>
                    <div>
                        <h1 className="text-2xl font-bold text-zinc-900">Análise de Evolução</h1>
                        <p className="text-zinc-500 text-sm">
                            Acompanhamento detalhado de performance
                        </p>
                    </div>
                </div>
                <NewResultDialog studentId={student.id} protocols={protocols} />
            </div>

            {/* Header Summary */}
            <StudentHeader
                student={student}
                lastAssessmentDate={lastAssessmentDate}
                managementStatus={managementStatus}
                protocolsCount={groups.length}
            />

            {/* Content Area */}
            {groups.length === 0 ? (
                <div className="text-center py-12 bg-zinc-50 rounded-lg border border-dashed border-zinc-200">
                    <p className="text-zinc-500 font-medium">Nenhuma avaliação registrada ainda.</p>
                    <p className="text-sm text-zinc-400 mt-1">Realize a primeira avaliação para iniciar o acompanhamento.</p>
                </div>
            ) : (
                <div className="grid gap-10">
                    {groups.map((group) => (
                        <ProtocolTimeline key={group.protocolId} group={group} />
                    ))}
                </div>
            )}
        </div>
    );
}

