'use client';

import {
    ResponsiveContainer,
    LineChart,
    Line,
    XAxis,
    YAxis,
    CartesianGrid,
    Tooltip,
    Legend,
} from 'recharts';

const CHART_COLORS = ['#10b981', '#3b82f6', '#f59e0b', '#ef4444', '#8b5cf6'];

export type MetricChartData = {
    date: string;
    fullDate: string;
    [metricName: string]: number | string;
};

export type MetricInfo = {
    name: string;
    unit: string;
    color: string;
};

type Props = {
    data: MetricChartData[];
    metrics: MetricInfo[];
    protocolName: string;
};

function CustomTooltip({ active, payload, label }: any) {
    if (!active || !payload?.length) return null;

    const fullDate = payload[0]?.payload?.fullDate || label;

    return (
        <div className="rounded-lg border border-zinc-200 bg-white px-3 py-2 shadow-md">
            <p className="text-xs font-medium text-zinc-500 mb-1">{fullDate}</p>
            {payload.map((entry: any, i: number) => (
                <p key={i} className="text-sm" style={{ color: entry.color }}>
                    {entry.name}: <span className="font-semibold">{entry.value}</span>
                </p>
            ))}
        </div>
    );
}

export function MetricEvolutionChart({ data, metrics, protocolName }: Props) {
    if (data.length < 2) {
        return (
            <div className="rounded-lg border border-dashed border-zinc-200 bg-zinc-50 px-4 py-6 text-center">
                <p className="text-sm text-zinc-400">
                    Registre mais avaliações para visualizar a evolução.
                </p>
            </div>
        );
    }

    const hasMultipleAxes = metrics.length >= 2;

    return (
        <div className="rounded-lg border border-zinc-100 bg-white p-4">
            <ResponsiveContainer width="100%" height={250}>
                <LineChart data={data} margin={{ top: 5, right: hasMultipleAxes ? 10 : 20, left: 0, bottom: 5 }}>
                    <CartesianGrid strokeDasharray="3 3" opacity={0.3} />
                    <XAxis
                        dataKey="date"
                        tick={{ fontSize: 12, fill: '#71717a' }}
                        tickLine={false}
                        axisLine={{ stroke: '#e4e4e7' }}
                    />
                    <YAxis
                        yAxisId="left"
                        tick={{ fontSize: 12, fill: '#71717a' }}
                        tickLine={false}
                        axisLine={false}
                        width={50}
                        unit={` ${metrics[0].unit}`}
                    />
                    {hasMultipleAxes && (
                        <YAxis
                            yAxisId="right"
                            orientation="right"
                            tick={{ fontSize: 12, fill: '#71717a' }}
                            tickLine={false}
                            axisLine={false}
                            width={60}
                            unit={` ${metrics[1].unit}`}
                        />
                    )}
                    <Tooltip content={<CustomTooltip />} />
                    <Legend
                        wrapperStyle={{ fontSize: 12, color: '#71717a' }}
                        iconType="line"
                    />
                    {metrics.map((metric, i) => (
                        <Line
                            key={metric.name}
                            yAxisId={hasMultipleAxes && i >= 1 ? 'right' : 'left'}
                            type="monotone"
                            dataKey={metric.name}
                            name={`${metric.name} (${metric.unit})`}
                            stroke={metric.color}
                            strokeWidth={2}
                            dot={{ r: 4, fill: metric.color }}
                            activeDot={{ r: 6 }}
                        />
                    ))}
                </LineChart>
            </ResponsiveContainer>
        </div>
    );
}
