import { createClient } from '@/lib/supabase/server';
import { getProfile } from '@/app/actions/auth';
import { redirect } from 'next/navigation';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { formatCurrency, formatDate } from '@/lib/utils';
import { Settings, CheckCircle2, Plus, Info, FileText } from 'lucide-react';
import Link from 'next/link';
import type { GameRule } from '@/types/database';

async function getGameRules() {
    const supabase = await createClient();

    const { data } = await supabase
        .from('game_rules')
        .select('*')
        .order('effective_from', { ascending: false });

    return (data || []) as GameRule[];
}

export default async function ManagerRulesPage() {
    const profile = await getProfile();

    if (!profile || profile.role !== 'manager') {
        redirect('/dashboard');
    }

    const rules = await getGameRules();
    const activeRule = rules.find(r => r.is_active);

    return (
        <div className="space-y-6">
            {/* Header */}
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-2xl font-bold text-zinc-900">Política de Incentivos</h1>
                    <p className="mt-1 text-zinc-500">
                        Configuração de critérios de performance e remuneração variável
                    </p>
                </div>
                {rules.length > 0 && (
                    <Link href="/dashboard/manager/rules/new">
                        <Button className="gap-2">
                            <Plus className="h-4 w-4" />
                            Criar nova política
                        </Button>
                    </Link>
                )}
            </div>

            {/* Empty State - No policy configured */}
            {rules.length === 0 ? (
                <Card className="border-dashed">
                    <CardContent className="flex flex-col items-center justify-center py-16">
                        <div className="rounded-full bg-zinc-100 p-4 mb-4">
                            <FileText className="h-8 w-8 text-zinc-400" />
                        </div>
                        <h3 className="text-lg font-semibold text-zinc-900">
                            Nenhuma política de incentivos configurada
                        </h3>
                        <p className="mt-2 text-center text-zinc-500 max-w-md">
                            Para calcular recompensas e acompanhar performance, é necessário criar a primeira política de incentivos do estúdio.
                        </p>
                        <Link href="/dashboard/manager/rules/new" className="mt-6">
                            <Button size="lg" className="gap-2">
                                <Plus className="h-5 w-5" />
                                Criar política de incentivos
                            </Button>
                        </Link>
                    </CardContent>
                </Card>
            ) : (
                <>
                    {/* Disclaimer */}
                    <div className="rounded-xl border border-zinc-200 bg-zinc-50 p-4">
                        <div className="flex gap-3">
                            <Info className="h-5 w-5 text-zinc-500 shrink-0 mt-0.5" />
                            <div className="text-sm text-zinc-600">
                                <p>
                                    Esta política define os critérios de performance e como a remuneração variável é calculada.
                                    Alterações criam uma nova versão e passam a valer a partir da data definida, sem impacto em períodos já finalizados.
                                </p>
                            </div>
                        </div>
                    </div>

                    {/* Active Policy */}
                    {activeRule ? (
                        <Card className="border-emerald-200 bg-emerald-50/50">
                            <CardHeader>
                                <div className="flex items-center justify-between">
                                    <div className="flex items-center gap-2">
                                        <CheckCircle2 className="h-5 w-5 text-emerald-600" />
                                        <CardTitle className="text-emerald-900">Política Vigente: {activeRule.name}</CardTitle>
                                    </div>
                                    <span className="inline-flex items-center rounded-full bg-emerald-100 px-3 py-1 text-xs font-medium text-emerald-700">
                                        Em vigor desde {formatDate(activeRule.effective_from)}
                                    </span>
                                </div>
                                {activeRule.description && (
                                    <CardDescription>{activeRule.description}</CardDescription>
                                )}
                            </CardHeader>
                            <CardContent>
                                <div className="grid gap-6 md:grid-cols-2">
                                    {/* General Config */}
                                    <div>
                                        <h4 className="mb-3 text-sm font-medium text-zinc-900">Configuração Geral</h4>
                                        <div className="space-y-2 text-sm rounded-lg border border-zinc-200 bg-white p-4">
                                            <div className="flex justify-between">
                                                <span className="text-zinc-500">Tipo de cálculo:</span>
                                                <span className="font-medium text-zinc-900">
                                                    {activeRule.calculation_type === 'fixed' ? 'Valor Fixo por KPI' : 'Percentual do Valor Base'}
                                                </span>
                                            </div>
                                            {activeRule.calculation_type === 'weighted' && (
                                                <div className="flex justify-between">
                                                    <span className="text-zinc-500">Valor base:</span>
                                                    <span className="font-medium text-zinc-900">
                                                        {formatCurrency(activeRule.base_reward_amount)}
                                                    </span>
                                                </div>
                                            )}
                                            <div className="flex justify-between">
                                                <span className="text-zinc-500">Carteira mínima:</span>
                                                <span className="font-medium text-zinc-900">
                                                    {activeRule.kpi_config.min_portfolio_size} alunos
                                                </span>
                                            </div>
                                            <div className="flex justify-between">
                                                <span className="text-zinc-500">Validação indicação:</span>
                                                <span className="font-medium text-zinc-900">
                                                    {activeRule.kpi_config.referral_validation_days} dias
                                                </span>
                                            </div>
                                        </div>
                                    </div>

                                    {/* KPIs */}
                                    <div>
                                        <h4 className="mb-3 text-sm font-medium text-zinc-900">Indicadores & Metas</h4>
                                        <div className="space-y-3">
                                            {/* Retention */}
                                            <div className={`rounded-lg border p-3 ${activeRule.kpi_config.retention.enabled
                                                    ? 'border-zinc-200 bg-white'
                                                    : 'border-zinc-100 bg-zinc-50 opacity-60'
                                                }`}>
                                                <div className="flex items-center justify-between">
                                                    <span className="font-medium text-zinc-900">Retenção</span>
                                                    <span className={`text-xs px-2 py-0.5 rounded-full ${activeRule.kpi_config.retention.enabled
                                                            ? 'bg-emerald-100 text-emerald-700'
                                                            : 'bg-zinc-100 text-zinc-500'
                                                        }`}>
                                                        {activeRule.kpi_config.retention.enabled ? 'Ativo' : 'Desativado'}
                                                    </span>
                                                </div>
                                                {activeRule.kpi_config.retention.enabled && (
                                                    <div className="mt-2 grid grid-cols-2 gap-2 text-xs">
                                                        <div>
                                                            <span className="text-zinc-500">Meta:</span>
                                                            <span className="ml-1 font-medium">{activeRule.kpi_config.retention.target}%</span>
                                                        </div>
                                                        {activeRule.calculation_type === 'weighted' ? (
                                                            <div>
                                                                <span className="text-zinc-500">Peso:</span>
                                                                <span className="ml-1 font-medium">{activeRule.kpi_config.retention.weight}%</span>
                                                            </div>
                                                        ) : (
                                                            <div>
                                                                <span className="text-zinc-500">Valor:</span>
                                                                <span className="ml-1 font-medium">{formatCurrency(activeRule.kpi_config.retention.fixed_value)}</span>
                                                            </div>
                                                        )}
                                                    </div>
                                                )}
                                            </div>

                                            {/* Referrals */}
                                            <div className={`rounded-lg border p-3 ${activeRule.kpi_config.referrals.enabled
                                                    ? 'border-zinc-200 bg-white'
                                                    : 'border-zinc-100 bg-zinc-50 opacity-60'
                                                }`}>
                                                <div className="flex items-center justify-between">
                                                    <span className="font-medium text-zinc-900">Indicações</span>
                                                    <span className={`text-xs px-2 py-0.5 rounded-full ${activeRule.kpi_config.referrals.enabled
                                                            ? 'bg-emerald-100 text-emerald-700'
                                                            : 'bg-zinc-100 text-zinc-500'
                                                        }`}>
                                                        {activeRule.kpi_config.referrals.enabled ? 'Ativo' : 'Desativado'}
                                                    </span>
                                                </div>
                                                {activeRule.kpi_config.referrals.enabled && (
                                                    <div className="mt-2 grid grid-cols-2 gap-2 text-xs">
                                                        <div>
                                                            <span className="text-zinc-500">Meta:</span>
                                                            <span className="ml-1 font-medium">≥{activeRule.kpi_config.referrals.target}</span>
                                                        </div>
                                                        {activeRule.calculation_type === 'weighted' ? (
                                                            <div>
                                                                <span className="text-zinc-500">Peso:</span>
                                                                <span className="ml-1 font-medium">{activeRule.kpi_config.referrals.weight}%</span>
                                                            </div>
                                                        ) : (
                                                            <div>
                                                                <span className="text-zinc-500">Valor:</span>
                                                                <span className="ml-1 font-medium">{formatCurrency(activeRule.kpi_config.referrals.fixed_value)}</span>
                                                            </div>
                                                        )}
                                                    </div>
                                                )}
                                            </div>

                                            {/* Management */}
                                            <div className={`rounded-lg border p-3 ${activeRule.kpi_config.management.enabled
                                                    ? 'border-zinc-200 bg-white'
                                                    : 'border-zinc-100 bg-zinc-50 opacity-60'
                                                }`}>
                                                <div className="flex items-center justify-between">
                                                    <span className="font-medium text-zinc-900">Gestão de Resultados</span>
                                                    <span className={`text-xs px-2 py-0.5 rounded-full ${activeRule.kpi_config.management.enabled
                                                            ? 'bg-emerald-100 text-emerald-700'
                                                            : 'bg-zinc-100 text-zinc-500'
                                                        }`}>
                                                        {activeRule.kpi_config.management.enabled ? 'Ativo' : 'Desativado'}
                                                    </span>
                                                </div>
                                                {activeRule.kpi_config.management.enabled && (
                                                    <div className="mt-2 grid grid-cols-2 gap-2 text-xs">
                                                        <div>
                                                            <span className="text-zinc-500">Meta:</span>
                                                            <span className="ml-1 font-medium">{activeRule.kpi_config.management.target}%</span>
                                                        </div>
                                                        {activeRule.calculation_type === 'weighted' ? (
                                                            <div>
                                                                <span className="text-zinc-500">Peso:</span>
                                                                <span className="ml-1 font-medium">{activeRule.kpi_config.management.weight}%</span>
                                                            </div>
                                                        ) : (
                                                            <div>
                                                                <span className="text-zinc-500">Valor:</span>
                                                                <span className="ml-1 font-medium">{formatCurrency(activeRule.kpi_config.management.fixed_value)}</span>
                                                            </div>
                                                        )}
                                                    </div>
                                                )}
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            </CardContent>
                        </Card>
                    ) : (
                        <Card className="border-amber-200 bg-amber-50">
                            <CardContent className="flex flex-col items-center justify-center py-8">
                                <p className="text-amber-800 font-medium">Nenhuma política ativa</p>
                                <p className="text-sm text-amber-600 mt-1">
                                    Existe(m) política(s) cadastrada(s), mas nenhuma está em vigor atualmente.
                                </p>
                            </CardContent>
                        </Card>
                    )}

                    {/* Policy History */}
                    <Card>
                        <CardHeader>
                            <CardTitle>Histórico de Políticas</CardTitle>
                            <CardDescription>
                                Todas as versões criadas. Políticas anteriores não podem ser editadas.
                            </CardDescription>
                        </CardHeader>
                        <CardContent>
                            <div className="space-y-2">
                                {rules.map((rule) => (
                                    <div
                                        key={rule.id}
                                        className={`flex items-center justify-between rounded-lg border p-4 ${rule.is_active ? 'border-emerald-200 bg-emerald-50/50' : 'border-zinc-200 bg-zinc-50'
                                            }`}
                                    >
                                        <div className="flex items-center gap-3">
                                            <Settings className={`h-5 w-5 ${rule.is_active ? 'text-emerald-600' : 'text-zinc-400'}`} />
                                            <div>
                                                <p className="font-medium text-zinc-900">{rule.name}</p>
                                                <p className="text-xs text-zinc-500">
                                                    Vigência: {formatDate(rule.effective_from)}
                                                    {rule.effective_until && ` até ${formatDate(rule.effective_until)}`}
                                                </p>
                                            </div>
                                        </div>
                                        <div className="flex items-center gap-2">
                                            <span className={`rounded-full px-2 py-1 text-xs font-medium ${rule.calculation_type === 'fixed'
                                                    ? 'bg-blue-100 text-blue-700'
                                                    : 'bg-purple-100 text-purple-700'
                                                }`}>
                                                {rule.calculation_type === 'fixed' ? 'Fixo' : 'Percentual'}
                                            </span>
                                            {rule.is_active ? (
                                                <span className="rounded-full bg-emerald-100 px-2 py-1 text-xs font-medium text-emerald-700">
                                                    Vigente
                                                </span>
                                            ) : (
                                                <span className="rounded-full bg-zinc-100 px-2 py-1 text-xs font-medium text-zinc-500">
                                                    Inativa
                                                </span>
                                            )}
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </CardContent>
                    </Card>
                </>
            )}
        </div>
    );
}
