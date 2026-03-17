import { createAdminClient } from '@/lib/supabase/admin';
import { format, subMonths } from 'date-fns';
import { NextRequest, NextResponse } from 'next/server';

export async function GET(request: NextRequest) {
    // Verify CRON_SECRET
    const authHeader = request.headers.get('authorization');
    if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const adminClient = createAdminClient();

    // Calculate previous month
    const previousMonth = subMonths(new Date(), 1);
    const referenceMonth = format(previousMonth, 'yyyy-MM-dd');

    // Check if already finalized (idempotent)
    const { data: existing } = await adminClient
        .from('performance_snapshots')
        .select('id')
        .eq('reference_month', format(previousMonth, 'yyyy-MM-01'))
        .eq('is_finalized', true)
        .limit(1);

    if (existing && existing.length > 0) {
        return NextResponse.json({
            month: referenceMonth,
            status: 'already_finalized',
            message: 'Snapshots already finalized for this month',
        });
    }

    // Get all active trainers
    const { data: trainers, error: trainersError } = await adminClient
        .from('trainers')
        .select('id')
        .eq('is_active', true);

    if (trainersError || !trainers || trainers.length === 0) {
        return NextResponse.json({
            month: referenceMonth,
            status: 'no_trainers',
            error: trainersError?.message || 'No active trainers found',
        }, { status: trainersError ? 500 : 200 });
    }

    // Generate and finalize snapshots for each trainer
    const results = await Promise.all(
        trainers.map(async (trainer) => {
            try {
                // Generate snapshot
                const { error: genError } = await adminClient.rpc(
                    'generate_performance_snapshot',
                    {
                        p_trainer_id: trainer.id,
                        p_reference_month: referenceMonth,
                    }
                );

                if (genError) {
                    return { trainerId: trainer.id, error: genError.message };
                }

                // Finalize snapshot (use a system UUID for finalized_by)
                const { error: finError } = await adminClient
                    .from('performance_snapshots')
                    .update({
                        is_finalized: true,
                        finalized_at: new Date().toISOString(),
                    })
                    .eq('trainer_id', trainer.id)
                    .eq('reference_month', format(previousMonth, 'yyyy-MM-01'))
                    .eq('is_finalized', false);

                if (finError) {
                    return { trainerId: trainer.id, error: finError.message };
                }

                return { trainerId: trainer.id, success: true };
            } catch (e) {
                return { trainerId: trainer.id, error: String(e) };
            }
        })
    );

    const succeeded = results.filter((r) => 'success' in r && r.success);
    const failed = results.filter((r) => 'error' in r && r.error);

    return NextResponse.json({
        month: referenceMonth,
        status: failed.length > 0 ? 'partial' : 'success',
        snapshots_generated: succeeded.length,
        errors: failed.length > 0 ? failed : undefined,
    });
}
