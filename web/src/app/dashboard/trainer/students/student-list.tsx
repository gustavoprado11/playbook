'use client';

import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import type { Student } from '@/types/database';
import { User, CheckCircle2, AlertCircle, Calendar, ArrowRight } from 'lucide-react';
import { cn } from '@/lib/utils';
import Link from 'next/link';

interface StudentListProps {
    students: Student[];
    assessmentMap: Map<string, string>; // studentId -> date
}

export function StudentList({ students, assessmentMap }: StudentListProps) {
    if (students.length === 0) {
        return (
            <Card>
                <CardContent className="flex flex-col items-center justify-center py-12">
                    <User className="h-12 w-12 text-zinc-300" />
                    <p className="mt-4 text-zinc-500">Nenhum aluno encontrado</p>
                </CardContent>
            </Card>
        );
    }

    const today = new Date();
    const windowDays = 60; // Default window

    // Check managed status
    const getStatus = (lastDateStr?: string) => {
        if (!lastDateStr) return { isManaged: false, daysdiff: null };

        const lastDate = new Date(lastDateStr);
        const diffTime = Math.abs(today.getTime() - lastDate.getTime());
        const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

        return {
            isManaged: diffDays <= windowDays,
            daysDiff: diffDays
        };
    };

    const managedCount = students.filter(s => getStatus(assessmentMap.get(s.id)).isManaged).length;

    return (
        <div className="space-y-4">
            {/* Summary */}
            <div className="rounded-xl bg-white border border-zinc-200 p-4">
                <div className="flex items-center justify-between">
                    <div>
                        <p className="text-sm text-zinc-500">Alunos com avaliação em dia</p>
                        <p className="text-2xl font-bold text-zinc-900">
                            {managedCount}/{students.length}
                        </p>
                    </div>
                    <div className={cn(
                        'rounded-full p-3',
                        managedCount >= Math.ceil(students.length * 0.75)
                            ? 'bg-emerald-100'
                            : 'bg-amber-100'
                    )}>
                        {managedCount >= Math.ceil(students.length * 0.75) ? (
                            <CheckCircle2 className="h-6 w-6 text-emerald-600" />
                        ) : (
                            <AlertCircle className="h-6 w-6 text-amber-600" />
                        )}
                    </div>
                </div>
            </div>

            {/* Student Cards */}
            <div className="grid gap-4 md:grid-cols-2">
                {students.map((student) => {
                    const lastDate = assessmentMap.get(student.id);
                    const { isManaged, daysDiff } = getStatus(lastDate);

                    return (
                        <Card
                            key={student.id}
                            className={cn(
                                'transition-all hover:border-zinc-300',
                                isManaged && 'border-emerald-200 bg-emerald-50/30'
                            )}
                        >
                            <CardContent className="p-4">
                                <div className="flex items-start justify-between mb-4">
                                    <div className="flex items-center gap-3">
                                        <div className="flex h-10 w-10 items-center justify-center rounded-full bg-zinc-100 text-zinc-600">
                                            <User className="h-5 w-5" />
                                        </div>
                                        <div>
                                            <p className="font-medium text-zinc-900">{student.full_name}</p>
                                            <p className="text-xs text-zinc-500">
                                                Início: {new Date(student.start_date).toLocaleDateString('pt-BR')}
                                            </p>
                                        </div>
                                    </div>
                                    {isManaged ? (
                                        <span className="inline-flex items-center rounded-full bg-emerald-100 px-2 py-1 text-xs font-medium text-emerald-700">
                                            Em dia
                                        </span>
                                    ) : (
                                        <span className="inline-flex items-center rounded-full bg-amber-100 px-2 py-1 text-xs font-medium text-amber-700">
                                            Avaliação Pendente
                                        </span>
                                    )}
                                </div>

                                <div className="flex items-center justify-between border-t border-zinc-100 pt-4 mt-4">
                                    <div className="text-sm">
                                        <span className="text-zinc-500 flex items-center gap-1">
                                            <Calendar className="h-3 w-3" />
                                            Última avaliação:
                                        </span>
                                        <span className={cn(
                                            "font-medium",
                                            !lastDate ? "text-amber-600" : "text-zinc-900"
                                        )}>
                                            {lastDate
                                                ? new Date(lastDate).toLocaleDateString('pt-BR')
                                                : "Nunca avaliado"}
                                        </span>
                                        {lastDate && (
                                            <span className="text-xs text-zinc-400 block">
                                                {daysDiff} dias atrás
                                            </span>
                                        )}
                                    </div>

                                    <Link href={`/dashboard/trainer/students/${student.id}`}>
                                        <Button variant="ghost" size="sm" className="gap-2">
                                            Ver Histórico
                                            <ArrowRight className="h-4 w-4" />
                                        </Button>
                                    </Link>
                                </div>
                            </CardContent>
                        </Card>
                    );
                })}
            </div>
        </div>
    );
}

