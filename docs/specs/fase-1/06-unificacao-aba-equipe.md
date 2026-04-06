# Spec 06 — Unificação: Aba "Equipe"

**Objetivo:** Unificar as abas "Treinadores" e "Profissionais" em uma única aba "Equipe" no painel do manager.
**Pré-requisito:** Specs 01-04 implementadas
**Migrations:** Nenhuma (mudança apenas no frontend)

---

## Contexto

Atualmente a sidebar do manager tem duas abas separadas:
- **Treinadores** (`/dashboard/manager/trainers`) — lista treinadores com KPIs (gestão, retenção)
- **Profissionais** (`/dashboard/manager/professionals`) — lista nutricionistas e fisioterapeutas

Isso cria uma divisão artificial. Queremos uma aba única **"Equipe"** que lista todos os profissionais da academia com filtros por tipo, mantendo formulários de criação separados (treinador tem campos de comissão/KPI que os outros não têm).

---

## Tarefa 1: Nova página unificada de listagem

**Arquivo:** `web/src/app/dashboard/manager/team/page.tsx` (novo)

### Data fetching (Server Component)

Buscar dados de ambas as fontes em paralelo:

```typescript
import { createClient } from '@/lib/supabase/server';
import { getProfile } from '@/app/actions/auth';
import { redirect } from 'next/navigation';

export default async function TeamPage() {
    const profile = await getProfile();
    if (!profile || profile.role !== 'manager') redirect('/dashboard');

    const supabase = await createClient();

    // Buscar em paralelo
    const [trainersResult, professionalsResult] = await Promise.all([
        // Treinadores (da tabela trainers, como já funciona hoje)
        supabase
            .from('trainers')
            .select('*, profile:profiles!profile_id(*)')
            .order('is_active', { ascending: false })
            .order('created_at', { ascending: false }),

        // Nutricionistas e fisioterapeutas (da tabela professionals)
        supabase
            .from('professionals')
            .select(`
                *,
                profile:profiles!profile_id(full_name, email, avatar_url),
                student_count:student_professionals(count)
            `)
            .in('profession_type', ['nutritionist', 'physiotherapist'])
            .order('is_active', { ascending: false })
            .order('created_at', { ascending: false })
    ]);

    // Contar alunos ativos por treinador (mesmo padrão da página atual)
    const { data: studentCounts } = await supabase
        .from('students')
        .select('trainer_id')
        .eq('status', 'active')
        .eq('is_archived', false);

    const trainerStudentMap = new Map<string, number>();
    studentCounts?.forEach(s => {
        if (s.trainer_id) {
            trainerStudentMap.set(s.trainer_id, (trainerStudentMap.get(s.trainer_id) || 0) + 1);
        }
    });

    // Normalizar para formato unificado
    const trainers = (trainersResult.data || []).map(t => ({
        id: t.id,
        profileId: t.profile_id,
        name: t.profile?.full_name || '',
        email: t.profile?.email || '',
        avatarUrl: t.profile?.avatar_url,
        type: 'trainer' as const,
        startDate: t.start_date,
        isActive: t.is_active,
        notes: t.notes,
        activeStudents: trainerStudentMap.get(t.id) || 0,
        // Campos exclusivos de treinador (serão usados nas colunas expandidas)
        trainerId: t.id,
    }));

    const professionals = (professionalsResult.data || []).map(p => ({
        id: p.id,
        profileId: p.profile_id,
        name: p.profile?.full_name || '',
        email: p.profile?.email || '',
        avatarUrl: p.profile?.avatar_url,
        type: p.profession_type as 'nutritionist' | 'physiotherapist',
        startDate: p.start_date,
        isActive: p.is_active,
        notes: p.notes,
        activeStudents: p.student_count?.[0]?.count || 0,
    }));

    const allMembers = [...trainers, ...professionals];

    return (
        <div className="space-y-6">
            <TeamHeader />
            <TeamTable members={allMembers} />
        </div>
    );
}
```

### Tipo unificado

Criar em `web/src/types/database.ts` (ou no próprio arquivo da tabela):

```typescript
export interface TeamMember {
    id: string;           // trainer.id ou professional.id
    profileId: string;
    name: string;
    email: string;
    avatarUrl: string | null;
    type: 'trainer' | 'nutritionist' | 'physiotherapist';
    startDate: string;
    isActive: boolean;
    notes: string | null;
    activeStudents: number;
    trainerId?: string;   // Apenas para treinadores (para ações de KPI)
}
```

---

## Tarefa 2: Componente TeamTable

**Arquivo:** `web/src/app/dashboard/manager/team/team-table.tsx` (novo, Client Component)

### Props

```typescript
interface TeamTableProps {
    members: TeamMember[];
}
```

### Filtros (toolbar)

Barra de ferramentas com:
1. **Campo de busca** — filtrar por nome ou email (input com ícone Search)
2. **Filtro por tipo** — botões: `Todos` | `Treinadores` | `Nutricionistas` | `Fisioterapeutas`
3. **Toggle ativo/arquivado** — botão para mostrar/ocultar inativos
4. **Botão "Novo"** — dropdown com 3 opções:
   - "Novo Treinador" → navega para `/dashboard/manager/trainers/new`
   - "Novo Nutricionista" → navega para `/dashboard/manager/professionals/new?type=nutritionist`
   - "Novo Fisioterapeuta" → navega para `/dashboard/manager/professionals/new?type=physiotherapist`

### Colunas da tabela

| # | Coluna | Conteúdo | Notas |
|---|--------|----------|-------|
| 1 | **Profissional** | Avatar + nome + email | Mesmo padrão do trainer-table atual |
| 2 | **Tipo** | Badge colorido: Treinador (cinza), Nutricionista (verde/emerald), Fisioterapeuta (azul) | Usar `<ProfessionBadge>` existente, adicionar suporte para 'trainer' |
| 3 | **Alunos/Pacientes** | Número de alunos ativos / pacientes vinculados | Centro-alinhado |
| 4 | **Início** | Data de início formatada | `formatDate(startDate)` |
| 5 | **Status** | Badge "Ativo" (verde) ou "Inativo" (cinza) | Clicável para toggle |
| 6 | **Ações** | Menu dropdown | Varia por tipo (ver abaixo) |

### Ações no dropdown (por tipo)

**Para treinadores:**
- Editar dados → abre `<EditTrainerDialog>` (reutilizar o existente)
- Redefinir senha → abre `<ResetPasswordDialog>` (reutilizar o existente)
- Ver KPIs → navega para `/dashboard/manager` (ou seção de performance do treinador)
- Arquivar / Reativar → alterna `is_active`

**Para nutricionistas e fisioterapeutas:**
- Redefinir senha → abre dialog inline (mesmo padrão do professionals-table atual)
- Ativar / Desativar → alterna `is_active` via `toggleProfessionalStatus()`

### Lógica de filtro

```typescript
const [search, setSearch] = useState('');
const [typeFilter, setTypeFilter] = useState<'all' | 'trainer' | 'nutritionist' | 'physiotherapist'>('all');
const [showInactive, setShowInactive] = useState(false);

const filtered = useMemo(() => {
    return members.filter(m => {
        // Filtro de texto
        const matchesSearch = !search ||
            m.name.toLowerCase().includes(search.toLowerCase()) ||
            m.email.toLowerCase().includes(search.toLowerCase());

        // Filtro de tipo
        const matchesType = typeFilter === 'all' || m.type === typeFilter;

        // Filtro de status
        const matchesStatus = showInactive || m.isActive;

        return matchesSearch && matchesType && matchesStatus;
    });
}, [members, search, typeFilter, showInactive]);
```

---

## Tarefa 3: Atualizar o formulário de novo profissional

**Arquivo:** `web/src/app/dashboard/manager/professionals/new/page.tsx` (alterar)

Aceitar query param `?type=nutritionist` ou `?type=physiotherapist` para pré-selecionar o tipo:

```typescript
// Ler query param
import { useSearchParams } from 'next/navigation';
const searchParams = useSearchParams();
const preselectedType = searchParams.get('type');

// Usar como valor inicial do select de profession_type
// Se preselectedType é válido, usar como default e opcionalmente ocultar o select
```

Também atualizar o botão "Voltar" para apontar para `/dashboard/manager/team` em vez de `/dashboard/manager/professionals`.

---

## Tarefa 4: Atualizar o formulário de novo treinador

**Arquivo:** `web/src/app/dashboard/manager/trainers/new/page.tsx` (alterar)

Atualizar o botão "Voltar" para apontar para `/dashboard/manager/team` em vez de `/dashboard/manager/trainers`.

---

## Tarefa 5: Atualizar ProfessionBadge

**Arquivo:** `web/src/components/profession-badge.tsx` (alterar)

Adicionar suporte para `type = 'trainer'`:

```typescript
// Adicionar caso:
case 'trainer':
    return <Badge className="bg-gray-100 text-gray-700 border-gray-200">Treinador</Badge>;
```

---

## Tarefa 6: Atualizar sidebar

**Arquivo:** `web/src/components/sidebar.tsx` (alterar)

### Remover
- Link "Treinadores" (`/dashboard/manager/trainers`)
- Link "Profissionais" (`/dashboard/manager/professionals`)

### Adicionar
- Link **"Equipe"** (`/dashboard/manager/team`) com ícone `Users` do lucide-react
- Posicionar logo após "Visão Geral"

### Resultado esperado na sidebar
```
Visão Geral
Equipe          ← NOVO (substitui "Treinadores" e "Profissionais")
Alunos
Agenda
Gestão de Resultados
Política de Incentivos
```

---

## Tarefa 7: Atualizar revalidatePath em actions

**Arquivo:** `web/src/app/actions/professionals.ts` (alterar)

Adicionar `revalidatePath('/dashboard/manager/team')` em todas as actions que fazem revalidate:
- `createProfessional`
- `toggleProfessionalStatus`
- `linkStudentToProfessional`
- `unlinkStudentFromProfessional`

**Arquivo:** `web/src/app/actions/manager.ts` (alterar)

Adicionar `revalidatePath('/dashboard/manager/team')` nas actions de treinadores:
- `createTrainer`
- `updateTrainer`
- `toggleTrainerStatus`

---

## Tarefa 8: Redirects de compatibilidade

**Arquivo:** `web/src/app/dashboard/manager/trainers/page.tsx` (alterar)

Substituir o conteúdo por um redirect simples para manter links antigos funcionando:

```typescript
import { redirect } from 'next/navigation';
export default function TrainersPage() {
    redirect('/dashboard/manager/team?type=trainer');
}
```

**Arquivo:** `web/src/app/dashboard/manager/professionals/page.tsx` (alterar)

```typescript
import { redirect } from 'next/navigation';
export default function ProfessionalsPage() {
    redirect('/dashboard/manager/team');
}
```

> **Nota:** NÃO deletar os diretórios `trainers/` e `professionals/` — os formulários `new/page.tsx` e componentes de dialog continuam lá. Só as páginas de listagem viram redirect.

---

## Tarefa 9: Atualizar TeamTable para ler filtro da URL

Se o redirect da Tarefa 8 usa `?type=trainer`, a TeamTable precisa ler esse query param como filtro inicial:

```typescript
const searchParams = useSearchParams();
const initialType = searchParams.get('type') as typeof typeFilter || 'all';
const [typeFilter, setTypeFilter] = useState(initialType);
```

---

## Checklist de validação

- [ ] `npm run build` passa sem erros
- [ ] Sidebar mostra "Equipe" em vez de "Treinadores" + "Profissionais"
- [ ] Aba "Equipe" lista todos: treinadores + nutricionistas + fisioterapeutas
- [ ] Filtro "Treinadores" mostra apenas treinadores
- [ ] Filtro "Nutricionistas" mostra apenas nutricionistas
- [ ] Filtro "Fisioterapeutas" mostra apenas fisioterapeutas
- [ ] Busca por nome/email funciona em todos os tipos
- [ ] Toggle ativo/inativo funciona
- [ ] Botão "Novo" mostra dropdown com 3 opções e navega corretamente
- [ ] Colunas mostram dados corretos (tipo com badge, alunos, status)
- [ ] Ações de treinador (editar, resetar senha, arquivar) funcionam
- [ ] Ações de profissional (resetar senha, ativar/desativar) funcionam
- [ ] `/dashboard/manager/trainers` redireciona para `/dashboard/manager/team?type=trainer`
- [ ] `/dashboard/manager/professionals` redireciona para `/dashboard/manager/team`
- [ ] Formulários de criação continuam funcionando (treinador e profissional)
- [ ] Botão "Voltar" nos formulários aponta para `/dashboard/manager/team`
- [ ] `ProfessionBadge` mostra "Treinador" em cinza corretamente
