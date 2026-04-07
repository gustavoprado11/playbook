import { AlertTriangle, Info, ArrowRight, UtensilsCrossed, Activity, Dumbbell, Settings } from 'lucide-react';
import Link from 'next/link';
import type { DashboardAlert } from '@/app/actions/alerts';

const categoryIcons = {
    nutrition: UtensilsCrossed,
    physiotherapy: Activity,
    training: Dumbbell,
    admin: Settings,
};

const categoryColors = {
    nutrition: 'border-amber-200 bg-amber-50',
    physiotherapy: 'border-blue-200 bg-blue-50',
    training: 'border-emerald-200 bg-emerald-50',
    admin: 'border-zinc-200 bg-zinc-50',
};

const severityIcons = {
    warning: AlertTriangle,
    info: Info,
};

interface DashboardAlertsProps {
    alerts: DashboardAlert[];
}

export function DashboardAlerts({ alerts }: DashboardAlertsProps) {
    if (alerts.length === 0) return null;

    return (
        <div className="space-y-2">
            {alerts.map((alert) => {
                const CategoryIcon = categoryIcons[alert.category];
                const SeverityIcon = severityIcons[alert.severity];

                return (
                    <div
                        key={alert.id}
                        className={`flex items-start gap-3 rounded-lg border p-3 ${categoryColors[alert.category]}`}
                    >
                        <CategoryIcon className="h-5 w-5 mt-0.5 shrink-0 text-zinc-600" />
                        <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2">
                                <SeverityIcon className={`h-4 w-4 shrink-0 ${alert.severity === 'warning' ? 'text-amber-600' : 'text-blue-600'}`} />
                                <p className="text-sm font-medium text-zinc-900">{alert.title}</p>
                                {alert.count !== undefined && alert.count > 0 && (
                                    <span className="inline-flex items-center rounded-full bg-white/80 px-2 py-0.5 text-xs font-medium text-zinc-700">
                                        {alert.count}
                                    </span>
                                )}
                            </div>
                            <p className="mt-0.5 text-sm text-zinc-600">{alert.description}</p>
                        </div>
                        {alert.actionHref && alert.actionLabel && (
                            <Link
                                href={alert.actionHref}
                                className="shrink-0 flex items-center gap-1 text-sm font-medium text-zinc-700 hover:text-zinc-900"
                            >
                                {alert.actionLabel}
                                <ArrowRight className="h-3.5 w-3.5" />
                            </Link>
                        )}
                    </div>
                );
            })}
        </div>
    );
}
