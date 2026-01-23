import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { ArrowUp, ArrowDown, Minus } from 'lucide-react';
import type { MetricEvolution } from '@/lib/assessment-logic';

interface EvolutionSummaryProps {
    evolution: MetricEvolution[];
    protocolName: string;
}

export function EvolutionSummary({ evolution, protocolName }: EvolutionSummaryProps) {
    if (evolution.length === 0) return null;

    return (
        <Card className="border-zinc-200 shadow-sm">
            <CardHeader className="py-4">
                <CardTitle className="text-sm font-medium text-zinc-500 uppercase tracking-wider">
                    Evolução Recente: {protocolName}
                </CardTitle>
            </CardHeader>
            <CardContent className="pb-4">
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                    {evolution.map((metric) => (
                        <div key={metric.metricId} className="space-y-1">
                            <p className="text-xs text-zinc-500 truncate" title={metric.metricName}>
                                {metric.metricName}
                            </p>
                            <div className="flex items-baseline gap-2">
                                <span className="text-xl font-bold text-zinc-900">
                                    {metric.currentValue}
                                    <span className="text-xs font-normal text-zinc-400 ml-1">{metric.unit}</span>
                                </span>

                                {metric.trend !== 'new' && metric.diff !== null && (
                                    <span className={`flex items-center text-xs font-medium ${metric.trend === 'up' ? 'text-emerald-600' :
                                            metric.trend === 'down' ? 'text-red-600' : 'text-zinc-500'
                                        }`}>
                                        {metric.trend === 'up' && <ArrowUp className="h-3 w-3 mr-0.5" />}
                                        {metric.trend === 'down' && <ArrowDown className="h-3 w-3 mr-0.5" />}
                                        {metric.trend === 'stable' && <Minus className="h-3 w-3 mr-0.5" />}
                                        {metric.diff > 0 ? '+' : ''}{metric.diff}
                                    </span>
                                )}
                            </div>
                        </div>
                    ))}
                </div>
            </CardContent>
        </Card>
    );
}
