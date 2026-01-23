import { StudentAssessment, AssessmentResult } from '@/types/database';

export interface MetricEvolution {
    metricId: string;
    metricName: string;
    unit: string;
    currentValue: number;
    previousValue: number | null;
    diff: number | null;
    trend: 'up' | 'down' | 'stable' | 'new';
}

export interface ProtocolGroup {
    protocolId: string;
    protocolName: string;
    pillar: string;
    assessments: StudentAssessment[];
    latestEvolution: MetricEvolution[];
}

export function processAssessmentHistory(assessments: StudentAssessment[]): ProtocolGroup[] {
    // 1. Group by Protocol
    const groups: Record<string, ProtocolGroup> = {};

    assessments.forEach(assessment => {
        const pId = assessment.protocol_id;
        if (!groups[pId]) {
            groups[pId] = {
                protocolId: pId,
                protocolName: assessment.protocol?.name || 'Unknown',
                pillar: assessment.protocol?.pillar || 'general',
                assessments: [],
                latestEvolution: []
            };
        }
        groups[pId].assessments.push(assessment);
    });

    // 2. Process each group
    return Object.values(groups).map(group => {
        // Ensure sorted descending by date
        group.assessments.sort((a, b) =>
            new Date(b.performed_at).getTime() - new Date(a.performed_at).getTime()
        );

        // Calculate evolution for the latest assessment
        if (group.assessments.length > 0) {
            const latest = group.assessments[0];
            const previous = group.assessments.length > 1 ? group.assessments[1] : null;

            group.latestEvolution = (latest.results || []).map(result => {
                const metricName = result.metric?.name || 'Unknown';
                const unit = result.metric?.unit || '';

                let previousValue: number | null = null;
                let diff: number | null = null;
                let trend: MetricEvolution['trend'] = 'new';

                if (previous && previous.results) {
                    const prevResult = previous.results.find(r => r.metric_id === result.metric_id);
                    if (prevResult) {
                        previousValue = prevResult.value;
                        diff = parseFloat((result.value - prevResult.value).toFixed(2));

                        if (diff > 0) trend = 'up';
                        else if (diff < 0) trend = 'down';
                        else trend = 'stable';
                    }
                }

                return {
                    metricId: result.metric_id,
                    metricName,
                    unit,
                    currentValue: result.value,
                    previousValue,
                    diff,
                    trend
                };
            }).sort((a, b) => a.metricName.localeCompare(b.metricName)); // Or use display_order if available? 
            // result.metric doesn't have display_order in the type definition in Join usually without explicit check, 
            // but let's assume alphabetical or accept current order. Ideally backend sorts results.
        }

        return group;
    });
}

export function getManagementStatus(assessments: StudentAssessment[]) {
    if (assessments.length === 0) return 'pending';

    const latestDate = new Date(assessments[0].performed_at);
    const now = new Date();
    const diffTime = Math.abs(now.getTime() - latestDate.getTime());
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

    // Simple rule: Late if > 45 days (example, can be adjusted)
    // Or if "Management" KPI requires monthly, then > 30 days is "Late".
    // Let's use 30 days as a standard "on track" window.
    if (diffDays <= 30) return 'on_track';
    if (diffDays <= 60) return 'warning';
    return 'late';
}
