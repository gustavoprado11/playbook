# Spec Fase 2.04 — KPIs Interdisciplinares

## Contexto

O Playbook já permite que gestores visualizem dados de treino, nutrição e fisioterapia de forma integrada (spec 2.01), recebam alertas proativos (spec 2.02) e exportem relatórios por disciplina (spec 2.03). Porém, ainda não existe uma visão que **cruze métricas entre disciplinas** para responder perguntas como:

- "Alunos com acompanhamento nutricional retêm mais?"
- "Qual o impacto do trabalho multidisciplinar na evolução dos alunos?"
- "Quantos alunos estão engajados em mais de uma disciplina?"

Os dados já existem nas tabelas `students`, `student_professionals`, `nutrition_consultations`, `nutrition_metrics`, `physio_sessions`, `physio_session_evolution`, `student_assessments` e `performance_snapshots`. O objetivo é **agregar e cruzar** esses dados para gerar indicadores que meçam a evolução global do aluno e o impacto do acompanhamento multidisciplinar.

**Importante**: esses KPIs servem para o gestor avaliar a saúde do estúdio e a evolução dos alunos. **Não** são para criar sistema de incentivos ou comissões para profissionais além dos treinadores.

## Objetivo

Criar um **painel de KPIs Interdisciplinares** acessível pelo gestor, com indicadores que cruzam dados de todas as disciplinas para medir:

1. **Cobertura multidisciplinar** — quantos alunos usam cada combinação de serviços
2. **Engajamento por disciplina** — frequência de consultas/sessões por aluno
3. **Correlação retenção × acompanhamento** — alunos acompanhados retêm mais?
4. **Evolução de métricas** — tendências de peso, dor, composição corporal ao longo do tempo

---

## Tarefa 1 — Server Action: `getCrossDisciplineKPIs()`

**Arquivo**: `web/src/app/actions/kpis.ts` (novo)

```typescript
'use server';

import { createAdminClient } from '@/lib/supabase/admin';
import { getProfile } from '@/app/actions/auth';

// ---- TIPOS ----

export interface CoverageKPI {
    totalActiveStudents: number;
    withNutrition: number;          // vinculados a nutricionista ativo
    withPhysio: number;             // vinculados a fisioterapeuta ativo
    withBoth: number;               // nutrição + fisio
    trainingOnly: number;           // sem nenhum profissional extra
    coverageRate: number;           // % com pelo menos 1 disciplina extra
}

export interface EngagementKPI {
    discipline: 'nutrition' | 'physiotherapy';
    totalLinked: number;            // alunos vinculados
    activeThisMonth: number;        // tiveram atividade no mês
    avgActivitiesPerStudent: number; // média de consultas/sessões por aluno no mês
    inactiveOver30Days: number;     // vinculados mas sem atividade há 30+ dias
    engagementRate: number;         // activeThisMonth / totalLinked × 100
}

export interface RetentionCorrelation {
    segment: string;                // ex: "Só treino", "Treino + Nutrição", etc.
    studentCount: number;
    cancellationsLast90Days: number;
    retentionRate: number;          // (count - cancellations) / count × 100
    avgMonthsActive: number;        // tempo médio desde start_date
}

export interface MetricTrend {
    studentId: string;
    studentName: string;
    metric: string;                 // 'weight' | 'bmi' | 'body_fat' | 'pain_avg'
    dataPoints: { date: string; value: number }[];
    trend: 'improving' | 'stable' | 'declining';
    changePercent: number;          // variação % entre primeiro e último ponto
}

export interface CrossDisciplineKPIs {
    referenceDate: string;
    coverage: CoverageKPI;
    engagement: EngagementKPI[];    // 1 por disciplina
    retentionCorrelation: RetentionCorrelation[];
    metricTrends: {
        nutrition: MetricTrend[];   // peso, IMC, % gordura
        physio: MetricTrend[];      // dor média
    };
    highlights: KPIHighlight[];     // insights textuais calculados
}

export interface KPIHighlight {
    type: 'positive' | 'attention' | 'neutral';
    title: string;
    description: string;
}
```

### 1.1 — `getCoverageKPI()`

Consultas:
- `students` WHERE `status = 'active'` → total
- `student_professionals` JOIN com `professionals` → contar por `profession_type`
- Cruzar para obter combinações (só treino, treino+nutri, treino+fisio, treino+ambos)

### 1.2 — `getEngagementKPIs(referenceMonth: string)`

Para cada disciplina:
- Contar alunos vinculados (`student_professionals WHERE status = 'active'`)
- Contar alunos com atividade no mês (`nutrition_consultations` ou `physio_sessions`)
- Calcular média de atividades por aluno
- Identificar inativos (vinculados sem atividade há 30+ dias)

### 1.3 — `getRetentionCorrelation()`

Segmentar alunos por tipo de acompanhamento:
- **Só treino**: sem vínculo ativo com profissional
- **Treino + Nutrição**: vinculado só a nutricionista
- **Treino + Fisioterapia**: vinculado só a fisioterapeuta
- **Multidisciplinar**: vinculado a ambos

Para cada segmento: calcular taxa de retenção nos últimos 90 dias e tempo médio ativo.

### 1.4 — `getMetricTrends(limit: number)`

Buscar últimas métricas de evolução (últimos 6 meses):
- `nutrition_metrics`: weight, bmi, body_fat_percentage
- `physio_session_evolution`: pain_before, pain_after

Calcular tendência com base na variação entre primeiro e último ponto.
Classificar: `improving` (redução de peso/dor ≥ 5%), `declining` (aumento ≥ 5%), `stable`.

### 1.5 — `generateHighlights()`

Função pura que recebe os KPIs calculados e gera insights textuais:
- "X% dos alunos têm acompanhamento multidisciplinar"
- "Alunos com nutrição têm Y% mais retenção que só treino"
- "Z alunos estão vinculados a nutricionista mas sem consulta há 30+ dias"

---

## Tarefa 2 — Página de KPIs Interdisciplinares

**Arquivo**: `web/src/app/dashboard/manager/kpis/page.tsx` (novo)

Server component que:
1. Chama `getCrossDisciplineKPIs()`
2. Passa para componente client `<KPIDashboard kpis={kpis} />`

Layout:
- Cabeçalho: "KPIs Interdisciplinares" + subtítulo "Visão cruzada de todas as disciplinas"
- Seção de **Destaques** (highlights) no topo — cards coloridos com insights
- Seção de **Cobertura** — gráfico de barras ou cards mostrando distribuição
- Seção de **Engajamento** — cards por disciplina com taxa e indicadores
- Seção de **Retenção × Acompanhamento** — tabela comparativa de segmentos
- Seção de **Tendências** — top alunos com melhor/pior evolução de métricas

---

## Tarefa 3 — Componente `<CoverageChart />`

**Arquivo**: `web/src/components/kpis/coverage-chart.tsx` (novo)

Componente client que renderiza a distribuição de cobertura multidisciplinar:

```typescript
'use client';

interface Props {
    coverage: CoverageKPI;
}
```

Visualização com barras horizontais empilhadas ou cards com ícones:
- **Só Treino**: ícone Dumbbell, cor zinc
- **+ Nutrição**: ícone Apple, cor amber
- **+ Fisioterapia**: ícone Activity, cor blue
- **Multidisciplinar**: ícone Sparkles, cor emerald

Mostra quantidade absoluta e percentual de cada segmento.

---

## Tarefa 4 — Componente `<EngagementCards />`

**Arquivo**: `web/src/components/kpis/engagement-cards.tsx` (novo)

Um card por disciplina mostrando:
- Taxa de engajamento (circular ou barra de progresso)
- Alunos ativos vs vinculados
- Média de atividades por aluno
- Quantidade de inativos (destaque em vermelho se > 0)

Cores: amber-600 para nutrição, blue-600 para fisioterapia.

---

## Tarefa 5 — Componente `<RetentionComparison />`

**Arquivo**: `web/src/components/kpis/retention-comparison.tsx` (novo)

Tabela comparativa:

| Segmento | Alunos | Cancel. 90d | Retenção | Tempo Médio |
|----------|--------|-------------|----------|-------------|
| Só Treino | 15 | 3 | 80.0% | 8.2 meses |
| + Nutrição | 10 | 0 | 100.0% | 12.1 meses |
| + Fisioterapia | 5 | 0 | 100.0% | 6.3 meses |
| Multidisciplinar | 8 | 0 | 100.0% | 14.5 meses |

Destaque visual: segmento com melhor retenção em verde, pior em vermelho.
Inclui nota de rodapé: "Correlação observada, não implica causalidade."

---

## Tarefa 6 — Componente `<MetricTrendsPanel />`

**Arquivo**: `web/src/components/kpis/metric-trends-panel.tsx` (novo)

Exibe top 5 alunos com maior evolução positiva e top 5 com métricas em declínio:

- Cada item mostra: nome do aluno, métrica, variação %, ícone de tendência (↑ ↓ →)
- Cores: emerald para improving, red para declining, zinc para stable
- Link para visão integrada do aluno (`/dashboard/manager/students/[id]`)

Mini sparklines opcionais usando recharts `<Sparkline />` (se disponível) ou indicadores textuais.

---

## Tarefa 7 — Componente `<KPIHighlights />`

**Arquivo**: `web/src/components/kpis/kpi-highlights.tsx` (novo)

Cards de destaque no topo da página:
- **positive**: borda verde, ícone CheckCircle
- **attention**: borda amber, ícone AlertTriangle
- **neutral**: borda zinc, ícone Info

Exemplos de highlights gerados:
- "62% dos alunos ativos têm acompanhamento multidisciplinar" (positive)
- "8 alunos vinculados a nutricionista sem consulta há 30+ dias" (attention)
- "Alunos com nutrição retêm 20% mais que só treino" (positive)
- "3 alunos com tendência de aumento de dor nas últimas sessões" (attention)

---

## Tarefa 8 — Ativar no Sidebar + Exportação

**Arquivo**: `web/src/components/sidebar.tsx`

Adicionar "KPIs" aos `managerActiveLinks`:

```typescript
{ href: '/dashboard/manager/kpis', label: 'KPIs', icon: BarChart3 },
```

Remover "Performance do Aluno" dos `evolutionItems` (será substituído por este painel).

**Arquivo**: `web/src/lib/export-utils.ts`

Adicionar 2 funções de exportação:
- `exportKPIsPDF(kpis: CrossDisciplineKPIs)` — PDF com todas as seções
- `exportKPIsXLSX(kpis: CrossDisciplineKPIs)` — XLSX com aba por seção

---

## Estrutura de Novos Arquivos

```
web/src/
├── app/
│   ├── actions/
│   │   └── kpis.ts                                    # Server actions de KPIs
│   └── dashboard/manager/kpis/
│       └── page.tsx                                   # Página principal
├── components/kpis/
│   ├── kpi-dashboard.tsx                              # Container client principal
│   ├── coverage-chart.tsx                             # Distribuição de cobertura
│   ├── engagement-cards.tsx                           # Cards de engajamento
│   ├── retention-comparison.tsx                       # Tabela de retenção × acompanhamento
│   ├── metric-trends-panel.tsx                        # Tendências de métricas
│   └── kpi-highlights.tsx                             # Cards de destaque/insights
└── lib/
    └── export-utils.ts                                # +2 funções de export
```

**Nenhuma migration necessária.** Todos os dados vêm de tabelas existentes.

---

## Dependências

Nenhuma dependência nova. Reutiliza:
- `recharts` (já instalado) para sparklines/mini gráficos
- `jspdf` + `exceljs` + `file-saver` (já instalados) para exportação
- `lucide-react` (já instalado) para ícones

---

## Checklist

### Backend
- [ ] Criar `web/src/app/actions/kpis.ts` com `getCrossDisciplineKPIs()`
- [ ] Implementar `getCoverageKPI()` — distribuição de cobertura
- [ ] Implementar `getEngagementKPIs()` — engajamento por disciplina
- [ ] Implementar `getRetentionCorrelation()` — correlação retenção × acompanhamento
- [ ] Implementar `getMetricTrends()` — tendências de métricas
- [ ] Implementar `generateHighlights()` — insights textuais

### Componentes
- [ ] Criar `components/kpis/kpi-dashboard.tsx` — container principal
- [ ] Criar `components/kpis/coverage-chart.tsx` — distribuição de cobertura
- [ ] Criar `components/kpis/engagement-cards.tsx` — engajamento por disciplina
- [ ] Criar `components/kpis/retention-comparison.tsx` — tabela comparativa
- [ ] Criar `components/kpis/metric-trends-panel.tsx` — tendências de evolução
- [ ] Criar `components/kpis/kpi-highlights.tsx` — cards de destaque

### Página e Navegação
- [ ] Criar `dashboard/manager/kpis/page.tsx` — página de KPIs
- [ ] Adicionar "KPIs" ao sidebar (managerActiveLinks)
- [ ] Remover "Performance do Aluno" dos evolutionItems
- [ ] Adicionar funções de exportação PDF/XLSX

### Verificação
- [ ] Type check (`npx tsc --noEmit`)
- [ ] Testar com estúdio que tem profissionais vinculados
- [ ] Testar com estúdio sem profissionais (estados vazios)
- [ ] Verificar cálculo de retenção por segmento
- [ ] Verificar que highlights refletem dados reais
- [ ] Testar exportação PDF e XLSX
- [ ] Verificar responsividade

---

## Resultado Esperado

O gestor acessa "KPIs" no sidebar e vê um painel completo que responde:

1. **"Quanto do meu estúdio é multidisciplinar?"** → Seção de cobertura mostra distribuição
2. **"Os profissionais estão sendo procurados?"** → Cards de engajamento por disciplina
3. **"Vale a pena investir em multidisciplinaridade?"** → Tabela de retenção correlacionada
4. **"Quais alunos estão evoluindo ou regredindo?"** → Painel de tendências com links
5. **"O que precisa de atenção agora?"** → Highlights com insights acionáveis
