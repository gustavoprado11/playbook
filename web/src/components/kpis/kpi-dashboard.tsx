'use client';

import { Button } from '@/components/ui/button';
import { FileText, Table2 } from 'lucide-react';
import { KPIHighlights } from './kpi-highlights';
import { CoverageChart } from './coverage-chart';
import { EngagementCards } from './engagement-cards';
import { RetentionComparison } from './retention-comparison';
import { MetricTrendsPanel } from './metric-trends-panel';
import { exportKPIsPDF, exportKPIsXLSX } from '@/lib/export-utils';
import type { CrossDisciplineKPIs } from '@/app/actions/kpis';

interface Props {
    kpis: CrossDisciplineKPIs;
}

export function KPIDashboard({ kpis }: Props) {
    return (
        <div className="space-y-8">
            {/* Export buttons */}
            <div className="flex justify-end gap-2">
                <Button variant="outline" size="sm" onClick={() => exportKPIsPDF(kpis)}>
                    <FileText className="mr-1.5 h-4 w-4" /> PDF
                </Button>
                <Button variant="outline" size="sm" onClick={() => exportKPIsXLSX(kpis)}>
                    <Table2 className="mr-1.5 h-4 w-4" /> XLSX
                </Button>
            </div>

            {/* Highlights */}
            <section>
                <h2 className="text-lg font-semibold text-zinc-900 mb-3">Destaques</h2>
                <KPIHighlights highlights={kpis.highlights} />
            </section>

            {/* Coverage */}
            <section>
                <CoverageChart coverage={kpis.coverage} />
            </section>

            {/* Engagement */}
            <section>
                <h2 className="text-lg font-semibold text-zinc-900 mb-3">Engajamento por Disciplina</h2>
                <EngagementCards engagement={kpis.engagement} />
            </section>

            {/* Retention */}
            <section>
                <RetentionComparison data={kpis.retentionCorrelation} />
            </section>

            {/* Trends */}
            <section>
                <h2 className="text-lg font-semibold text-zinc-900 mb-3">Tendências de Evolução</h2>
                <MetricTrendsPanel nutrition={kpis.metricTrends.nutrition} physio={kpis.metricTrends.physio} />
            </section>
        </div>
    );
}
