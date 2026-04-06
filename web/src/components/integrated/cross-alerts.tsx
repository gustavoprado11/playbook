'use client';

import { AlertTriangle, Info } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { IntegratedStudentView } from '@/app/actions/integrated';

interface CrossAlert {
    severity: 'info' | 'warning';
    title: string;
    description: string;
}

function generateAlerts(view: IntegratedStudentView): CrossAlert[] {
    const alerts: CrossAlert[] = [];
    const today = new Date();

    // Nutrition alerts
    if (view.nutrition.hasLinkedProfessional) {
        if (view.nutrition.lastConsultationDate) {
            const daysSince = Math.floor(
                (today.getTime() - new Date(view.nutrition.lastConsultationDate).getTime()) / (1000 * 60 * 60 * 24)
            );
            if (daysSince > 30) {
                alerts.push({
                    severity: 'warning',
                    title: 'Consulta nutricional atrasada',
                    description: `Última consulta há ${daysSince} dias (${view.nutrition.professionalName})`,
                });
            }
        } else {
            alerts.push({
                severity: 'info',
                title: 'Sem consulta nutricional',
                description: `Nutricionista vinculado(a) (${view.nutrition.professionalName}) mas nenhuma consulta registrada`,
            });
        }

        // Expired meal plans
        view.nutrition.activeMealPlans.forEach(plan => {
            if (plan.end_date && new Date(plan.end_date) < today) {
                const daysPast = Math.floor(
                    (today.getTime() - new Date(plan.end_date).getTime()) / (1000 * 60 * 60 * 24)
                );
                alerts.push({
                    severity: 'warning',
                    title: 'Plano alimentar expirado',
                    description: `"${plan.title}" expirou há ${daysPast} dias`,
                });
            }
        });

        // Abnormal lab results
        view.nutrition.recentLabResults.forEach(lab => {
            const entries = Object.entries(lab.results || {});
            const abnormal = entries.filter(([, e]: [string, any]) => e.status !== 'normal');
            if (abnormal.length > 0) {
                alerts.push({
                    severity: 'warning',
                    title: `Exame com valores fora da referência`,
                    description: `${lab.exam_type}: ${abnormal.length} valor(es) anormal(is)`,
                });
            }
        });
    }

    // Physio alerts
    if (view.physio.hasLinkedProfessional) {
        if (view.physio.lastSessionDate) {
            const daysSince = Math.floor(
                (today.getTime() - new Date(view.physio.lastSessionDate).getTime()) / (1000 * 60 * 60 * 24)
            );
            if (daysSince > 30) {
                alerts.push({
                    severity: 'warning',
                    title: 'Sessão de fisioterapia atrasada',
                    description: `Última sessão há ${daysSince} dias (${view.physio.professionalName})`,
                });
            }
        } else {
            alerts.push({
                severity: 'info',
                title: 'Sem sessão de fisioterapia',
                description: `Fisioterapeuta vinculado(a) (${view.physio.professionalName}) mas nenhuma sessão registrada`,
            });
        }

        // Active treatment without recent session
        if (view.physio.activeTreatmentPlans.length > 0 && view.physio.lastSessionDate) {
            const daysSince = Math.floor(
                (today.getTime() - new Date(view.physio.lastSessionDate).getTime()) / (1000 * 60 * 60 * 24)
            );
            if (daysSince > 14) {
                alerts.push({
                    severity: 'info',
                    title: 'Protocolo ativo sem sessão recente',
                    description: `Protocolo de tratamento ativo sem sessão nos últimos ${daysSince} dias`,
                });
            }
        }
    }

    return alerts;
}

const severityStyles = {
    warning: {
        bg: 'bg-amber-50 border-amber-200',
        icon: 'text-amber-600',
        text: 'text-amber-800',
        desc: 'text-amber-600',
    },
    info: {
        bg: 'bg-blue-50 border-blue-200',
        icon: 'text-blue-500',
        text: 'text-blue-800',
        desc: 'text-blue-600',
    },
};

interface CrossAlertsProps {
    view: IntegratedStudentView;
}

export function CrossAlerts({ view }: CrossAlertsProps) {
    const alerts = generateAlerts(view);

    if (alerts.length === 0) return null;

    return (
        <div className="space-y-2">
            {alerts.map((alert, i) => {
                const styles = severityStyles[alert.severity];
                return (
                    <div
                        key={i}
                        className={cn('flex items-start gap-3 rounded-lg border p-3', styles.bg)}
                    >
                        {alert.severity === 'warning' ? (
                            <AlertTriangle className={cn('h-4 w-4 mt-0.5 shrink-0', styles.icon)} />
                        ) : (
                            <Info className={cn('h-4 w-4 mt-0.5 shrink-0', styles.icon)} />
                        )}
                        <div>
                            <p className={cn('text-sm font-medium', styles.text)}>{alert.title}</p>
                            <p className={cn('text-xs', styles.desc)}>{alert.description}</p>
                        </div>
                    </div>
                );
            })}
        </div>
    );
}
