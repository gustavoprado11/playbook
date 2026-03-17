'use client';

import { useState, type ReactNode } from 'react';
import Link from 'next/link';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { getKPIDetails, type KPIDetail, type RetentionDetail, type ReferralsDetail, type ManagementDetail } from '@/app/actions/manager';
import { formatDate } from '@/lib/utils';

interface PerformanceKPIPopoverProps {
    trainerId: string;
    trainerName: string;
    kpiType: 'retention' | 'referrals' | 'management';
    referenceMonth: string;
    ineligibleMessage?: string;
    children: ReactNode;
}

const KPI_TITLES: Record<string, string> = {
    retention: 'Retenção',
    referrals: 'Indicações',
    management: 'Gestão',
};

export function PerformanceKPIPopover({
    trainerId,
    trainerName,
    kpiType,
    referenceMonth,
    ineligibleMessage,
    children,
}: PerformanceKPIPopoverProps) {
    const [detail, setDetail] = useState<KPIDetail | null>(null);
    const [loading, setLoading] = useState(false);
    const [loaded, setLoaded] = useState(false);

    async function handleOpen(open: boolean) {
        if (open && !loaded) {
            setLoading(true);
            try {
                const data = await getKPIDetails({ trainerId, kpiType, referenceMonth });
                setDetail(data);
                setLoaded(true);
            } catch (e) {
                console.error(e);
            } finally {
                setLoading(false);
            }
        }
    }

    return (
        <Popover onOpenChange={handleOpen}>
            <PopoverTrigger asChild>
                <button className="cursor-pointer transition-opacity hover:opacity-75">
                    {children}
                </button>
            </PopoverTrigger>
            <PopoverContent className="w-96 max-h-[400px] overflow-y-auto p-4" align="center" sideOffset={8}>
                <p className="text-sm font-semibold text-zinc-900 mb-3">
                    {KPI_TITLES[kpiType]} — {trainerName}
                </p>

                {ineligibleMessage ? (
                    <p className="text-sm text-zinc-400">{ineligibleMessage}</p>
                ) : loading ? (
                    <p className="text-sm text-zinc-400">Carregando...</p>
                ) : detail ? (
                    <>
                        {detail.type === 'retention' && <RetentionContent data={detail} />}
                        {detail.type === 'referrals' && <ReferralsContent data={detail} />}
                        {detail.type === 'management' && <ManagementContent data={detail} />}
                    </>
                ) : (
                    <p className="text-sm text-zinc-400">Erro ao carregar dados</p>
                )}
            </PopoverContent>
        </Popover>
    );
}

function StudentLink({ id, name, className }: { id: string; name: string; className?: string }) {
    return (
        <Link
            href={`/dashboard/manager/students/${id}`}
            className={`hover:underline ${className || 'text-zinc-700'}`}
        >
            {name}
        </Link>
    );
}

function RetentionContent({ data }: { data: RetentionDetail }) {
    return (
        <div className="space-y-3 text-sm">
            <div className="space-y-1 text-zinc-600">
                <div className="flex justify-between">
                    <span>Início do mês:</span>
                    <span className="font-medium text-zinc-900">{data.studentsStart} alunos</span>
                </div>
                <div className="flex justify-between">
                    <span>Cancelamentos:</span>
                    <span className="font-medium text-red-600">{data.cancellations}</span>
                </div>
                <div className="flex justify-between">
                    <span>Final do mês:</span>
                    <span className="font-medium text-zinc-900">{data.studentsEnd} alunos</span>
                </div>
                <div className="flex justify-between border-t border-zinc-100 pt-1">
                    <span>Taxa:</span>
                    <span className="font-semibold text-zinc-900">{data.retentionRate.toFixed(1)}%</span>
                </div>
            </div>

            {data.cancelledStudents.length > 0 && (
                <div>
                    <p className="text-xs font-medium text-red-600 mb-1">Cancelados:</p>
                    <ul className="space-y-0.5">
                        {data.cancelledStudents.map((s) => (
                            <li key={s.id} className="text-sm flex items-center gap-1">
                                <span className="text-red-400">•</span>
                                <StudentLink id={s.id} name={s.name} className="text-red-700" />
                                <span className="text-zinc-400">— {formatDate(s.endDate)}</span>
                            </li>
                        ))}
                    </ul>
                </div>
            )}

            {data.newStudents.length > 0 && (
                <div>
                    <p className="text-xs font-medium text-emerald-600 mb-1">Novos:</p>
                    <ul className="space-y-0.5">
                        {data.newStudents.map((s) => (
                            <li key={s.id} className="text-sm flex items-center gap-1">
                                <span className="text-emerald-400">•</span>
                                <StudentLink id={s.id} name={s.name} className="text-emerald-700" />
                                <span className="text-zinc-400">— {formatDate(s.startDate)}</span>
                            </li>
                        ))}
                    </ul>
                </div>
            )}

            {data.cancelledStudents.length === 0 && data.newStudents.length === 0 && (
                <p className="text-zinc-400">Nenhuma movimentação no mês</p>
            )}
        </div>
    );
}

function ReferralsContent({ data }: { data: ReferralsDetail }) {
    return (
        <div className="space-y-3 text-sm">
            {data.referrals.length === 0 ? (
                <p className="text-zinc-400">Nenhuma indicação no mês</p>
            ) : (
                <>
                    <ul className="space-y-2">
                        {data.referrals.map((r) => (
                            <li key={r.id}>
                                <div className="flex items-center gap-1">
                                    <span className={r.isValidated ? 'text-emerald-500' : 'text-zinc-300'}>
                                        {r.isValidated ? '✓' : '○'}
                                    </span>
                                    <StudentLink id={r.id} name={r.studentName} />
                                    <span className="text-zinc-400">— {formatDate(r.referredAt)}</span>
                                </div>
                                <p className="text-xs text-zinc-400 ml-5">
                                    {r.isValidated
                                        ? `Validado em ${formatDate(r.validatedAt!)}`
                                        : 'Aguardando validação'}
                                </p>
                            </li>
                        ))}
                    </ul>
                    <p className="text-xs text-zinc-500 border-t border-zinc-100 pt-2">
                        Total: {data.referrals.length} indicaç{data.referrals.length === 1 ? 'ão' : 'ões'}
                        {data.count !== data.referrals.length && ` (${data.count} validada${data.count === 1 ? '' : 's'})`}
                    </p>
                </>
            )}
        </div>
    );
}

function ManagementContent({ data }: { data: ManagementDetail }) {
    const onTrack = data.students.filter((s) => s.status === 'on_track');
    const warning = data.students.filter((s) => s.status === 'warning');
    const late = data.students.filter((s) => s.status === 'late');
    const never = data.students.filter((s) => s.status === 'never');

    return (
        <div className="space-y-3 text-sm">
            <p className="text-zinc-600">
                <span className="font-semibold text-zinc-900">{data.managedCount}/{data.totalActive}</span> alunos avaliados
                <span className="text-zinc-400"> ({data.managementRate.toFixed(1)}%)</span>
            </p>

            {onTrack.length > 0 && (
                <StudentGroup
                    label="Em dia"
                    sublabel="< 30 dias"
                    icon="●"
                    iconColor="text-emerald-500"
                    students={onTrack}
                />
            )}
            {warning.length > 0 && (
                <StudentGroup
                    label="Atenção"
                    sublabel="30–60 dias"
                    icon="◐"
                    iconColor="text-amber-500"
                    students={warning}
                />
            )}
            {(late.length > 0 || never.length > 0) && (
                <StudentGroup
                    label="Pendente"
                    sublabel="> 60 dias"
                    icon="○"
                    iconColor="text-red-500"
                    students={[...late, ...never]}
                />
            )}

            {data.students.length === 0 && (
                <p className="text-zinc-400">Nenhum aluno ativo</p>
            )}
        </div>
    );
}

function StudentGroup({
    label,
    sublabel,
    icon,
    iconColor,
    students,
}: {
    label: string;
    sublabel: string;
    icon: string;
    iconColor: string;
    students: ManagementDetail['students'];
}) {
    return (
        <div>
            <p className="text-xs font-medium text-zinc-500 mb-1">
                <span className={iconColor}>{icon}</span> {label} ({sublabel}):
            </p>
            <ul className="space-y-0.5 ml-4">
                {students.map((s) => (
                    <li key={s.id} className="text-sm flex items-center gap-1">
                        <StudentLink id={s.id} name={s.name} />
                        <span className="text-zinc-400">
                            — {s.status === 'never'
                                ? 'nunca avaliado'
                                : `há ${s.daysAgo} dias`}
                        </span>
                    </li>
                ))}
            </ul>
        </div>
    );
}
