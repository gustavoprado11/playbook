'use server';

import { createClient } from '@/lib/supabase/server';
import { getProfile } from '@/app/actions/auth';

export async function updateResultManagement(
    studentId: string,
    referenceMonth: string,
    data: {
        has_initial_assessment: boolean;
        has_reassessment: boolean;
        has_documented_result: boolean;
    }
) {
    const profile = await getProfile();
    if (!profile) {
        return { error: 'Não autorizado' };
    }

    const supabase = await createClient();

    const { error } = await supabase
        .from('result_management')
        .upsert(
            {
                student_id: studentId,
                reference_month: referenceMonth,
                has_initial_assessment: data.has_initial_assessment,
                has_reassessment: data.has_reassessment,
                has_documented_result: data.has_documented_result,
                updated_by: profile.id,
            },
            {
                onConflict: 'student_id,reference_month',
            }
        );

    if (error) {
        return { error: error.message };
    }

    return { success: true };
}
