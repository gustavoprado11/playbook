'use client';

import {
    LineChart,
    Line,
    XAxis,
    YAxis,
    CartesianGrid,
    Tooltip,
    Legend,
    ResponsiveContainer,
} from 'recharts';
import type { PhysioSession } from '@/types/database';

interface PainChartProps {
    sessions: PhysioSession[];
}

export function PainChart({ sessions }: PainChartProps) {
    const data = sessions
        .filter((s) => {
            const evo = Array.isArray(s.evolution) ? s.evolution[0] : s.evolution;
            return evo && (evo.pain_before !== null || evo.pain_after !== null);
        })
        .sort((a, b) => new Date(a.session_date).getTime() - new Date(b.session_date).getTime())
        .map((s) => {
            const evo = Array.isArray(s.evolution) ? s.evolution[0] : s.evolution;
            return {
                date: new Date(s.session_date).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' }),
                'Dor Antes': evo?.pain_before ?? null,
                'Dor Depois': evo?.pain_after ?? null,
            };
        });

    if (data.length === 0) {
        return (
            <div className="flex h-48 items-center justify-center text-sm text-zinc-400">
                Sem dados de dor registrados
            </div>
        );
    }

    return (
        <ResponsiveContainer width="100%" height={300}>
            <LineChart data={data} margin={{ top: 5, right: 20, left: 0, bottom: 5 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e4e4e7" />
                <XAxis dataKey="date" tick={{ fontSize: 12 }} stroke="#a1a1aa" />
                <YAxis domain={[0, 10]} tick={{ fontSize: 12 }} stroke="#a1a1aa" />
                <Tooltip />
                <Legend />
                <Line
                    type="monotone"
                    dataKey="Dor Antes"
                    stroke="#ef4444"
                    strokeWidth={2}
                    dot={{ r: 4 }}
                    connectNulls
                />
                <Line
                    type="monotone"
                    dataKey="Dor Depois"
                    stroke="#22c55e"
                    strokeWidth={2}
                    dot={{ r: 4 }}
                    connectNulls
                />
            </LineChart>
        </ResponsiveContainer>
    );
}
