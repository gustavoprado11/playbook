'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { createGameRule } from '../actions';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';

import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { ArrowLeft, AlertCircle, Info, RefreshCw, FileText } from 'lucide-react';
import type { GameRule } from '@/types/database';
import { formatDate } from '@/lib/utils';

interface NewRuleFormProps {
    activeRule: GameRule | null;
    isFirstPolicy: boolean;
}

// Default values for each calculation type
const FIXED_DEFAULTS = {
    retention: { value: 200, weight: 40 },
    referrals: { value: 150, weight: 30 },
    management: { value: 150, weight: 30 },
};

const WEIGHTED_DEFAULTS = {
    retention: { value: 200, weight: 40 },
    referrals: { value: 150, weight: 30 },
    management: { value: 150, weight: 30 },
};

export function NewRuleForm({ activeRule, isFirstPolicy }: NewRuleFormProps) {
    const [error, setError] = useState<string | null>(null);
    const [isLoading, setIsLoading] = useState(false);
    const [showTypeChangeNotice, setShowTypeChangeNotice] = useState(false);

    // Form state
    const [calculationType, setCalculationType] = useState<'fixed' | 'weighted'>(
        activeRule?.calculation_type || 'fixed'
    );
    const [effectiveDate, setEffectiveDate] = useState(
        new Date().toISOString().split('T')[0]
    );
    const [baseRewardAmount, setBaseRewardAmount] = useState(
        activeRule?.base_reward_amount || 500
    );

    // KPI state - managed separately to allow proper reset on type change
    const [kpiState, setKpiState] = useState({
        retention: {
            enabled: activeRule?.kpi_config.retention.enabled ?? true,
            target: activeRule?.kpi_config.retention.target ?? 90,
            weight: WEIGHTED_DEFAULTS.retention.weight,
            fixed_value: FIXED_DEFAULTS.retention.value,
        },
        referrals: {
            enabled: activeRule?.kpi_config.referrals.enabled ?? true,
            target: activeRule?.kpi_config.referrals.target ?? 1,
            weight: WEIGHTED_DEFAULTS.referrals.weight,
            fixed_value: FIXED_DEFAULTS.referrals.value,
        },
        management: {
            enabled: activeRule?.kpi_config.management.enabled ?? true,
            target: activeRule?.kpi_config.management.target ?? 75,
            weight: WEIGHTED_DEFAULTS.management.weight,
            fixed_value: FIXED_DEFAULTS.management.value,
        },
    });

    // Initialize with active rule values for the current calculation type only
    useEffect(() => {
        if (activeRule) {
            const type = activeRule.calculation_type;
            setKpiState({
                retention: {
                    enabled: activeRule.kpi_config.retention.enabled,
                    target: activeRule.kpi_config.retention.target,
                    weight: type === 'weighted' ? activeRule.kpi_config.retention.weight : WEIGHTED_DEFAULTS.retention.weight,
                    fixed_value: type === 'fixed' ? activeRule.kpi_config.retention.fixed_value : FIXED_DEFAULTS.retention.value,
                },
                referrals: {
                    enabled: activeRule.kpi_config.referrals.enabled,
                    target: activeRule.kpi_config.referrals.target,
                    weight: type === 'weighted' ? activeRule.kpi_config.referrals.weight : WEIGHTED_DEFAULTS.referrals.weight,
                    fixed_value: type === 'fixed' ? activeRule.kpi_config.referrals.fixed_value : FIXED_DEFAULTS.referrals.value,
                },
                management: {
                    enabled: activeRule.kpi_config.management.enabled,
                    target: activeRule.kpi_config.management.target,
                    weight: type === 'weighted' ? activeRule.kpi_config.management.weight : WEIGHTED_DEFAULTS.management.weight,
                    fixed_value: type === 'fixed' ? activeRule.kpi_config.management.fixed_value : FIXED_DEFAULTS.management.value,
                },
            });
        }
    }, [activeRule]);

    // Handle calculation type change - RESET incompatible values
    function handleCalculationTypeChange(newType: 'fixed' | 'weighted') {
        if (newType === calculationType) return;

        setCalculationType(newType);
        setShowTypeChangeNotice(true);

        // Reset KPI values to defaults for the new type
        setKpiState(prev => ({
            retention: {
                ...prev.retention,
                weight: WEIGHTED_DEFAULTS.retention.weight,
                fixed_value: FIXED_DEFAULTS.retention.value,
            },
            referrals: {
                ...prev.referrals,
                weight: WEIGHTED_DEFAULTS.referrals.weight,
                fixed_value: FIXED_DEFAULTS.referrals.value,
            },
            management: {
                ...prev.management,
                weight: WEIGHTED_DEFAULTS.management.weight,
                fixed_value: FIXED_DEFAULTS.management.value,
            },
        }));

        // Hide notice after 5 seconds
        setTimeout(() => setShowTypeChangeNotice(false), 5000);
    }

    // Calculate weight sum for validation
    const weightSum = calculationType === 'weighted'
        ? (kpiState.retention.enabled ? kpiState.retention.weight : 0) +
        (kpiState.referrals.enabled ? kpiState.referrals.weight : 0) +
        (kpiState.management.enabled ? kpiState.management.weight : 0)
        : 100;

    const isWeightSumValid = calculationType === 'fixed' || weightSum === 100;

    const today = new Date().toISOString().split('T')[0];
    const willActivateImmediately = effectiveDate <= today;

    async function handleSubmit(formData: FormData) {
        if (!isWeightSumValid) {
            setError('A soma dos pesos dos indicadores ativos deve ser exatamente 100%.');
            return;
        }

        setIsLoading(true);
        setError(null);

        const result = await createGameRule(formData);

        if (result?.error) {
            setError(result.error);
            setIsLoading(false);
        }
    }

    return (
        <>
            <div className="flex items-center gap-4">
                <Link href="/dashboard/manager/rules">
                    <Button variant="ghost" size="icon">
                        <ArrowLeft className="h-5 w-5" />
                    </Button>
                </Link>
                <div>
                    <h1 className="text-2xl font-bold text-zinc-900">
                        {isFirstPolicy ? 'Criar Política de Incentivos' : 'Nova Versão da Política'}
                    </h1>
                    <p className="mt-1 text-zinc-500">
                        {isFirstPolicy
                            ? 'Configure a primeira política de incentivos do estúdio'
                            : activeRule
                                ? `Baseado em: ${activeRule.name}`
                                : 'Configure os critérios de performance e remuneração'}
                    </p>
                </div>
            </div>

            {/* First policy info */}
            {isFirstPolicy && (
                <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-4">
                    <div className="flex gap-3">
                        <FileText className="h-5 w-5 text-emerald-600 shrink-0 mt-0.5" />
                        <div className="text-sm text-emerald-800">
                            <p className="font-medium">Primeira política do estúdio</p>
                            <p className="mt-1">
                                Esta será a política principal de incentivos. Ela define como a remuneração variável será calculada
                                com base na performance dos treinadores.
                            </p>
                        </div>
                    </div>
                </div>
            )}

            {/* Type change notice */}
            {showTypeChangeNotice && (
                <div className="rounded-xl border border-blue-200 bg-blue-50 p-4 animate-in fade-in duration-300">
                    <div className="flex gap-3">
                        <RefreshCw className="h-5 w-5 text-blue-600 shrink-0 mt-0.5" />
                        <div className="text-sm text-blue-800">
                            <p className="font-medium">Campos ajustados</p>
                            <p className="mt-1">
                                Os campos dos indicadores foram reinicializados para o tipo de cálculo selecionado.
                                {calculationType === 'weighted'
                                    ? ' Configure os pesos (%) de cada indicador.'
                                    : ' Configure os valores (R$) de cada indicador.'}
                            </p>
                        </div>
                    </div>
                </div>
            )}

            {/* Activation warning - only show if not first policy */}
            {!isFirstPolicy && (
                <div className={`rounded-xl border p-4 ${willActivateImmediately
                    ? 'border-amber-200 bg-amber-50'
                    : 'border-zinc-200 bg-zinc-50'
                    }`}>
                    <div className="flex gap-3">
                        <AlertCircle className={`h-5 w-5 shrink-0 mt-0.5 ${willActivateImmediately ? 'text-amber-600' : 'text-zinc-500'
                            }`} />
                        <div className={`text-sm ${willActivateImmediately ? 'text-amber-800' : 'text-zinc-600'}`}>
                            {willActivateImmediately ? (
                                <>
                                    <p className="font-medium">Esta política será ativada imediatamente</p>
                                    <p className="mt-1">
                                        Como a data de vigência é hoje ou anterior, esta política substituirá a atual assim que for salva.
                                    </p>
                                </>
                            ) : (
                                <>
                                    <p className="font-medium">Esta política será aplicada a partir de {formatDate(effectiveDate)}</p>
                                    <p className="mt-1">A política atual permanecerá vigente até a data definida.</p>
                                </>
                            )}
                        </div>
                    </div>
                </div>
            )}

            <form action={handleSubmit}>
                {/* Basic Info */}
                <Card className="mb-6">
                    <CardHeader>
                        <CardTitle>Identificação</CardTitle>
                        <CardDescription>Nome e vigência desta política</CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-4">
                        <Input
                            name="name"
                            label="Nome da política"
                            placeholder="ex: Política de Incentivos 2024"
                            defaultValue={isFirstPolicy ? '' : activeRule ? `${activeRule.name} (v2)` : ''}
                            required
                        />

                        <div className="w-full">
                            <label className="mb-1.5 block text-sm font-medium text-zinc-700">
                                Descrição (opcional)
                            </label>
                            <textarea
                                name="description"
                                rows={2}
                                className="flex w-full rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm transition-colors placeholder:text-zinc-400 focus:border-emerald-500 focus:outline-none focus:ring-2 focus:ring-emerald-500/20"
                                placeholder="Descreva as principais características desta política..."
                            />
                        </div>

                        <Input
                            name="effective_from"
                            type="date"
                            label="Data de início da vigência"
                            value={effectiveDate}
                            onChange={(e) => setEffectiveDate(e.target.value)}
                            required
                        />
                    </CardContent>
                </Card>

                {/* General Config */}
                <Card className="mb-6">
                    <CardHeader>
                        <CardTitle>Modelo de Cálculo</CardTitle>
                        <CardDescription>Tipo de cálculo e critérios de elegibilidade</CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-4">
                        <div className="space-y-2">
                            <Label>Tipo de cálculo</Label>
                            <Select
                                name="calculation_type"
                                value={calculationType}
                                onValueChange={(value) => handleCalculationTypeChange(value as 'fixed' | 'weighted')}
                            >
                                <SelectTrigger>
                                    <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="fixed">Valor Fixo por Indicador</SelectItem>
                                    <SelectItem value="weighted">Percentual do Valor Base</SelectItem>
                                </SelectContent>
                            </Select>
                        </div>

                        {calculationType === 'weighted' && (
                            <Input
                                name="base_reward_amount"
                                type="number"
                                step="0.01"
                                label="Valor base (R$)"
                                value={baseRewardAmount}
                                onChange={(e) => setBaseRewardAmount(parseFloat(e.target.value) || 0)}
                                required
                            />
                        )}

                        <div className="grid gap-4 md:grid-cols-2">
                            <Input
                                name="min_portfolio_size"
                                type="number"
                                label="Carteira mínima (alunos)"
                                defaultValue={activeRule?.kpi_config.min_portfolio_size || 5}
                                required
                            />

                            <Input
                                name="referral_validation_days"
                                type="number"
                                label="Validação de indicação (dias)"
                                defaultValue={activeRule?.kpi_config.referral_validation_days || 30}
                                required
                            />
                        </div>

                        <div className="flex items-start gap-2 rounded-lg bg-zinc-50 p-3">
                            <Info className="h-4 w-4 text-zinc-400 mt-0.5 shrink-0" />
                            <p className="text-xs text-zinc-500">
                                <strong>Carteira mínima:</strong> Treinadores com menos alunos não são elegíveis para o indicador de retenção.
                                <br />
                                <strong>Validação de indicação:</strong> Indicações só contam após o aluno permanecer ativo por este período.
                            </p>
                        </div>
                    </CardContent>
                </Card>

                {/* Weight sum validation for weighted mode */}
                {calculationType === 'weighted' && (
                    <div className={`mb-6 rounded-xl border p-4 ${isWeightSumValid
                        ? 'border-emerald-200 bg-emerald-50'
                        : 'border-red-200 bg-red-50'
                        }`}>
                        <div className="flex items-center justify-between">
                            <div className="flex items-center gap-2">
                                <AlertCircle className={`h-5 w-5 ${isWeightSumValid ? 'text-emerald-600' : 'text-red-600'}`} />
                                <span className={`text-sm font-medium ${isWeightSumValid ? 'text-emerald-800' : 'text-red-800'}`}>
                                    Soma dos pesos dos indicadores ativos
                                </span>
                            </div>
                            <span className={`text-lg font-bold ${isWeightSumValid ? 'text-emerald-700' : 'text-red-700'}`}>
                                {weightSum}%
                            </span>
                        </div>
                        {!isWeightSumValid && (
                            <p className="mt-2 text-sm text-red-600">
                                A soma dos pesos deve ser exatamente 100%. Ajuste os valores para continuar.
                            </p>
                        )}
                    </div>
                )}

                {/* KPI: Retention */}
                <Card className="mb-6">
                    <CardHeader>
                        <div className="flex items-center justify-between">
                            <CardTitle>Indicador: Retenção de Alunos</CardTitle>
                            <Checkbox
                                name="retention_enabled"
                                label="Ativo"
                                checked={kpiState.retention.enabled}
                                onChange={(e) => setKpiState(prev => ({
                                    ...prev,
                                    retention: { ...prev.retention, enabled: e.target.checked }
                                }))}
                            />
                        </div>
                    </CardHeader>
                    <CardContent>
                        <div className="grid gap-4 md:grid-cols-2">
                            <Input
                                name="retention_target"
                                type="number"
                                step="0.1"
                                label="Meta (%)"
                                value={kpiState.retention.target}
                                onChange={(e) => setKpiState(prev => ({
                                    ...prev,
                                    retention: { ...prev.retention, target: parseFloat(e.target.value) || 0 }
                                }))}
                            />

                            {calculationType === 'weighted' ? (
                                <Input
                                    name="retention_weight"
                                    type="number"
                                    label="Peso (%)"
                                    value={kpiState.retention.weight}
                                    onChange={(e) => setKpiState(prev => ({
                                        ...prev,
                                        retention: { ...prev.retention, weight: parseInt(e.target.value) || 0 }
                                    }))}
                                />
                            ) : (
                                <Input
                                    name="retention_fixed_value"
                                    type="number"
                                    step="0.01"
                                    label="Valor (R$)"
                                    value={kpiState.retention.fixed_value}
                                    onChange={(e) => setKpiState(prev => ({
                                        ...prev,
                                        retention: { ...prev.retention, fixed_value: parseFloat(e.target.value) || 0 }
                                    }))}
                                />
                            )}
                        </div>
                    </CardContent>
                </Card>

                {/* KPI: Referrals */}
                <Card className="mb-6">
                    <CardHeader>
                        <div className="flex items-center justify-between">
                            <CardTitle>Indicador: Indicações</CardTitle>
                            <Checkbox
                                name="referrals_enabled"
                                label="Ativo"
                                checked={kpiState.referrals.enabled}
                                onChange={(e) => setKpiState(prev => ({
                                    ...prev,
                                    referrals: { ...prev.referrals, enabled: e.target.checked }
                                }))}
                            />
                        </div>
                    </CardHeader>
                    <CardContent>
                        <div className="grid gap-4 md:grid-cols-2">
                            <Input
                                name="referrals_target"
                                type="number"
                                label="Meta (quantidade)"
                                value={kpiState.referrals.target}
                                onChange={(e) => setKpiState(prev => ({
                                    ...prev,
                                    referrals: { ...prev.referrals, target: parseInt(e.target.value) || 0 }
                                }))}
                            />

                            {calculationType === 'weighted' ? (
                                <Input
                                    name="referrals_weight"
                                    type="number"
                                    label="Peso (%)"
                                    value={kpiState.referrals.weight}
                                    onChange={(e) => setKpiState(prev => ({
                                        ...prev,
                                        referrals: { ...prev.referrals, weight: parseInt(e.target.value) || 0 }
                                    }))}
                                />
                            ) : (
                                <Input
                                    name="referrals_fixed_value"
                                    type="number"
                                    step="0.01"
                                    label="Valor (R$)"
                                    value={kpiState.referrals.fixed_value}
                                    onChange={(e) => setKpiState(prev => ({
                                        ...prev,
                                        referrals: { ...prev.referrals, fixed_value: parseFloat(e.target.value) || 0 }
                                    }))}
                                />
                            )}
                        </div>
                    </CardContent>
                </Card>

                {/* KPI: Management */}
                <Card className="mb-6">
                    <CardHeader>
                        <div className="flex items-center justify-between">
                            <CardTitle>Indicador: Gestão de Resultados</CardTitle>
                            <Checkbox
                                name="management_enabled"
                                label="Ativo"
                                checked={kpiState.management.enabled}
                                onChange={(e) => setKpiState(prev => ({
                                    ...prev,
                                    management: { ...prev.management, enabled: e.target.checked }
                                }))}
                            />
                        </div>
                    </CardHeader>
                    <CardContent>
                        <div className="grid gap-4 md:grid-cols-2">
                            <Input
                                name="management_target"
                                type="number"
                                step="0.1"
                                label="Meta (%)"
                                value={kpiState.management.target}
                                onChange={(e) => setKpiState(prev => ({
                                    ...prev,
                                    management: { ...prev.management, target: parseFloat(e.target.value) || 0 }
                                }))}
                            />

                            {calculationType === 'weighted' ? (
                                <Input
                                    name="management_weight"
                                    type="number"
                                    label="Peso (%)"
                                    value={kpiState.management.weight}
                                    onChange={(e) => setKpiState(prev => ({
                                        ...prev,
                                        management: { ...prev.management, weight: parseInt(e.target.value) || 0 }
                                    }))}
                                />
                            ) : (
                                <Input
                                    name="management_fixed_value"
                                    type="number"
                                    step="0.01"
                                    label="Valor (R$)"
                                    value={kpiState.management.fixed_value}
                                    onChange={(e) => setKpiState(prev => ({
                                        ...prev,
                                        management: { ...prev.management, fixed_value: parseFloat(e.target.value) || 0 }
                                    }))}
                                />
                            )}
                        </div>
                    </CardContent>
                </Card>

                {/* Hidden fields - only include values for the current calculation type */}
                {calculationType === 'weighted' ? (
                    <>
                        <input type="hidden" name="retention_fixed_value" value={kpiState.retention.fixed_value} />
                        <input type="hidden" name="referrals_fixed_value" value={kpiState.referrals.fixed_value} />
                        <input type="hidden" name="management_fixed_value" value={kpiState.management.fixed_value} />
                    </>
                ) : (
                    <>
                        <input type="hidden" name="base_reward_amount" value={baseRewardAmount} />
                        <input type="hidden" name="retention_weight" value={kpiState.retention.weight} />
                        <input type="hidden" name="referrals_weight" value={kpiState.referrals.weight} />
                        <input type="hidden" name="management_weight" value={kpiState.management.weight} />
                    </>
                )}

                {error && (
                    <div className="rounded-lg bg-red-50 p-3 text-sm text-red-600 mb-6">
                        {error}
                    </div>
                )}

                <div className="flex gap-3">
                    <Link href="/dashboard/manager/rules" className="flex-1">
                        <Button type="button" variant="outline" className="w-full">
                            Cancelar
                        </Button>
                    </Link>
                    <Button
                        type="submit"
                        className="flex-1"
                        isLoading={isLoading}
                        disabled={!isWeightSumValid}
                    >
                        {isFirstPolicy
                            ? 'Criar Política'
                            : willActivateImmediately
                                ? 'Criar e Ativar Política'
                                : 'Criar Política'}
                    </Button>
                </div>
            </form>
        </>
    );
}
