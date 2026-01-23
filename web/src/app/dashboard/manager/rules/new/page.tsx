import { createClient } from '@/lib/supabase/server';
import { getProfile } from '@/app/actions/auth';
import { redirect } from 'next/navigation';
import { NewRuleForm } from './form';
import type { GameRule } from '@/types/database';

async function getActiveRule() {
    const supabase = await createClient();

    const { data } = await supabase
        .from('game_rules')
        .select('*')
        .eq('is_active', true)
        .single();

    return data as GameRule | null;
}

async function hasAnyRules() {
    const supabase = await createClient();

    const { count } = await supabase
        .from('game_rules')
        .select('*', { count: 'exact', head: true });

    return (count || 0) > 0;
}

export default async function NewRulePage() {
    const profile = await getProfile();

    if (!profile || profile.role !== 'manager') {
        redirect('/dashboard');
    }

    const [activeRule, hasRules] = await Promise.all([
        getActiveRule(),
        hasAnyRules(),
    ]);

    return (
        <div className="max-w-3xl mx-auto space-y-6">
            <NewRuleForm activeRule={activeRule} isFirstPolicy={!hasRules} />
        </div>
    );
}
