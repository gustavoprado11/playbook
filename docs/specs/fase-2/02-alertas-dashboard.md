# Spec Fase 2.02 — Alertas Proativos nos Dashboards

## Contexto

A Fase 2.01 implementou o `CrossAlerts` na aba 360° do detalhe do aluno, mas esses alertas só são vistos quando alguém abre manualmente a ficha do aluno. Nenhum dashboard mostra proativamente que há situações que precisam de atenção.

Hoje os dashboards mostram:
- **Gestor**: stats de treinadores, retenção, recompensas, tabela de performance
- **Treinador**: KPIs (retenção, indicações, gestão de resultados), valor da recompensa
- **Nutricionista**: pacientes ativos, consultas no mês, planos ativos
- **Fisioterapeuta**: pacientes ativos, sessões no mês, protocolos ativos

Nenhum deles alerta sobre situações como "3 alunos sem consulta nutricional há 30+ dias" ou "protocolo de fisio sem sessão recente".

## Objetivo

Adicionar um **painel de alertas** no topo de cada dashboard que resume situações que precisam de atenção, calculados on-demand a partir dos dados existentes. Sem nova tabela, sem cron jobs, sem websockets — apenas queries inteligentes no server component.

---

## Arquitetura

### Princípio: Alertas Calculados, Não Armazenados

Em vez de criar uma tabela `notifications` com estado (lido/não lido, dismissed), os alertas são **calculados a cada render do dashboard** a partir dos dados reais. Isso é mais simples, sempre preciso, e não gera débito técnico de limpeza.

Se no futuro o volume de dados justificar, pode-se migrar para alertas pré-computados via cron — mas para 3-5 profissionais e ~100 alunos, queries on-demand são suficientes.

### Fluxo

```
Dashboard Page (Server Component)
  → getProfile()
  → getDashboardAlerts(role, profileId)  ← NOVA ACTION
  → Renderiza <DashboardAlerts alerts={alerts} />
  → Renderiza conteúdo atual do dashboard
```

---

## Tarefa 1 — Server Action: `getDashboardAlerts()`

**Arquivo**: `web/src/app/actions/alerts.ts` (novo)

```typescript
'use server';

import { createAdminClient } from '@/lib/supabase/admin';
import { getProfile, getTrainerId } from '@/app/actions/auth';

export interface DashboardAlert {
    id: string;
    severity: 'warning' | 'info';
    title: string;
    description: string;
    category: 'nutrition' | 'physiotherapy' | 'training' | 'admin';
    actionLabel?: string;
    actionHref?: string;
    count?: number; // Quantos alunos/itens afetados
}

export async function getDashboardAlerts(): Promise<DashboardAlert[]> {
    const profile = await getProfile();
    if (!profile) return [];

    switch (profile.role) {
        case 'manager':
            return getManagerAlerts();
        case 'trainer':
            return getTrainerAlerts();
        case 'professional':
            if (profile.profession_type === 'nutritionist') {
                return getNutritionistAlerts(profile.id);
            }
            if (profile.profession_type === 'physiotherapist') {
                return getPhysiotherapistAlerts(profile.id);
            }
            return [];
        default:
            return [];
    }
}
```

### 1.1 — Alertas do Gestor

O gestor precisa de uma visão macro. Seus alertas são agregados:

```typescript
async function getManagerAlerts(): Promise<DashboardAlert[]> {
    const admin = createAdminClient();
    const alerts: DashboardAlert[] = [];
    const thirtyDaysAgo = new Date(Date.now() - 30 * 86400000).toISOString().split('T')[0];

    // 1. Alunos com profissional vinculado mas sem atividade recente
    // Nutrição: alunos com nutricionista mas sem consulta há 30+ dias
    const { data: nutritionLinks } = await admin
        .from('student_professionals')
        .select(`
            student_id,
            student:students!student_id(full_name, status),
            professional:professionals!professional_id(
                profession_type,
                profile:profiles!profile_id(full_name)
            )
        `)
        .eq('status', 'active');

    const nutritionistLinks = (nutritionLinks || []).filter(
        (l: any) => l.professional?.profession_type === 'nutritionist'
            && l.student?.status === 'active'
    );

    // Para cada link de nutrição, verificar última consulta
    if (nutritionistLinks.length > 0) {
        const studentIds = nutritionistLinks.map((l: any) => l.student_id);
        const { data: recentConsultations } = await admin
            .from('nutrition_consultations')
            .select('student_id, consultation_date')
            .in('student_id', studentIds)
            .gte('consultation_date', thirtyDaysAgo);

        const studentsWithRecentConsult = new Set(
            (recentConsultations || []).map((c: any) => c.student_id)
        );
        const overdueNutrition = nutritionistLinks.filter(
            (l: any) => !studentsWithRecentConsult.has(l.student_id)
        );

        if (overdueNutrition.length > 0) {
            alerts.push({
                id: 'manager-nutrition-overdue',
                severity: 'warning',
                title: 'Consultas nutricionais atrasadas',
                description: `${overdueNutrition.length} aluno(s) com nutricionista vinculado mas sem consulta nos últimos 30 dias.`,
                category: 'nutrition',
                actionLabel: 'Ver alunos',
                actionHref: '/dashboard/manager/students',
                count: overdueNutrition.length,
            });
        }
    }

    // Fisioterapia: mesmo padrão
    const physioLinks = (nutritionLinks || []).filter(
        (l: any) => l.professional?.profession_type === 'physiotherapist'
            && l.student?.status === 'active'
    );

    if (physioLinks.length > 0) {
        const studentIds = physioLinks.map((l: any) => l.student_id);
        const { data: recentSessions } = await admin
            .from('physio_sessions')
            .select('student_id, session_date')
            .in('student_id', studentIds)
            .gte('session_date', thirtyDaysAgo);

        const studentsWithRecentSession = new Set(
            (recentSessions || []).map((s: any) => s.student_id)
        );
        const overduePhysio = physioLinks.filter(
            (l: any) => !studentsWithRecentSession.has(l.student_id)
        );

        if (overduePhysio.length > 0) {
            alerts.push({
                id: 'manager-physio-overdue',
                severity: 'warning',
                title: 'Sessões de fisioterapia atrasadas',
                description: `${overduePhysio.length} aluno(s) com fisioterapeuta vinculado mas sem sessão nos últimos 30 dias.`,
                category: 'physiotherapy',
                actionLabel: 'Ver alunos',
                actionHref: '/dashboard/manager/students',
                count: overduePhysio.length,
            });
        }
    }

    // 2. Planos alimentares expirados
    const { data: expiredPlans } = await admin
        .from('nutrition_meal_plans')
        .select('id', { count: 'exact', head: true })
        .eq('is_active', true)
        .lt('end_date', new Date().toISOString().split('T')[0]);

    if (expiredPlans && (expiredPlans as any).count > 0) {
        alerts.push({
            id: 'manager-expired-meal-plans',
            severity: 'info',
            title: 'Planos alimentares vencidos',
            description: `Existem planos alimentares marcados como ativos com data de validade expirada.`,
            category: 'nutrition',
        });
    }

    // 3. Alunos ativos sem treinador (orphans)
    const { count: orphanCount } = await admin
        .from('students')
        .select('id', { count: 'exact', head: true })
        .eq('status', 'active')
        .eq('is_archived', false)
        .is('trainer_id', null);

    if (orphanCount && orphanCount > 0) {
        alerts.push({
            id: 'manager-orphan-students',
            severity: 'warning',
            title: 'Alunos sem treinador',
            description: `${orphanCount} aluno(s) ativo(s) sem treinador vinculado.`,
            category: 'admin',
            actionLabel: 'Ver alunos',
            actionHref: '/dashboard/manager/students',
            count: orphanCount,
        });
    }

    return alerts;
}
```

### 1.2 — Alertas do Treinador

O treinador vê alertas sobre seus próprios alunos:

```typescript
async function getTrainerAlerts(): Promise<DashboardAlert[]> {
    const trainerId = await getTrainerId();
    if (!trainerId) return [];

    const admin = createAdminClient();
    const alerts: DashboardAlert[] = [];
    const thirtyDaysAgo = new Date(Date.now() - 30 * 86400000).toISOString().split('T')[0];

    // Buscar alunos ativos do treinador
    const { data: students } = await admin
        .from('students')
        .select('id, full_name')
        .eq('trainer_id', trainerId)
        .eq('status', 'active')
        .eq('is_archived', false);

    if (!students || students.length === 0) return alerts;
    const studentIds = students.map((s: any) => s.id);

    // Alunos com profissionais vinculados
    const { data: links } = await admin
        .from('student_professionals')
        .select(`
            student_id,
            professional:professionals!professional_id(
                profession_type,
                profile:profiles!profile_id(full_name)
            )
        `)
        .in('student_id', studentIds)
        .eq('status', 'active');

    // Nutrição atrasada
    const nutritionLinks = (links || []).filter(
        (l: any) => l.professional?.profession_type === 'nutritionist'
    );
    if (nutritionLinks.length > 0) {
        const nutStudentIds = nutritionLinks.map((l: any) => l.student_id);
        const { data: recentConsults } = await admin
            .from('nutrition_consultations')
            .select('student_id')
            .in('student_id', nutStudentIds)
            .gte('consultation_date', thirtyDaysAgo);

        const recent = new Set((recentConsults || []).map((c: any) => c.student_id));
        const overdue = nutritionLinks.filter((l: any) => !recent.has(l.student_id));

        if (overdue.length > 0) {
            const names = overdue
                .map((l: any) => students.find((s: any) => s.id === l.student_id)?.full_name)
                .filter(Boolean)
                .slice(0, 3);
            alerts.push({
                id: 'trainer-nutrition-overdue',
                severity: 'info',
                title: 'Alunos sem consulta nutricional recente',
                description: `${names.join(', ')}${overdue.length > 3 ? ` e mais ${overdue.length - 3}` : ''} — sem consulta há 30+ dias.`,
                category: 'nutrition',
                count: overdue.length,
            });
        }
    }

    // Fisio atrasada
    const physioLinks = (links || []).filter(
        (l: any) => l.professional?.profession_type === 'physiotherapist'
    );
    if (physioLinks.length > 0) {
        const physioStudentIds = physioLinks.map((l: any) => l.student_id);
        const { data: recentSessions } = await admin
            .from('physio_sessions')
            .select('student_id')
            .in('student_id', physioStudentIds)
            .gte('session_date', thirtyDaysAgo);

        const recent = new Set((recentSessions || []).map((s: any) => s.student_id));
        const overdue = physioLinks.filter((l: any) => !recent.has(l.student_id));

        if (overdue.length > 0) {
            const names = overdue
                .map((l: any) => students.find((s: any) => s.id === l.student_id)?.full_name)
                .filter(Boolean)
                .slice(0, 3);
            alerts.push({
                id: 'trainer-physio-overdue',
                severity: 'info',
                title: 'Alunos sem sessão de fisioterapia recente',
                description: `${names.join(', ')}${overdue.length > 3 ? ` e mais ${overdue.length - 3}` : ''} — sem sessão há 30+ dias.`,
                category: 'physiotherapy',
                count: overdue.length,
            });
        }
    }

    return alerts;
}
```

### 1.3 — Alertas do Nutricionista

O nutricionista vê alertas sobre seus pacientes:

```typescript
async function getNutritionistAlerts(profileId: string): Promise<DashboardAlert[]> {
    const admin = createAdminClient();
    const alerts: DashboardAlert[] = [];

    // Get professional ID
    const { data: professional } = await admin
        .from('professionals')
        .select('id')
        .eq('profile_id', profileId)
        .eq('profession_type', 'nutritionist')
        .single();

    if (!professional) return alerts;

    const thirtyDaysAgo = new Date(Date.now() - 30 * 86400000).toISOString().split('T')[0];

    // Pacientes ativos vinculados
    const { data: links } = await admin
        .from('student_professionals')
        .select('student_id, student:students!student_id(full_name, status)')
        .eq('professional_id', professional.id)
        .eq('status', 'active');

    const activeLinks = (links || []).filter((l: any) => l.student?.status === 'active');
    if (activeLinks.length === 0) return alerts;

    const studentIds = activeLinks.map((l: any) => l.student_id);

    // 1. Pacientes sem consulta há 30+ dias
    const { data: recentConsults } = await admin
        .from('nutrition_consultations')
        .select('student_id')
        .eq('professional_id', professional.id)
        .in('student_id', studentIds)
        .gte('consultation_date', thirtyDaysAgo);

    const recent = new Set((recentConsults || []).map((c: any) => c.student_id));
    const overduePatients = activeLinks.filter((l: any) => !recent.has(l.student_id));

    if (overduePatients.length > 0) {
        const names = overduePatients
            .map((l: any) => l.student?.full_name)
            .filter(Boolean)
            .slice(0, 3);
        alerts.push({
            id: 'nutritionist-overdue-consults',
            severity: 'warning',
            title: 'Pacientes aguardando consulta',
            description: `${names.join(', ')}${overduePatients.length > 3 ? ` e mais ${overduePatients.length - 3}` : ''} — sem consulta nos últimos 30 dias.`,
            category: 'nutrition',
            actionLabel: 'Ver pacientes',
            actionHref: '/dashboard/nutritionist/patients',
            count: overduePatients.length,
        });
    }

    // 2. Planos alimentares que vencem em 7 dias
    const sevenDaysFromNow = new Date(Date.now() + 7 * 86400000).toISOString().split('T')[0];
    const today = new Date().toISOString().split('T')[0];

    const { data: expiringPlans } = await admin
        .from('nutrition_meal_plans')
        .select('id, plan_name, end_date, student_id')
        .eq('professional_id', professional.id)
        .eq('is_active', true)
        .lte('end_date', sevenDaysFromNow)
        .gte('end_date', today);

    if (expiringPlans && expiringPlans.length > 0) {
        alerts.push({
            id: 'nutritionist-expiring-plans',
            severity: 'info',
            title: 'Planos alimentares vencendo em breve',
            description: `${expiringPlans.length} plano(s) alimentar(es) vencem nos próximos 7 dias.`,
            category: 'nutrition',
            actionLabel: 'Ver planos',
            actionHref: '/dashboard/nutritionist/meal-plans',
            count: expiringPlans.length,
        });
    }

    // 3. Exames com valores anormais não revisados (últimos 30 dias)
    const { data: recentLabs } = await admin
        .from('nutrition_lab_results')
        .select('id, results, student_id')
        .in('student_id', studentIds)
        .gte('exam_date', thirtyDaysAgo);

    const abnormalCount = (recentLabs || []).filter((lab: any) => {
        const results = lab.results || {};
        return Object.values(results).some((r: any) => r.status === 'high' || r.status === 'low');
    }).length;

    if (abnormalCount > 0) {
        alerts.push({
            id: 'nutritionist-abnormal-labs',
            severity: 'warning',
            title: 'Exames com valores alterados',
            description: `${abnormalCount} exame(s) recente(s) com valores fora da referência.`,
            category: 'nutrition',
            count: abnormalCount,
        });
    }

    return alerts;
}
```

### 1.4 — Alertas do Fisioterapeuta

```typescript
async function getPhysiotherapistAlerts(profileId: string): Promise<DashboardAlert[]> {
    const admin = createAdminClient();
    const alerts: DashboardAlert[] = [];

    const { data: professional } = await admin
        .from('professionals')
        .select('id')
        .eq('profile_id', profileId)
        .eq('profession_type', 'physiotherapist')
        .single();

    if (!professional) return alerts;

    const thirtyDaysAgo = new Date(Date.now() - 30 * 86400000).toISOString().split('T')[0];
    const fourteenDaysAgo = new Date(Date.now() - 14 * 86400000).toISOString().split('T')[0];

    // Pacientes ativos vinculados
    const { data: links } = await admin
        .from('student_professionals')
        .select('student_id, student:students!student_id(full_name, status)')
        .eq('professional_id', professional.id)
        .eq('status', 'active');

    const activeLinks = (links || []).filter((l: any) => l.student?.status === 'active');
    if (activeLinks.length === 0) return alerts;

    const studentIds = activeLinks.map((l: any) => l.student_id);

    // 1. Pacientes sem sessão há 30+ dias
    const { data: recentSessions } = await admin
        .from('physio_sessions')
        .select('student_id')
        .eq('professional_id', professional.id)
        .in('student_id', studentIds)
        .gte('session_date', thirtyDaysAgo);

    const recent = new Set((recentSessions || []).map((s: any) => s.student_id));
    const overduePatients = activeLinks.filter((l: any) => !recent.has(l.student_id));

    if (overduePatients.length > 0) {
        const names = overduePatients
            .map((l: any) => l.student?.full_name)
            .filter(Boolean)
            .slice(0, 3);
        alerts.push({
            id: 'physio-overdue-sessions',
            severity: 'warning',
            title: 'Pacientes aguardando sessão',
            description: `${names.join(', ')}${overduePatients.length > 3 ? ` e mais ${overduePatients.length - 3}` : ''} — sem sessão nos últimos 30 dias.`,
            category: 'physiotherapy',
            actionLabel: 'Ver pacientes',
            actionHref: '/dashboard/physiotherapist/patients',
            count: overduePatients.length,
        });
    }

    // 2. Protocolos ativos sem sessão há 14+ dias
    const { data: activePlans } = await admin
        .from('physio_treatment_plans')
        .select('id, plan_name, student_id')
        .eq('professional_id', professional.id)
        .eq('status', 'active');

    if (activePlans && activePlans.length > 0) {
        const planStudentIds = activePlans.map((p: any) => p.student_id);
        const { data: recentPlanSessions } = await admin
            .from('physio_sessions')
            .select('student_id')
            .eq('professional_id', professional.id)
            .in('student_id', planStudentIds)
            .gte('session_date', fourteenDaysAgo);

        const recentPlanSet = new Set((recentPlanSessions || []).map((s: any) => s.student_id));
        const stalePlans = activePlans.filter((p: any) => !recentPlanSet.has(p.student_id));

        if (stalePlans.length > 0) {
            alerts.push({
                id: 'physio-stale-plans',
                severity: 'info',
                title: 'Protocolos sem sessão recente',
                description: `${stalePlans.length} protocolo(s) ativo(s) sem sessão nos últimos 14 dias.`,
                category: 'physiotherapy',
                count: stalePlans.length,
            });
        }
    }

    return alerts;
}
```

---

## Tarefa 2 — Componente: `DashboardAlerts`

**Arquivo**: `web/src/components/dashboard-alerts.tsx` (novo)

Componente server-friendly que renderiza os alertas no topo do dashboard:

```typescript
import { AlertTriangle, Info, ArrowRight, UtensilsCrossed, Activity, Dumbbell, Settings } from 'lucide-react';
import Link from 'next/link';
import type { DashboardAlert } from '@/app/actions/alerts';

const categoryIcons = {
    nutrition: UtensilsCrossed,
    physiotherapy: Activity,
    training: Dumbbell,
    admin: Settings,
};

const categoryColors = {
    nutrition: 'border-amber-200 bg-amber-50',
    physiotherapy: 'border-blue-200 bg-blue-50',
    training: 'border-emerald-200 bg-emerald-50',
    admin: 'border-zinc-200 bg-zinc-50',
};

const severityIcons = {
    warning: AlertTriangle,
    info: Info,
};

interface DashboardAlertsProps {
    alerts: DashboardAlert[];
}

export function DashboardAlerts({ alerts }: DashboardAlertsProps) {
    if (alerts.length === 0) return null;

    return (
        <div className="space-y-2">
            {alerts.map((alert) => {
                const CategoryIcon = categoryIcons[alert.category];
                const SeverityIcon = severityIcons[alert.severity];

                return (
                    <div
                        key={alert.id}
                        className={`flex items-start gap-3 rounded-lg border p-3 ${categoryColors[alert.category]}`}
                    >
                        <CategoryIcon className="h-5 w-5 mt-0.5 shrink-0 text-zinc-600" />
                        <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2">
                                <SeverityIcon className={`h-4 w-4 ${alert.severity === 'warning' ? 'text-amber-600' : 'text-blue-600'}`} />
                                <p className="text-sm font-medium text-zinc-900">{alert.title}</p>
                                {alert.count && (
                                    <span className="inline-flex items-center rounded-full bg-white/80 px-2 py-0.5 text-xs font-medium text-zinc-700">
                                        {alert.count}
                                    </span>
                                )}
                            </div>
                            <p className="mt-0.5 text-sm text-zinc-600">{alert.description}</p>
                        </div>
                        {alert.actionHref && alert.actionLabel && (
                            <Link
                                href={alert.actionHref}
                                className="shrink-0 flex items-center gap-1 text-sm font-medium text-zinc-700 hover:text-zinc-900"
                            >
                                {alert.actionLabel}
                                <ArrowRight className="h-3.5 w-3.5" />
                            </Link>
                        )}
                    </div>
                );
            })}
        </div>
    );
}
```

---

## Tarefa 3 — Integrar nos Dashboards

### 3.1 — Dashboard do Gestor

**Arquivo**: `web/src/app/dashboard/manager/page.tsx`

Adicionar no topo, logo após os stats cards:

```typescript
import { getDashboardAlerts } from '@/app/actions/alerts';
import { DashboardAlerts } from '@/components/dashboard-alerts';

// Dentro da função do page component, junto com os outros fetches:
const alerts = await getDashboardAlerts();

// No JSX, logo após o grid de stats:
<DashboardAlerts alerts={alerts} />
```

### 3.2 — Dashboard do Treinador

**Arquivo**: `web/src/app/dashboard/trainer/page.tsx`

Mesmo padrão: fetch `getDashboardAlerts()` e renderizar `<DashboardAlerts />` após o reward card.

### 3.3 — Dashboard do Nutricionista

**Arquivo**: `web/src/app/dashboard/nutritionist/page.tsx`

Mesmo padrão: após os stats cards.

### 3.4 — Dashboard do Fisioterapeuta

**Arquivo**: `web/src/app/dashboard/physiotherapist/page.tsx`

Mesmo padrão: após os stats cards.

---

## Regras de Alertas por Role

### Gestor
| Alerta | Severidade | Gatilho |
|--------|-----------|---------|
| Consultas nutricionais atrasadas | warning | Alunos com nutricionista vinculado sem consulta há 30+ dias |
| Sessões de fisio atrasadas | warning | Alunos com fisioterapeuta vinculado sem sessão há 30+ dias |
| Planos alimentares vencidos | info | Planos marcados ativos com end_date passada |
| Alunos sem treinador | warning | Alunos ativos com trainer_id = null |

### Treinador
| Alerta | Severidade | Gatilho |
|--------|-----------|---------|
| Alunos sem consulta nutricional | info | Alunos do treinador com nutricionista vinculado sem consulta há 30+ dias |
| Alunos sem sessão de fisio | info | Alunos do treinador com fisioterapeuta vinculado sem sessão há 30+ dias |

### Nutricionista
| Alerta | Severidade | Gatilho |
|--------|-----------|---------|
| Pacientes aguardando consulta | warning | Pacientes vinculados sem consulta há 30+ dias |
| Planos vencendo | info | Planos ativos que vencem nos próximos 7 dias |
| Exames com valores alterados | warning | Exames recentes com status 'high' ou 'low' |

### Fisioterapeuta
| Alerta | Severidade | Gatilho |
|--------|-----------|---------|
| Pacientes aguardando sessão | warning | Pacientes vinculados sem sessão há 30+ dias |
| Protocolos sem sessão recente | info | Protocolos ativos sem sessão há 14+ dias |

---

## Performance

As queries usam `adminClient` para bypass de RLS e filtram por data com `gte/lte`. Com índices existentes nas colunas de data e foreign keys, as queries devem ser rápidas para o volume esperado (3-5 profissionais, ~100 alunos).

Se necessário, pode-se adicionar cache com `unstable_cache` do Next.js com TTL de 5 minutos para evitar recalcular a cada page load.

---

## Estrutura de Novos Arquivos

```
web/src/
├── app/actions/
│   └── alerts.ts                    # getDashboardAlerts() + funções por role
├── components/
│   └── dashboard-alerts.tsx         # Componente de renderização
└── app/dashboard/
    ├── manager/page.tsx             # Adicionar alerts
    ├── trainer/page.tsx             # Adicionar alerts
    ├── nutritionist/page.tsx        # Adicionar alerts
    └── physiotherapist/page.tsx     # Adicionar alerts
```

**Nenhuma migration necessária.**

---

## Checklist

- [ ] Criar `web/src/app/actions/alerts.ts` com todas as funções de alerta
- [ ] Criar `web/src/components/dashboard-alerts.tsx`
- [ ] Integrar alertas no dashboard do gestor
- [ ] Integrar alertas no dashboard do treinador
- [ ] Integrar alertas no dashboard do nutricionista
- [ ] Integrar alertas no dashboard do fisioterapeuta
- [ ] Type check (`npx tsc --noEmit`)
- [ ] Testar com dados reais: aluno com nutricionista sem consulta recente
- [ ] Testar dashboard vazio (sem alertas) — componente não deve renderizar nada
- [ ] Verificar performance: medir tempo do `getDashboardAlerts()` com dados reais
