'use server';

import { createClient } from '@/lib/supabase/server';
import { getProfile } from '@/app/actions/auth';
import { redirect } from 'next/navigation';
import { revalidatePath } from 'next/cache';
import type { CreateGameRuleInput, KPIConfig } from '@/types/database';

export async function createGameRule(formData: FormData) {
    const profile = await getProfile();
    if (!profile || profile.role !== 'manager') {
        return { error: 'Não autorizado' };
    }

    const supabase = await createClient();

    const name = formData.get('name') as string;
    const description = formData.get('description') as string || null;
    const effective_from = formData.get('effective_from') as string;
    const calculation_type = formData.get('calculation_type') as 'fixed' | 'weighted';
    const base_reward_amount = parseFloat(formData.get('base_reward_amount') as string) || 500;

    // Parse KPI config
    const kpi_config: KPIConfig = {
        min_portfolio_size: parseInt(formData.get('min_portfolio_size') as string) || 5,
        referral_validation_days: parseInt(formData.get('referral_validation_days') as string) || 30,
        retention: {
            enabled: formData.get('retention_enabled') === 'on',
            target: parseFloat(formData.get('retention_target') as string) || 90,
            weight: parseInt(formData.get('retention_weight') as string) || 40,
            fixed_value: parseFloat(formData.get('retention_fixed_value') as string) || 200,
        },
        referrals: {
            enabled: formData.get('referrals_enabled') === 'on',
            target: parseInt(formData.get('referrals_target') as string) || 1,
            weight: parseInt(formData.get('referrals_weight') as string) || 30,
            fixed_value: parseFloat(formData.get('referrals_fixed_value') as string) || 150,
        },
        management: {
            enabled: formData.get('management_enabled') === 'on',
            target: parseFloat(formData.get('management_target') as string) || 75,
            weight: parseInt(formData.get('management_weight') as string) || 30,
            fixed_value: parseFloat(formData.get('management_fixed_value') as string) || 150,
        },
    };

    // Deactivate current active rule if the new one starts today or in the past
    const today = new Date().toISOString().split('T')[0];
    const shouldActivate = effective_from <= today;

    if (shouldActivate) {
        await supabase
            .from('game_rules')
            .update({ is_active: false })
            .eq('is_active', true);
    }

    // Create new rule
    const { error } = await supabase
        .from('game_rules')
        .insert({
            name,
            description,
            effective_from,
            calculation_type,
            kpi_config,
            base_reward_amount,
            is_active: shouldActivate,
            created_by: profile.id,
        });

    if (error) {
        return { error: error.message };
    }

    revalidatePath('/dashboard/manager/rules');
    redirect('/dashboard/manager/rules');
}

export async function activateGameRule(ruleId: string) {
    const profile = await getProfile();
    if (!profile || profile.role !== 'manager') {
        return { error: 'Não autorizado' };
    }

    const supabase = await createClient();

    // Deactivate all rules
    await supabase
        .from('game_rules')
        .update({ is_active: false })
        .eq('is_active', true);

    // Activate the specified rule
    const { error } = await supabase
        .from('game_rules')
        .update({ is_active: true })
        .eq('id', ruleId);

    if (error) {
        return { error: error.message };
    }

    revalidatePath('/dashboard/manager/rules');
    return { success: true };
}
