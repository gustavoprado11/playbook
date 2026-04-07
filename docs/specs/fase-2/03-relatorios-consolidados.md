# Spec Fase 2.03 — Relatórios Consolidados

## Contexto

O sidebar do Playbook tem "Relatórios" listado como "Em evolução" — ainda não existe nenhuma página de relatórios, nem funcionalidade de exportação. Hoje o gestor vê dados de performance no dashboard, mas não consegue exportar, comparar períodos, ou gerar um documento para compartilhar com a equipe.

Os dados para relatórios já existem em várias tabelas:
- `performance_snapshots` — KPIs mensais finalizados por treinador
- `students` / `student_events` — movimentação de alunos
- `nutrition_consultations` / `nutrition_meal_plans` — atividade nutricional
- `physio_sessions` / `physio_treatment_plans` — atividade de fisioterapia
- `student_assessments` — avaliações de treino
- `trainer_activity_log` — atividade dos treinadores

## Objetivo

Criar a página de **Relatórios** do gestor com 4 relatórios iniciais, cada um com visualização na tela e exportação em PDF/XLSX.

---

## Tarefa 1 — Instalar dependências

**Arquivo**: `web/package.json`

```bash
npm install jspdf jspdf-autotable exceljs file-saver
npm install -D @types/file-saver
```

- `jspdf` + `jspdf-autotable` — geração de PDFs com tabelas formatadas
- `exceljs` — geração de XLSX com formatação, fórmulas e estilos
- `file-saver` — trigger de download no browser

---

## Tarefa 2 — Server Actions: `getReportData()`

**Arquivo**: `web/src/app/actions/reports.ts` (novo)

### 2.1 — Relatório de Performance Mensal

Agregação dos snapshots de performance de todos os treinadores para um mês específico:

```typescript
'use server';

import { createAdminClient } from '@/lib/supabase/admin';
import { getProfile } from '@/app/actions/auth';

// ---- TIPOS ----

export interface PerformanceReportRow {
    trainerName: string;
    studentsStart: number;
    studentsEnd: number;
    cancellations: number;
    retentionRate: number;
    retentionTarget: number;
    retentionAchieved: boolean;
    referralsCount: number;
    referralsTarget: number;
    referralsAchieved: boolean;
    managementRate: number;
    managementTarget: number;
    managementAchieved: boolean;
    rewardAmount: number;
    isFinalized: boolean;
}

export interface PerformanceReport {
    referenceMonth: string;
    rows: PerformanceReportRow[];
    totals: {
        avgRetention: number;
        totalReferrals: number;
        avgManagement: number;
        totalRewards: number;
    };
}

export interface StudentMovementRow {
    studentName: string;
    trainerName: string;
    eventType: 'new' | 'cancelled' | 'paused' | 'reactivated' | 'transferred';
    eventDate: string;
    details?: string;
}

export interface StudentMovementReport {
    period: { start: string; end: string };
    rows: StudentMovementRow[];
    summary: {
        newStudents: number;
        cancellations: number;
        paused: number;
        reactivated: number;
        transfers: number;
        netChange: number;
    };
}

export interface ProfessionalActivityRow {
    professionalName: string;
    professionType: 'nutritionist' | 'physiotherapist';
    activePatients: number;
    activitiesThisMonth: number; // consultas ou sessões
    activePlans: number; // planos alimentares ou protocolos
    lastActivityDate?: string;
}

export interface ProfessionalActivityReport {
    referenceMonth: string;
    rows: ProfessionalActivityRow[];
}

export interface StudentEvolutionRow {
    date: string;
    discipline: 'training' | 'nutrition' | 'physiotherapy';
    type: string;
    description: string;
    professional?: string;
}

export interface StudentEvolutionReport {
    studentName: string;
    trainerName: string;
    period: { start: string; end: string };
    rows: StudentEvolutionRow[];
    linkedProfessionals: { name: string; type: string }[];
}

// ---- ACTIONS ----

export async function getPerformanceReport(referenceMonth: string): Promise<PerformanceReport | null> {
    const profile = await getProfile();
    if (!profile || profile.role !== 'manager') return null;

    const admin = createAdminClient();

    const { data: snapshots } = await admin
        .from('performance_snapshots')
        .select('*, trainer:trainers!trainer_id(*, profile:profiles!profile_id(full_name))')
        .eq('reference_month', referenceMonth)
        .order('created_at');

    if (!snapshots || snapshots.length === 0) return null;

    const rows: PerformanceReportRow[] = snapshots.map((s: any) => ({
        trainerName: s.trainer?.profile?.full_name || 'Desconhecido',
        studentsStart: s.students_start,
        studentsEnd: s.students_end,
        cancellations: s.cancellations,
        retentionRate: Number(s.retention_rate),
        retentionTarget: Number(s.retention_target),
        retentionAchieved: s.retention_achieved,
        referralsCount: s.referrals_count,
        referralsTarget: s.referrals_target,
        referralsAchieved: s.referrals_achieved,
        managementRate: Number(s.management_rate),
        managementTarget: Number(s.management_target),
        managementAchieved: s.management_achieved,
        rewardAmount: Number(s.reward_amount),
        isFinalized: s.is_finalized,
    }));

    const eligible = rows.filter(r => r.studentsStart >= 5); // Mínimo para elegibilidade
    const totals = {
        avgRetention: eligible.length > 0
            ? eligible.reduce((sum, r) => sum + r.retentionRate, 0) / eligible.length
            : 0,
        totalReferrals: rows.reduce((sum, r) => sum + r.referralsCount, 0),
        avgManagement: rows.length > 0
            ? rows.reduce((sum, r) => sum + r.managementRate, 0) / rows.length
            : 0,
        totalRewards: rows.reduce((sum, r) => sum + r.rewardAmount, 0),
    };

    return { referenceMonth, rows, totals };
}

export async function getStudentMovementReport(
    startDate: string,
    endDate: string
): Promise<StudentMovementReport | null> {
    const profile = await getProfile();
    if (!profile || profile.role !== 'manager') return null;

    const admin = createAdminClient();

    // Buscar eventos de status_change e trainer_change no período
    const { data: events } = await admin
        .from('student_events')
        .select(`
            *,
            student:students!student_id(
                full_name,
                trainer:trainers!students_trainer_id_fkey(
                    profile:profiles!profile_id(full_name)
                )
            )
        `)
        .gte('event_date', startDate)
        .lte('event_date', endDate)
        .order('event_date', { ascending: false });

    // Novos alunos no período (start_date dentro do range)
    const { data: newStudents } = await admin
        .from('students')
        .select('full_name, start_date, trainer:trainers!students_trainer_id_fkey(profile:profiles!profile_id(full_name))')
        .gte('start_date', startDate)
        .lte('start_date', endDate)
        .eq('is_archived', false);

    const rows: StudentMovementRow[] = [];

    // Novos alunos
    (newStudents || []).forEach((s: any) => {
        rows.push({
            studentName: s.full_name,
            trainerName: s.trainer?.profile?.full_name || '-',
            eventType: 'new',
            eventDate: s.start_date,
        });
    });

    // Eventos de status
    (events || []).forEach((e: any) => {
        if (e.event_type === 'status_change') {
            const oldStatus = e.old_value?.status;
            const newStatus = e.new_value?.status;
            let eventType: StudentMovementRow['eventType'] = 'cancelled';

            if (newStatus === 'cancelled') eventType = 'cancelled';
            else if (newStatus === 'paused') eventType = 'paused';
            else if (newStatus === 'active' && (oldStatus === 'cancelled' || oldStatus === 'paused')) eventType = 'reactivated';

            rows.push({
                studentName: e.student?.full_name || '-',
                trainerName: e.student?.trainer?.profile?.full_name || '-',
                eventType,
                eventDate: e.event_date,
                details: `${oldStatus} → ${newStatus}`,
            });
        } else if (e.event_type === 'trainer_change') {
            rows.push({
                studentName: e.student?.full_name || '-',
                trainerName: e.student?.trainer?.profile?.full_name || '-',
                eventType: 'transferred',
                eventDate: e.event_date,
                details: 'Transferência de treinador',
            });
        }
    });

    // Ordenar por data
    rows.sort((a, b) => new Date(b.eventDate).getTime() - new Date(a.eventDate).getTime());

    const summary = {
        newStudents: rows.filter(r => r.eventType === 'new').length,
        cancellations: rows.filter(r => r.eventType === 'cancelled').length,
        paused: rows.filter(r => r.eventType === 'paused').length,
        reactivated: rows.filter(r => r.eventType === 'reactivated').length,
        transfers: rows.filter(r => r.eventType === 'transferred').length,
        netChange: 0,
    };
    summary.netChange = summary.newStudents + summary.reactivated - summary.cancellations;

    return { period: { start: startDate, end: endDate }, rows, summary };
}

export async function getProfessionalActivityReport(
    referenceMonth: string
): Promise<ProfessionalActivityReport | null> {
    const profile = await getProfile();
    if (!profile || profile.role !== 'manager') return null;

    const admin = createAdminClient();
    const monthStart = `${referenceMonth}-01`;
    const nextMonth = new Date(new Date(monthStart + 'T12:00:00').getTime());
    nextMonth.setMonth(nextMonth.getMonth() + 1);
    const monthEnd = new Date(nextMonth.getTime() - 86400000).toISOString().slice(0, 10);

    // Todos os profissionais ativos
    const { data: professionals } = await admin
        .from('professionals')
        .select('id, profession_type, profile:profiles!profile_id(full_name)')
        .eq('is_active', true);

    if (!professionals || professionals.length === 0) return null;

    const rows: ProfessionalActivityRow[] = [];

    for (const prof of professionals) {
        const profName = (prof as any).profile?.full_name || 'Desconhecido';
        const profType = prof.profession_type as 'nutritionist' | 'physiotherapist';

        // Pacientes ativos
        const { count: activePatients } = await admin
            .from('student_professionals')
            .select('id', { count: 'exact', head: true })
            .eq('professional_id', prof.id)
            .eq('status', 'active');

        if (profType === 'nutritionist') {
            const { count: consultCount } = await admin
                .from('nutrition_consultations')
                .select('id', { count: 'exact', head: true })
                .eq('professional_id', prof.id)
                .gte('consultation_date', monthStart)
                .lte('consultation_date', monthEnd);

            const { count: planCount } = await admin
                .from('nutrition_meal_plans')
                .select('id', { count: 'exact', head: true })
                .eq('professional_id', prof.id)
                .eq('is_active', true);

            const { data: lastConsult } = await admin
                .from('nutrition_consultations')
                .select('consultation_date')
                .eq('professional_id', prof.id)
                .order('consultation_date', { ascending: false })
                .limit(1);

            rows.push({
                professionalName: profName,
                professionType: profType,
                activePatients: activePatients || 0,
                activitiesThisMonth: consultCount || 0,
                activePlans: planCount || 0,
                lastActivityDate: lastConsult?.[0]?.consultation_date,
            });
        } else {
            const { count: sessionCount } = await admin
                .from('physio_sessions')
                .select('id', { count: 'exact', head: true })
                .eq('professional_id', prof.id)
                .gte('session_date', monthStart)
                .lte('session_date', monthEnd);

            const { count: planCount } = await admin
                .from('physio_treatment_plans')
                .select('id', { count: 'exact', head: true })
                .eq('professional_id', prof.id)
                .eq('status', 'active');

            const { data: lastSession } = await admin
                .from('physio_sessions')
                .select('session_date')
                .eq('professional_id', prof.id)
                .order('session_date', { ascending: false })
                .limit(1);

            rows.push({
                professionalName: profName,
                professionType: profType,
                activePatients: activePatients || 0,
                activitiesThisMonth: sessionCount || 0,
                activePlans: planCount || 0,
                lastActivityDate: lastSession?.[0]?.session_date,
            });
        }
    }

    return { referenceMonth, rows };
}

export async function getStudentEvolutionReport(
    studentId: string,
    startDate: string,
    endDate: string,
): Promise<StudentEvolutionReport | null> {
    const profile = await getProfile();
    if (!profile || profile.role !== 'manager') return null;

    const admin = createAdminClient();

    // Dados do aluno
    const { data: student } = await admin
        .from('students')
        .select('full_name, trainer:trainers!students_trainer_id_fkey(profile:profiles!profile_id(full_name))')
        .eq('id', studentId)
        .single();

    if (!student) return null;

    // Profissionais vinculados
    const { data: links } = await admin
        .from('student_professionals')
        .select('professional:professionals!professional_id(profession_type, profile:profiles!profile_id(full_name))')
        .eq('student_id', studentId)
        .eq('status', 'active');

    // Buscar dados de todas as disciplinas em paralelo
    const [assessments, consultations, sessions, events] = await Promise.all([
        admin
            .from('student_assessments')
            .select('id, performed_at, protocol_id')
            .eq('student_id', studentId)
            .gte('performed_at', startDate)
            .lte('performed_at', endDate)
            .order('performed_at', { ascending: false }),
        admin
            .from('nutrition_consultations')
            .select('id, consultation_date, notes')
            .eq('student_id', studentId)
            .gte('consultation_date', startDate)
            .lte('consultation_date', endDate)
            .order('consultation_date', { ascending: false }),
        admin
            .from('physio_sessions')
            .select('id, session_date, chief_complaint')
            .eq('student_id', studentId)
            .gte('session_date', startDate)
            .lte('session_date', endDate)
            .order('session_date', { ascending: false }),
        admin
            .from('student_events')
            .select('id, event_date, event_type, old_value, new_value')
            .eq('student_id', studentId)
            .gte('event_date', startDate)
            .lte('event_date', endDate)
            .order('event_date', { ascending: false }),
    ]);

    const rows: StudentEvolutionRow[] = [];

    (assessments.data || []).forEach((a: any) => {
        rows.push({
            date: a.performed_at,
            discipline: 'training',
            type: 'Avaliação Física',
            description: 'Protocolo de avaliação registrado',
        });
    });

    (consultations.data || []).forEach((c: any) => {
        rows.push({
            date: c.consultation_date,
            discipline: 'nutrition',
            type: 'Consulta Nutricional',
            description: c.notes?.substring(0, 100) || 'Consulta realizada',
        });
    });

    (sessions.data || []).forEach((s: any) => {
        rows.push({
            date: s.session_date,
            discipline: 'physiotherapy',
            type: 'Sessão de Fisioterapia',
            description: s.chief_complaint || 'Sessão realizada',
        });
    });

    (events.data || []).forEach((e: any) => {
        if (e.event_type === 'status_change') {
            rows.push({
                date: e.event_date,
                discipline: 'training',
                type: 'Mudança de Status',
                description: `${e.old_value?.status} → ${e.new_value?.status}`,
            });
        }
    });

    rows.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

    return {
        studentName: (student as any).full_name,
        trainerName: (student as any).trainer?.profile?.full_name || '-',
        period: { start: startDate, end: endDate },
        rows,
        linkedProfessionals: (links || []).map((l: any) => ({
            name: l.professional?.profile?.full_name || '-',
            type: l.professional?.profession_type || '-',
        })),
    };
}
```

---

## Tarefa 3 — Utilitários de Exportação

**Arquivo**: `web/src/lib/export-utils.ts` (novo)

Funções client-side para gerar PDF e XLSX a partir dos dados dos relatórios:

```typescript
// Funções utilitárias para exportação:
//
// exportPerformancePDF(report: PerformanceReport) → download PDF
// exportPerformanceXLSX(report: PerformanceReport) → download XLSX
// exportStudentMovementPDF(report: StudentMovementReport) → download PDF
// exportStudentMovementXLSX(report: StudentMovementReport) → download XLSX
// exportProfessionalActivityPDF(report: ProfessionalActivityReport) → download PDF
// exportProfessionalActivityXLSX(report: ProfessionalActivityReport) → download XLSX
// exportStudentEvolutionPDF(report: StudentEvolutionReport) → download PDF
// exportStudentEvolutionXLSX(report: StudentEvolutionReport) → download XLSX
```

Cada função:
1. Cria o documento (jsPDF ou ExcelJS Workbook)
2. Adiciona cabeçalho com logo/título do estúdio, data de geração
3. Formata os dados em tabela
4. Aplica estilo visual coerente com o tema do Playbook (verde/emerald)
5. Dispara download via `file-saver`

**Layout PDF padrão:**
- Header: "Playbook — [Nome do Relatório]"
- Subtítulo: período de referência
- Tabela com dados
- Footer: data/hora de geração

**Layout XLSX padrão:**
- Aba com nome do relatório
- Linha 1: título
- Linha 2: período
- Linha 4+: cabeçalhos + dados
- Formatação condicional onde aplicável (ex: retenção abaixo da meta em vermelho)
- Linha final: totais/resumo

---

## Tarefa 4 — Página de Relatórios

**Arquivo**: `web/src/app/dashboard/manager/reports/page.tsx` (novo)

Página principal que lista os 4 relatórios disponíveis como cards:

```typescript
export default async function ReportsPage() {
    // Verificar auth: manager only
    // Renderizar grid de cards de relatório
}
```

### Cards de relatório:

| Relatório | Descrição | Ícone |
|-----------|-----------|-------|
| **Performance Mensal** | KPIs de retenção, indicações e gestão de resultados por treinador | BarChart3 |
| **Movimentação de Alunos** | Novos, cancelados, pausados, reativados e transferidos | Users |
| **Atividade Profissional** | Consultas, sessões e planos por nutricionista e fisioterapeuta | Activity |
| **Evolução do Aluno** | Timeline integrada de um aluno específico (treino + nutrição + fisio) | TrendingUp |

Cada card é um link para a sub-página do relatório.

---

## Tarefa 5 — Sub-páginas de Relatório

### 5.1 — Performance Mensal

**Arquivo**: `web/src/app/dashboard/manager/reports/performance/page.tsx`

- Seletor de mês (dropdown com meses que têm snapshots)
- Tabela com dados de cada treinador
- Cards de resumo no topo (média retenção, total indicações, total recompensas)
- Botões "Exportar PDF" e "Exportar XLSX"
- Indicação visual: atingiu meta = verde, não atingiu = vermelho

### 5.2 — Movimentação de Alunos

**Arquivo**: `web/src/app/dashboard/manager/reports/student-movement/page.tsx`

- Seletores de data início/fim (padrão: mês atual)
- Cards de resumo: novos, cancelamentos, pausas, reativações, saldo líquido
- Tabela com cada evento listado
- Filtros por tipo de evento
- Botões "Exportar PDF" e "Exportar XLSX"

### 5.3 — Atividade Profissional

**Arquivo**: `web/src/app/dashboard/manager/reports/professional-activity/page.tsx`

- Seletor de mês
- Tabela comparativa de todos os profissionais
- Colunas: nome, tipo, pacientes ativos, atividades no mês, planos ativos, última atividade
- Botões "Exportar PDF" e "Exportar XLSX"

### 5.4 — Evolução do Aluno

**Arquivo**: `web/src/app/dashboard/manager/reports/student-evolution/page.tsx`

- Seletor de aluno (combobox com busca)
- Seletores de data início/fim (padrão: últimos 3 meses)
- Card com dados do aluno + profissionais vinculados
- Timeline de eventos de todas as disciplinas
- Botões "Exportar PDF" e "Exportar XLSX"

---

## Tarefa 6 — Ativar item no Sidebar

**Arquivo**: `web/src/components/sidebar.tsx`

Mover "Relatórios" dos `evolutionItems` para os `managerActiveLinks`:

```typescript
// ANTES (evolutionItems):
{ label: 'Relatórios', icon: FileText, disabled: true },

// DEPOIS (managerActiveLinks — adicionar ao final):
{ href: '/dashboard/manager/reports', label: 'Relatórios', icon: FileText },
```

E remover dos `evolutionItems`.

---

## Estrutura de Novos Arquivos

```
web/src/
├── app/
│   ├── actions/
│   │   └── reports.ts                              # 4 server actions de dados
│   └── dashboard/manager/reports/
│       ├── page.tsx                                 # Hub de relatórios
│       ├── performance/page.tsx                     # Relatório de performance
│       ├── student-movement/page.tsx                # Movimentação de alunos
│       ├── professional-activity/page.tsx           # Atividade profissional
│       └── student-evolution/page.tsx               # Evolução do aluno
├── lib/
│   └── export-utils.ts                             # Funções de export PDF/XLSX
└── components/sidebar.tsx                          # Ativar link de relatórios
```

**Nenhuma migration necessária.**

---

## Dependências Novas

```json
{
    "jspdf": "^2.5.2",
    "jspdf-autotable": "^3.8.4",
    "exceljs": "^4.4.0",
    "file-saver": "^2.0.5"
}
```

---

## Checklist

### Backend
- [ ] Instalar dependências (`jspdf`, `exceljs`, `file-saver`)
- [ ] Criar `web/src/app/actions/reports.ts` com 4 actions
- [ ] Criar `web/src/lib/export-utils.ts` com 8 funções de exportação

### Páginas
- [ ] Criar `reports/page.tsx` — hub com 4 cards
- [ ] Criar `reports/performance/page.tsx` — relatório de performance
- [ ] Criar `reports/student-movement/page.tsx` — movimentação
- [ ] Criar `reports/professional-activity/page.tsx` — atividade profissional
- [ ] Criar `reports/student-evolution/page.tsx` — evolução do aluno

### Sidebar
- [ ] Mover "Relatórios" dos evolutionItems para managerActiveLinks

### Exportação
- [ ] Testar exportação PDF de cada relatório
- [ ] Testar exportação XLSX de cada relatório
- [ ] Verificar formatação visual dos PDFs

### Verificação
- [ ] Type check (`npx tsc --noEmit`)
- [ ] Testar com mês que tem snapshots finalizados
- [ ] Testar com período sem dados (estados vazios)
- [ ] Testar export com dados reais
- [ ] Verificar responsividade das tabelas
