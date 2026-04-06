import { getProfile } from '@/app/actions/auth';
import { getProtocols, getStudentAssessments } from '@/app/actions/results';
import { createClient } from '@/lib/supabase/server';
import { processAssessmentHistory, getManagementStatus } from '@/lib/assessment-logic';
import { redirect } from 'next/navigation';
import { ArrowLeft } from 'lucide-react';
import Link from 'next/link';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { formatDate, cn } from '@/lib/utils';
import { StudentHeader } from '@/app/dashboard/trainer/students/[id]/components/student-header';
import { ProtocolTimeline } from '@/app/dashboard/trainer/students/[id]/components/protocol-timeline';
import { ProfessionBadge } from '@/components/profession-badge';
import { LinkProfessionalDialog } from '@/components/link-professional-dialog';
import { UnlinkProfessionalButton } from './unlink-professional-button';
import type { Profile, Trainer, ProfessionType } from '@/types/database';

const originLabels: Record<string, string> = {
    organic: 'Orgânico',
    referral: 'Indicação',
    marketing: 'Marketing',
};

const statusColors: Record<string, string> = {
    active: 'bg-emerald-100 text-emerald-700',
    cancelled: 'bg-red-100 text-red-700',
    paused: 'bg-amber-100 text-amber-700',
};

const statusLabels: Record<string, string> = {
    active: 'Ativo',
    cancelled: 'Cancelado',
    paused: 'Pausado',
};

export default async function ManagerStudentDetailPage({ params }: { params: Promise<{ id: string }> }) {
    const { id } = await params;
    const profile = await getProfile();

    if (!profile || profile.role !== 'manager') {
        redirect('/dashboard');
    }

    const supabase = await createClient();

    const { data: student, error } = await supabase
        .from('students')
        .select('*, trainer:trainers!students_trainer_id_fkey(*, profile:profiles(*))')
        .eq('id', id)
        .single();

    if (error || !student) {
        redirect('/dashboard/manager/students');
    }

    const [protocols, assessments, referredByResult, linkedProfessionalsResult, allProfessionalsResult] = await Promise.all([
        getProtocols(),
        getStudentAssessments(id),
        student.referred_by_trainer_id
            ? supabase.from('trainers').select('*, profile:profiles(*)').eq('id', student.referred_by_trainer_id).single()
            : Promise.resolve({ data: null }),
        supabase
            .from('student_professionals')
            .select(`
                *,
                professional:professionals!professional_id(
                    *,
                    profile:profiles!profile_id(full_name, email)
                )
            `)
            .eq('student_id', id)
            .eq('status', 'active'),
        supabase
            .from('professionals')
            .select('id, profession_type, is_active, profile:profiles!profile_id(*)')
            .in('profession_type', ['nutritionist', 'physiotherapist'])
            .eq('is_active', true),
    ]);

    const linkedProfessionals = linkedProfessionalsResult.data || [];
    const allProfessionals = (allProfessionalsResult.data || []).map((p: any) => ({
        id: p.id as string,
        profession_type: p.profession_type as ProfessionType,
        is_active: p.is_active as boolean,
        profile: (Array.isArray(p.profile) ? p.profile[0] : p.profile) as Profile,
    }));

    const groups = processAssessmentHistory(assessments);
    const managementStatus = getManagementStatus(assessments);
    const lastAssessmentDate = assessments.length > 0 ? assessments[0].performed_at : undefined;

    const trainer = student.trainer as (Trainer & { profile: Profile }) | null;
    const referredBy = referredByResult.data as (Trainer & { profile: Profile }) | null;

    return (
        <div className="space-y-8 pb-12">
            {/* Top Nav */}
            <div className="flex items-center gap-4">
                <Link
                    href="/dashboard/manager/students"
                    className="p-2 hover:bg-zinc-100 rounded-full transition-colors"
                >
                    <ArrowLeft className="h-5 w-5 text-zinc-500" />
                </Link>
                <div>
                    <h1 className="text-2xl font-bold text-zinc-900">Detalhes do Aluno</h1>
                    <p className="text-zinc-500 text-sm">Visão completa de avaliações e evolução</p>
                </div>
            </div>

            {/* Student Info Card */}
            <Card className="bg-white border-zinc-200">
                <CardContent className="p-6">
                    <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
                        <div className="space-y-3">
                            <div className="flex items-center gap-3">
                                <h2 className="text-xl font-bold text-zinc-900">{student.full_name}</h2>
                                <span className={cn(
                                    'inline-flex rounded-full px-2 py-0.5 text-xs font-medium',
                                    statusColors[student.status] || 'bg-zinc-100 text-zinc-600'
                                )}>
                                    {statusLabels[student.status] || student.status}
                                </span>
                                {student.is_archived && (
                                    <span className="inline-flex rounded-full bg-zinc-100 px-2 py-0.5 text-xs font-medium text-zinc-500">
                                        Arquivado
                                    </span>
                                )}
                            </div>
                            <div className="flex flex-wrap gap-x-6 gap-y-1 text-sm text-zinc-500">
                                <span>Treinador: <strong className="text-zinc-700">{trainer?.profile?.full_name || '-'}</strong></span>
                                <span>Início: <strong className="text-zinc-700">{formatDate(student.start_date)}</strong></span>
                                <span>Origem: <strong className="text-zinc-700">{originLabels[student.origin] || student.origin}</strong></span>
                                {student.origin === 'referral' && referredBy && (
                                    <span>Indicado por: <strong className="text-zinc-700">{referredBy.profile?.full_name}</strong></span>
                                )}
                            </div>
                            {student.email && (
                                <p className="text-sm text-zinc-400">{student.email}</p>
                            )}
                        </div>
                    </div>
                </CardContent>
            </Card>

            {/* Equipe de Acompanhamento */}
            <Card className="bg-white border-zinc-200">
                <CardHeader className="flex flex-row items-center justify-between">
                    <CardTitle className="text-base">Equipe de Acompanhamento</CardTitle>
                    <LinkProfessionalDialog studentId={id} professionals={allProfessionals} />
                </CardHeader>
                <CardContent>
                    {linkedProfessionals.length === 0 ? (
                        <p className="text-sm text-zinc-400">Nenhum profissional vinculado além do treinador.</p>
                    ) : (
                        <div className="space-y-2">
                            {linkedProfessionals.map((lp: { id: string; started_at: string; professional: { id: string; profession_type: ProfessionType; profile: { full_name: string; email: string } } }) => (
                                <div key={lp.id} className="flex items-center justify-between rounded-lg border border-zinc-100 p-3">
                                    <div className="flex items-center gap-3">
                                        <ProfessionBadge type={lp.professional.profession_type} />
                                        <div>
                                            <p className="text-sm font-medium text-zinc-900">{lp.professional.profile.full_name}</p>
                                            <p className="text-xs text-zinc-400">Desde {formatDate(lp.started_at)}</p>
                                        </div>
                                    </div>
                                    <UnlinkProfessionalButton studentId={id} professionalId={lp.professional.id} />
                                </div>
                            ))}
                        </div>
                    )}
                </CardContent>
            </Card>

            {/* Assessment Status Header */}
            <StudentHeader
                student={student}
                lastAssessmentDate={lastAssessmentDate}
                managementStatus={managementStatus}
                protocolsCount={groups.length}
            />

            {/* Assessments */}
            {groups.length === 0 ? (
                <div className="text-center py-12 bg-zinc-50 rounded-lg border border-dashed border-zinc-200">
                    <p className="text-zinc-500 font-medium">Nenhuma avaliação registrada ainda.</p>
                    <p className="text-sm text-zinc-400 mt-1">O treinador precisa registrar a primeira avaliação.</p>
                </div>
            ) : (
                <div className="grid gap-10">
                    {groups.map((group) => (
                        <ProtocolTimeline
                            key={group.protocolId}
                            group={group}
                            studentId={student.id}
                            protocols={protocols}
                            readOnly
                        />
                    ))}
                </div>
            )}
        </div>
    );
}
