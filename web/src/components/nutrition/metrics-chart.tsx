'use client';

import { useState } from 'react';
import {
    LineChart,
    Line,
    XAxis,
    YAxis,
    CartesianGrid,
    Tooltip,
    ResponsiveContainer,
    Legend,
} from 'recharts';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { formatDate } from '@/lib/utils';
import type { NutritionConsultation } from '@/types/database';

interface MetricsChartProps {
    consultations: NutritionConsultation[];
}

type MetricKey = 'weight_kg' | 'body_fat_pct' | 'lean_mass_kg' | 'bmi';

const metricOptions: { key: MetricKey; label: string; color: string; unit: string }[] = [
    { key: 'weight_kg', label: 'Peso (kg)', color: '#10b981', unit: 'kg' },
    { key: 'body_fat_pct', label: '% Gordura', color: '#f59e0b', unit: '%' },
    { key: 'lean_mass_kg', label: 'Massa Magra (kg)', color: '#3b82f6', unit: 'kg' },
    { key: 'bmi', label: 'IMC', color: '#8b5cf6', unit: '' },
];

export function MetricsChart({ consultations }: MetricsChartProps) {
    const [activeMetrics, setActiveMetrics] = useState<MetricKey[]>(['weight_kg']);

    const data = consultations
        .filter((c) => c.metrics)
        .sort((a, b) => new Date(a.consultation_date).getTime() - new Date(b.consultation_date).getTime())
        .map((c) => ({
            date: formatDate(c.consultation_date),
            weight_kg: c.metrics?.weight_kg ?? null,
            body_fat_pct: c.metrics?.body_fat_pct ?? null,
            lean_mass_kg: c.metrics?.lean_mass_kg ?? null,
            bmi: c.metrics?.bmi ?? null,
        }));

    const toggleMetric = (key: MetricKey) => {
        setActiveMetrics((prev) =>
            prev.includes(key) ? prev.filter((k) => k !== key) : [...prev, key]
        );
    };

    if (data.length === 0) {
        return (
            <Card>
                <CardContent className="py-8 text-center text-zinc-500 text-sm">
                    Nenhuma métrica registrada para gerar o gráfico.
                </CardContent>
            </Card>
        );
    }

    return (
        <Card>
            <CardHeader className="pb-2">
                <CardTitle className="text-base font-medium text-zinc-900">Evolução Corporal</CardTitle>
                <div className="flex flex-wrap gap-2 mt-2">
                    {metricOptions.map((m) => (
                        <Button
                            key={m.key}
                            variant={activeMetrics.includes(m.key) ? 'default' : 'outline'}
                            size="sm"
                            onClick={() => toggleMetric(m.key)}
                            className="text-xs"
                        >
                            {m.label}
                        </Button>
                    ))}
                </div>
            </CardHeader>
            <CardContent>
                <div className="h-[300px] w-full">
                    <ResponsiveContainer width="100%" height="100%">
                        <LineChart data={data} margin={{ top: 5, right: 20, left: 0, bottom: 5 }}>
                            <CartesianGrid strokeDasharray="3 3" stroke="#e4e4e7" />
                            <XAxis dataKey="date" tick={{ fontSize: 12 }} stroke="#a1a1aa" />
                            <YAxis tick={{ fontSize: 12 }} stroke="#a1a1aa" />
                            <Tooltip
                                contentStyle={{ borderRadius: 8, border: '1px solid #e4e4e7', fontSize: 13 }}
                            />
                            <Legend />
                            {metricOptions
                                .filter((m) => activeMetrics.includes(m.key))
                                .map((m) => (
                                    <Line
                                        key={m.key}
                                        type="monotone"
                                        dataKey={m.key}
                                        name={m.label}
                                        stroke={m.color}
                                        strokeWidth={2}
                                        dot={{ r: 4 }}
                                        connectNulls
                                    />
                                ))}
                        </LineChart>
                    </ResponsiveContainer>
                </div>
            </CardContent>
        </Card>
    );
}
