# Spec Fase 2.01 — Visão Integrada do Aluno

## Contexto

Hoje o Playbook tem 3 "visões" independentes de cada aluno:

1. **Gestor/Treinador** (`manager/students/[id]` e `trainer/students/[id]`): vê avaliações físicas, protocolos de treino, equipe vinculada.
2. **Nutricionista** (`nutritionist/patients/[id]`): vê consultas, evolução corporal, planos alimentares, exames laboratoriais.
3. **Fisioterapeuta** (`physiotherapist/patients/[id]`): vê sessões, evolução de dor/ROM, protocolos de tratamento, exercícios para casa.

Nenhuma dessas visões mostra o que as outras áreas estão fazendo. O gestor não sabe se o aluno tem plano alimentar ativo; o nutricionista não sabe qual protocolo de treino o aluno está seguindo; o fisioterapeuta não sabe se há restrição alimentar relevante.

## Objetivo

Criar uma **aba "Visão 360°"** na página de detalhe do aluno (gestor) que consolide dados das 3 áreas em um painel único, usando os componentes existentes em modo leitura. Depois, expandir essa visão com alertas cruzados e um timeline integrado.

---

## Arquitetura da Solução

### Princípio: Reusar, Não Duplicar

Os componentes de nutrição e fisioterapia já existem e são bem construídos:

| Componente | Localização | O que mostra |
|---|---|---|
| `ConsultationCard` | `components/nutrition/consultation-card.tsx` | Detalhes de uma consulta nutricional |
| `MetricsChart` | `components/nutrition/metrics-chart.tsx` | Gráfico de evolução corporal |
| `MealPlanViewer` | `components/nutrition/meal-plan-viewer.tsx` | Plano alimentar com refeições |
| `LabResultCard` | `components/nutrition/lab-result-card.tsx` | Resultados de exames |
| `SessionCard` | `components/physio/session-card.tsx` | Detalhes de uma sessão de fisio |
| `PainChart` | `components/physio/pain-chart.tsx` | Gráfico de evolução da dor |
| `TreatmentPlanCard` | `components/physio/treatment-plan-card.tsx` | Protocolo de tratamento |
| `HomeExercisesCard` | `components/physio/home-exercises-card.tsx` | Exercícios para casa |
| `ProtocolTimeline` | `dashboard/trainer/students/[id]/components/protocol-timeline.tsx` | Timeline de avaliações do treino |

A visão integrada reutiliza esses componentes em **modo somente leitura**, agrupados por disciplina.

---

## Tarefa 1 — Server Action: `getStudentIntegratedView()`

**Arquivo**: `web/src/app/actions/integrated.ts` (novo)

Cria uma action que busca dados de todas as 3 disciplinas em paralelo para um aluno:

```typescript
'use server';

import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { getProfile } from '@/app/actions/auth';
import type {
    NutritionConsultation,
    NutritionMealPlan,
    NutritionLabResult,
    PhysioSession,
    PhysioTreatmentPlan,
} from '@/types/database';

export interface IntegratedStudentView {
    // Nutrição
    nutrition: {
        hasLinkedProfessional: boolean;
        professionalName?: string;
        recentConsultations: NutritionConsultation[];
        activeMealPlans: NutritionMealPlan[];
        recentLabResults: NutritionLabResult[];
        lastConsultationDate?: string;
    };
    // Fisioterapia
    physio: {
        hasLinkedProfessional: boolean;
        professionalName?: string;
        recentSessions: PhysioSession[];
        activeTreatmentPlans: PhysioTreatmentPlan[];
        lastSessionDate?: string;
    };
    // Timeline unificada (eventos de todas as áreas)
    timeline: TimelineEvent[];
}

export interface TimelineEvent {
    id: string;
    date: string;
    type: 'assessment' | 'nutrition_consultation' | 'physio_session' | 'meal_plan' | 'treatment_plan' | 'status_change' | 'lab_result';
    title: string;
    description?: string;
    professional?: string;
    discipline: 'training' | 'nutrition' | 'physiotherapy' | 'admin';
}

export async function getStudentIntegratedView(studentId: string): Promise<IntegratedStudentView | null> {
    const profile = await getProfile();
    if (!profile || !['manager', 'trainer'].includes(profile.role)) {
        return null;
    }

    const admin = createAdminClient();

    // Fetch all linked professionals for this student
    const { data: links } = await admin
        .from('student_professionals')
        .select(`
            professional:professionals!professional_id(
                id, profession_type,
                profile:profiles!profile_id(full_name)
            )
        `)
        .eq('student_id', studentId)
        .eq('status', 'active');

    const nutritionistLink = (links || []).find(
        (l: any) => l.professional?.profession_type === 'nutritionist'
    );
    const physioLink = (links || []).find(
        (l: any) => l.professional?.profession_type === 'physiotherapist'
    );

    const nutritionistId = nutritionistLink?.professional?.id;
    const physioId = physioLink?.professional?.id;

    // Parallel fetch: nutrition, physio, assessments, events
    const [
        consultationsResult,
        mealPlansResult,
        labResultsResult,
        sessionsResult,
        treatmentPlansResult,
        assessmentsResult,
        eventsResult,
    ] = await Promise.all([
        // Nutrição — últimas 5 consultas
        nutritionistId
            ? admin
                .from('nutrition_consultations')
                .select('*')
                .eq('student_id', studentId)
                .order('consultation_date', { ascending: false })
                .limit(5)
            : Promise.resolve({ data: [] }),

        // Planos alimentares ativos
        nutritionistId
            ? admin
                .from('nutrition_meal_plans')
                .select('*')
                .eq('student_id', studentId)
                .eq('is_active', true)
                .order('created_at', { ascending: false })
            : Promise.resolve({ data: [] }),

        // Últimos 3 exames
        nutritionistId
            ? admin
                .from('nutrition_lab_results')
                .select('*')
                .eq('student_id', studentId)
                .order('exam_date', { ascending: false })
                .limit(3)
            : Promise.resolve({ data: [] }),

        // Fisio — últimas 5 sessões
        physioId
            ? admin
                .from('physio_sessions')
                .select('*')
                .eq('student_id', studentId)
                .order('session_date', { ascending: false })
                .limit(5)
            : Promise.resolve({ data: [] }),

        // Protocolos de tratamento ativos
        physioId
            ? admin
                .from('physio_treatment_plans')
                .select('*')
                .eq('student_id', studentId)
                .eq('status', 'active')
                .order('created_at', { ascending: false })
            : Promise.resolve({ data: [] }),

        // Avaliações do treino — últimas 5
        admin
            .from('student_assessments')
            .select('*')
            .eq('student_id', studentId)
            .order('performed_at', { ascending: false })
            .limit(5),

        // Eventos de status (student_events)
        admin
            .from('student_events')
            .select('*')
            .eq('student_id', studentId)
            .order('event_date', { ascending: false })
            .limit(10),
    ]);

    const consultations = (consultationsResult.data || []) as NutritionConsultation[];
    const mealPlans = (mealPlansResult.data || []) as NutritionMealPlan[];
    const labResults = (labResultsResult.data || []) as NutritionLabResult[];
    const sessions = (sessionsResult.data || []) as PhysioSession[];
    const treatmentPlans = (treatmentPlansResult.data || []) as PhysioTreatmentPlan[];
    const assessments = assessmentsResult.data || [];
    const events = eventsResult.data || [];

    // Build unified timeline
    const timeline: TimelineEvent[] = [];

    assessments.forEach((a: any) => {
        timeline.push({
            id: a.id,
            date: a.performed_at,
            type: 'assessment',
            title: 'Avaliação Física',
            description: `Protocolo registrado`,
            discipline: 'training',
        });
    });

    consultations.forEach((c) => {
        timeline.push({
            id: c.id,
            date: c.consultation_date,
            type: 'nutrition_consultation',
            title: `Consulta Nutricional`,
            description: c.notes ? c.notes.substring(0, 80) + '...' : undefined,
            professional: nutritionistLink?.professional?.profile?.full_name,
            discipline: 'nutrition',
        });
    });

    sessions.forEach((s) => {
        timeline.push({
            id: s.id,
            date: s.session_date,
            type: 'physio_session',
            title: `Sessão de Fisioterapia`,
            description: s.chief_complaint || undefined,
            professional: physioLink?.professional?.profile?.full_name,
            discipline: 'physiotherapy',
        });
    });

    mealPlans.forEach((p) => {
        timeline.push({
            id: p.id,
            date: p.start_date || p.created_at,
            type: 'meal_plan',
            title: `Plano Alimentar: ${p.plan_name}`,
            professional: nutritionistLink?.professional?.profile?.full_name,
            discipline: 'nutrition',
        });
    });

    events.forEach((e: any) => {
        if (e.event_type === 'status_change') {
            timeline.push({
                id: e.id,
                date: e.event_date,
                type: 'status_change',
                title: `Status: ${e.old_value?.status} → ${e.new_value?.status}`,
                discipline: 'admin',
            });
        }
    });

    // Sort by date descending
    timeline.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

    return {
        nutrition: {
            hasLinkedProfessional: !!nutritionistId,
            professionalName: nutritionistLink?.professional?.profile?.full_name,
            recentConsultations: consultations,
            activeMealPlans: mealPlans,
            recentLabResults: labResults,
            lastConsultationDate: consultations[0]?.consultation_date,
        },
        physio: {
            hasLinkedProfessional: !!physioId,
            professionalName: physioLink?.professional?.profile?.full_name,
            recentSessions: sessions,
            activeTreatmentPlans: treatmentPlans,
            lastSessionDate: sessions[0]?.session_date,
        },
        timeline,
    };
}
```

### Notas de implementação

- Usa `createAdminClient()` para buscar dados cross-role (gestor precisa ver dados de nutrição e fisio, que normalmente são isolados por RLS).
- Limita consultas a 5/3/10 itens para performance — a visão é um resumo, não um prontuário completo.
- Timeline combina eventos de todas as disciplinas em ordem cronológica.

---

## Tarefa 2 — Componente: `IntegratedTimeline`

**Arquivo**: `web/src/components/integrated/integrated-timeline.tsx` (novo)

Timeline visual unificada que mostra eventos de todas as disciplinas com cores e ícones diferenciados:

```
Cores por disciplina:
- training:       emerald-600  (ícone: Dumbbell)
- nutrition:      amber-600    (ícone: UtensilsCrossed)
- physiotherapy:  blue-600     (ícone: Activity)
- admin:          zinc-500     (ícone: Settings)
```

Componente `'use client'` que recebe o array `TimelineEvent[]` e renderiza como vertical timeline com:
- Linha vertical à esquerda com dots coloridos por disciplina
- Data formatada (relativa: "há 3 dias" ou "12 de março")
- Título do evento
- Descrição truncada (se houver)
- Nome do profissional (se houver)
- Filtros por disciplina (toggles no topo)

---

## Tarefa 3 — Componente: `IntegratedDisciplineCard`

**Arquivo**: `web/src/components/integrated/discipline-summary-card.tsx` (novo)

Card resumo de cada disciplina. Aceita:
```typescript
interface DisciplineSummaryCardProps {
    discipline: 'nutrition' | 'physiotherapy';
    hasLinkedProfessional: boolean;
    professionalName?: string;
    stats: { label: string; value: string | number }[];
    lastActivityDate?: string;
    children?: React.ReactNode; // Para expandir com conteúdo detalhado
}
```

Mostra:
- Badge da disciplina (reusar `ProfessionBadge`)
- Nome do profissional vinculado (ou "Sem profissional vinculado")
- Mini stats (consultas no mês, plano ativo, última sessão, etc.)
- Botão "Ver detalhes" que expande/colapsa o `children`
- No `children`: componentes existentes em modo read-only

---

## Tarefa 4 — Página: Adicionar aba "360°" no detalhe do aluno (gestor)

**Arquivo**: `web/src/app/dashboard/manager/students/[id]/page.tsx`

### Opção de implementação: Tabs no detalhe do aluno

Transformar a página de detalhe do aluno (gestor) em uma página com tabs:

| Tab | Conteúdo |
|-----|----------|
| **Treino** (default) | O conteúdo atual: avaliações, protocolos, equipe |
| **Nutrição** | Resumo nutricional com `ConsultationCard`, `MetricsChart`, `MealPlanViewer` em read-only |
| **Fisioterapia** | Resumo fisio com `SessionCard`, `PainChart`, `TreatmentPlanCard` em read-only |
| **Visão 360°** | `IntegratedTimeline` + `DisciplineSummaryCard` de cada disciplina |

### Lógica de exibição

- Se o aluno **não tem** nutricionista vinculado: a aba Nutrição mostra estado vazio com CTA "Vincular nutricionista".
- Se o aluno **não tem** fisioterapeuta vinculado: a aba Fisioterapia mostra estado vazio com CTA "Vincular fisioterapeuta".
- A aba 360° sempre aparece e mostra o que tiver disponível.

### Refatoração necessária

Extrair o conteúdo atual da página (avaliações/protocolos) para um componente `TrainingOverview`:

```typescript
// web/src/components/integrated/training-overview.tsx
interface TrainingOverviewProps {
    student: Student;
    assessments: StudentAssessment[];
    protocols: Protocol[];
    managementStatus: ManagementStatus;
    readOnly?: boolean;
}
```

---

## Tarefa 5 — Componente: `StudentDetailTabs`

**Arquivo**: `web/src/components/integrated/student-detail-tabs.tsx` (novo)

Componente `'use client'` que gerencia as tabs:

```typescript
'use client';

interface StudentDetailTabsProps {
    studentId: string;
    // Dados de treino (sempre presentes)
    trainingContent: React.ReactNode;
    // Dados integrados (carregados sob demanda ou pré-carregados)
    integratedView: IntegratedStudentView | null;
    // Profissionais vinculados
    linkedProfessionals: LinkedProfessional[];
    allProfessionals: Professional[];
}

type TabKey = 'training' | 'nutrition' | 'physio' | '360';
```

Renderiza:
- Tab bar horizontal com ícones por disciplina
- Badge de contagem em cada aba (ex: "3 consultas", "2 sessões")
- Conteúdo lazy-loaded: dados da aba 360° são buscados via `getStudentIntegratedView()` apenas quando o usuário clica

---

## Tarefa 6 — Expandir para o Treinador (read-only)

**Arquivo**: `web/src/app/dashboard/trainer/students/[id]/page.tsx`

O treinador também se beneficia de ver dados de nutrição e fisio dos seus alunos, porém em modo read-only e sem ações de edição.

Implementação: adicionar as mesmas tabs (Treino, Nutrição, Fisioterapia, 360°) na página de detalhe do treinador, reutilizando os mesmos componentes com `readOnly={true}`.

A `getStudentIntegratedView()` já aceita `role === 'trainer'`, bastando verificar que o aluno pertence ao treinador.

---

## Tarefa 7 — Alertas Cruzados (Cross-Discipline Alerts)

**Arquivo**: `web/src/components/integrated/cross-alerts.tsx` (novo)

Componente que analisa dados integrados e gera alertas:

```typescript
interface CrossAlert {
    severity: 'info' | 'warning' | 'critical';
    title: string;
    description: string;
    discipline: 'nutrition' | 'physiotherapy' | 'training';
    actionLabel?: string;
    actionHref?: string;
}
```

Regras iniciais de alertas:

| Regra | Severidade | Exemplo |
|-------|-----------|---------|
| Nutricionista vinculado mas sem consulta há 30+ dias | warning | "Última consulta nutricional há 45 dias" |
| Fisioterapeuta vinculado mas sem sessão há 30+ dias | warning | "Última sessão de fisio há 38 dias" |
| Plano alimentar ativo com validade vencida | warning | "Plano alimentar expirou há 10 dias" |
| Protocolo de tratamento sem sessão recente | info | "Protocolo ativo sem sessão nos últimos 14 dias" |
| Aluno pausado com profissionais vinculados | info | "Aluno pausado — considerar desvincular profissionais" |
| Exame laboratorial com resultados anormais | warning | "Último hemograma: 2 valores fora da referência" |

Esses alertas são exibidos como banners no topo da aba 360° e opcionalmente no dashboard do gestor.

---

## Estrutura de Novos Arquivos

```
web/src/
├── app/
│   ├── actions/
│   │   └── integrated.ts                    # getStudentIntegratedView()
│   └── dashboard/
│       └── manager/students/[id]/
│           └── page.tsx                      # Refatorar para tabs
│
├── components/
│   └── integrated/
│       ├── student-detail-tabs.tsx           # Tab controller
│       ├── integrated-timeline.tsx           # Timeline unificada
│       ├── discipline-summary-card.tsx       # Card resumo por disciplina
│       ├── training-overview.tsx             # Conteúdo atual extraído
│       ├── nutrition-readonly-view.tsx       # Reusar componentes de nutrição
│       ├── physio-readonly-view.tsx          # Reusar componentes de fisio
│       └── cross-alerts.tsx                  # Alertas cruzados
```

---

## Dependências

- **Nenhuma migration** necessária — todos os dados já existem nas tabelas criadas na Fase 1.
- **Nenhuma nova RLS policy** — a action usa `adminClient` para acessar dados cross-role.
- **Componentes existentes** são reutilizados em modo read-only sem modificação.

---

## Checklist de Implementação

### Backend
- [ ] Criar `web/src/app/actions/integrated.ts` com `getStudentIntegratedView()`
- [ ] Testar a action com aluno que tem profissionais vinculados
- [ ] Testar a action com aluno sem profissionais vinculados

### Componentes
- [ ] Criar `components/integrated/integrated-timeline.tsx`
- [ ] Criar `components/integrated/discipline-summary-card.tsx`
- [ ] Criar `components/integrated/training-overview.tsx` (extrair conteúdo atual)
- [ ] Criar `components/integrated/nutrition-readonly-view.tsx`
- [ ] Criar `components/integrated/physio-readonly-view.tsx`
- [ ] Criar `components/integrated/student-detail-tabs.tsx`
- [ ] Criar `components/integrated/cross-alerts.tsx`

### Páginas
- [ ] Refatorar `manager/students/[id]/page.tsx` para usar tabs
- [ ] Expandir `trainer/students/[id]/page.tsx` com as mesmas tabs (read-only)
- [ ] Verificar que tabs sem profissional vinculado mostram estado vazio adequado

### Verificação
- [ ] Type check (`npx tsc --noEmit`)
- [ ] Testar visão 360° com aluno completo (3 disciplinas)
- [ ] Testar visão 360° com aluno só com treinador
- [ ] Testar alertas cruzados (simular dados desatualizados)
- [ ] Verificar responsividade mobile das tabs

---

## Resultado Esperado

O gestor abre o detalhe de um aluno e vê 4 abas. Ao clicar em "Visão 360°", vê:

1. **Alertas** no topo (se houver): "Última consulta nutricional há 45 dias", etc.
2. **Cards de resumo** por disciplina: nutrição (última consulta, plano ativo, último peso), fisioterapia (última sessão, protocolo ativo, nível de dor).
3. **Timeline integrada**: todos os eventos das 3 áreas em ordem cronológica, com filtros por disciplina.

O treinador vê a mesma coisa, mas sem ações de edição nos dados de nutrição e fisioterapia.
