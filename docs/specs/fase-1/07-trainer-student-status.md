# Spec 07 — Treinador: Alterar Status do Aluno (Pausar / Cancelar)

## Contexto

O gestor reportou que treinadores não conseguem marcar alunos como inativos. Após análise, o problema é que **não existe nenhuma server action que permita ao treinador alterar o status do aluno**. A única action que muda status (`updateStudent()`) exige `role === 'manager'`.

Isso é **crítico** porque a retenção do snapshot mensal depende de alunos com `status = 'cancelled'` — sem esse fluxo, o KPI de retenção fica artificialmente em 100%.

### O que já funciona

- **RLS**: A policy `"Trainers can update own students"` já permite UPDATE em students onde `trainer_id = get_trainer_id()`.
- **Eventos**: A policy `"Users can create events"` já permite INSERT em `student_events` para treinadores.
- **UI do Gestor**: O `manager/students/student-table.tsx` já tem "Pausar", "Cancelar" e "Ativar" funcionando via `updateStudent()`.

### O que falta

1. Uma **server action** `trainerUpdateStudentStatus()` em `manager.ts`.
2. Os **botões Pausar/Cancelar** no dropdown do `trainer/students/student-table.tsx`.

---

## Tarefa 1 — Server Action: `trainerUpdateStudentStatus()`

**Arquivo**: `web/src/app/actions/manager.ts`

**Inserir após** a função `trainerArchiveStudent()` (após linha ~583).

```typescript
// =====================================================
// TRAINER: CHANGE STUDENT STATUS (PAUSE / CANCEL)
// =====================================================

export async function trainerUpdateStudentStatus(
    studentId: string,
    newStatus: 'active' | 'paused' | 'cancelled'
) {
    const profile = await getProfile();
    if (!profile || profile.role !== 'trainer') {
        throw new Error('Não autorizado');
    }

    const trainerId = await getTrainerId();
    if (!trainerId) {
        throw new Error('Perfil de treinador não encontrado');
    }

    const supabase = await createClient();

    // Verify student belongs to this trainer
    const { data: student, error: fetchError } = await supabase
        .from('students')
        .select('id, trainer_id, full_name, status')
        .eq('id', studentId)
        .single();

    if (fetchError || !student) {
        throw new Error('Aluno não encontrado');
    }

    if (student.trainer_id !== trainerId) {
        throw new Error('Você só pode alterar alunos da sua carteira');
    }

    if (student.status === newStatus) {
        throw new Error('O aluno já está com esse status');
    }

    const today = new Date().toISOString().split('T')[0];

    // Build update payload
    const updates: Record<string, any> = { status: newStatus };
    if (newStatus === 'cancelled') {
        updates.end_date = today;
    }

    // 1. Update student status
    const { error: updateError } = await supabase
        .from('students')
        .update(updates)
        .eq('id', studentId);

    if (updateError) {
        throw new Error(`Erro ao alterar status: ${updateError.message}`);
    }

    // 2. Log event in student_events (essential for snapshot retention calculation)
    const { error: eventError } = await supabase
        .from('student_events')
        .insert({
            student_id: studentId,
            event_type: 'status_change',
            old_value: { status: student.status },
            new_value: { status: newStatus },
            event_date: today,
            created_by: profile.id,
        });

    if (eventError) {
        console.error('Error logging status change event:', eventError);
    }

    // 3. Log trainer activity
    const admin = createAdminClient();
    try {
        await admin.from('trainer_activity_log').insert({
            trainer_id: trainerId,
            activity_type: 'student_status_update',
            metadata: {
                student_id: studentId,
                student_name: student.full_name,
                old_status: student.status,
                new_status: newStatus,
            },
        });
    } catch {
        // Silent failure for activity log
    }

    revalidatePath('/dashboard/trainer/students');
    return { success: true };
}
```

### Notas de implementação

- Usa `supabase` (não `adminClient`) para respeitar RLS — o treinador só atualiza seus próprios alunos.
- Seta `end_date = today` quando o status é `cancelled` (mesmo padrão de `updateStudent()` do gestor).
- Registra evento em `student_events` com `event_type: 'status_change'` — **essencial** para que `calculate_retention()` compute corretamente os cancelamentos do mês.
- Registra atividade em `trainer_activity_log` com `activity_type: 'student_status_update'` (já suportado pelo enum de atividades).

---

## Tarefa 2 — UI: Adicionar Pausar/Cancelar no Dropdown do Treinador

**Arquivo**: `web/src/app/dashboard/trainer/students/student-table.tsx`

### 2.1 — Adicionar imports

Na linha de import do `manager.ts`, adicionar `trainerUpdateStudentStatus`:

```typescript
import { trainerArchiveStudent, trainerTransferStudent, trainerUpdateStudentStatus } from '@/app/actions/manager';
```

Adicionar ícones Lucide faltantes:

```typescript
import {
    Search,
    MoreVertical,
    History,
    PlusCircle,
    Users,
    AlertCircle,
    CheckCircle2,
    Calendar,
    ArrowUpDown,
    Archive,
    ArrowRightLeft,
    RefreshCcw,      // NOVO
    UserX,           // NOVO
    UserCheck,       // NOVO
} from 'lucide-react';
```

Adicionar import de `DropdownMenuLabel` e `DropdownMenuSeparator` (caso não estejam):

```typescript
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuLabel,      // NOVO
    DropdownMenuSeparator,
    DropdownMenuTrigger
} from '@/components/ui/dropdown-menu';
```

### 2.2 — Adicionar handler de status change

Dentro do componente `StudentTable`, adicionar a função `handleStatusChange`:

```typescript
function handleStatusChange(studentId: string, studentName: string, newStatus: 'active' | 'paused' | 'cancelled') {
    const statusLabels = { active: 'ativo', paused: 'pausado', cancelled: 'cancelado' };
    if (!confirm(`Deseja alterar o status de ${studentName} para ${statusLabels[newStatus]}?`)) return;

    startTransition(async () => {
        try {
            await trainerUpdateStudentStatus(studentId, newStatus);
            toast.success(`Status de ${studentName} alterado para ${statusLabels[newStatus]}`);
            router.refresh();
        } catch (error) {
            toast.error(error instanceof Error ? error.message : 'Erro ao alterar status');
        }
    });
}
```

### 2.3 — Atualizar o DropdownMenu

No dropdown de cada aluno (dentro do `.map()`), substituir o bloco atual:

**DE:**
```tsx
<DropdownMenuContent align="end" className="bg-white">
    <Link href={`/dashboard/trainer/students/${student.id}`}>
        <DropdownMenuItem>
            <History className="mr-2 h-4 w-4" />
            Ver Histórico
        </DropdownMenuItem>
    </Link>
    <Link href={`/dashboard/trainer/students/${student.id}?action=new-assessment`}>
        <DropdownMenuItem>
            <PlusCircle className="mr-2 h-4 w-4" />
            Nova Avaliação
        </DropdownMenuItem>
    </Link>
    {trainers.length > 0 && (
        <DropdownMenuItem
            onClick={() => setTransferTarget({ id: student.id, name: student.full_name })}
        >
            <ArrowRightLeft className="mr-2 h-4 w-4" />
            Transferir aluno
        </DropdownMenuItem>
    )}
    <DropdownMenuSeparator />
    <DropdownMenuItem
        onClick={() => setArchiveTarget({ id: student.id, name: student.full_name })}
        className="text-red-600 focus:text-red-600"
    >
        <Archive className="mr-2 h-4 w-4" />
        Arquivar
    </DropdownMenuItem>
</DropdownMenuContent>
```

**PARA:**
```tsx
<DropdownMenuContent align="end" className="bg-white">
    <Link href={`/dashboard/trainer/students/${student.id}`}>
        <DropdownMenuItem>
            <History className="mr-2 h-4 w-4" />
            Ver Histórico
        </DropdownMenuItem>
    </Link>
    <Link href={`/dashboard/trainer/students/${student.id}?action=new-assessment`}>
        <DropdownMenuItem>
            <PlusCircle className="mr-2 h-4 w-4" />
            Nova Avaliação
        </DropdownMenuItem>
    </Link>
    {trainers.length > 0 && (
        <DropdownMenuItem
            onClick={() => setTransferTarget({ id: student.id, name: student.full_name })}
        >
            <ArrowRightLeft className="mr-2 h-4 w-4" />
            Transferir aluno
        </DropdownMenuItem>
    )}

    <DropdownMenuSeparator />
    <DropdownMenuLabel>Alterar Status</DropdownMenuLabel>

    {student.status !== 'active' && (
        <DropdownMenuItem
            onClick={() => handleStatusChange(student.id, student.full_name, 'active')}
        >
            <UserCheck className="mr-2 h-4 w-4 text-emerald-600" />
            Ativar
        </DropdownMenuItem>
    )}
    {student.status !== 'paused' && (
        <DropdownMenuItem
            onClick={() => handleStatusChange(student.id, student.full_name, 'paused')}
        >
            <RefreshCcw className="mr-2 h-4 w-4 text-amber-600" />
            Pausar
        </DropdownMenuItem>
    )}
    {student.status !== 'cancelled' && (
        <DropdownMenuItem
            onClick={() => handleStatusChange(student.id, student.full_name, 'cancelled')}
        >
            <UserX className="mr-2 h-4 w-4 text-red-600" />
            Cancelar
        </DropdownMenuItem>
    )}

    <DropdownMenuSeparator />
    <DropdownMenuItem
        onClick={() => setArchiveTarget({ id: student.id, name: student.full_name })}
        className="text-red-600 focus:text-red-600"
    >
        <Archive className="mr-2 h-4 w-4" />
        Arquivar
    </DropdownMenuItem>
</DropdownMenuContent>
```

### 2.4 — Nota sobre `student.status`

A tabela do treinador atualmente recebe `ExtendedStudent` que estende `Student`. O tipo `Student` já contém `status: StudentStatus` (`'active' | 'cancelled' | 'paused'`). Porém, a query na page atual pode estar filtrando apenas alunos ativos. Verificar em `trainer/students/page.tsx` se o filtro `.eq('status', 'active')` precisa ser removido ou ajustado para incluir `paused`.

---

## Tarefa 3 — Verificar query da page do treinador

**Arquivo**: `web/src/app/dashboard/trainer/students/page.tsx`

**CONFIRMADO**: Na linha 41 de `page.tsx`, a query tem `.eq('status', 'active')` — isso filtra **apenas** alunos ativos. Quando o treinador pausa um aluno, ele desaparece da lista e fica "perdido".

**Correção**: Alterar a query na função `getTrainerStudents()`:

```typescript
// ANTES (linha 41):
.eq('status', 'active')

// DEPOIS:
.in('status', ['active', 'paused'])
```

Assim alunos pausados continuam visíveis na lista do treinador (mas cancelados não — consistente com o comportamento do gestor que tem filtros separados para "Ativos", "Pausados", "Cancelados").

**Opcional (futuro)**: Adicionar filtros de status (tabs) na lista do treinador, similar ao gestor.

---

## Impacto no Snapshot

Com esta correção:
1. Treinador cancela aluno → `students.status = 'cancelled'`, `students.end_date = today`
2. Evento registrado em `student_events` com `event_type = 'status_change'`
3. No fim do mês, `calculate_retention()` conta esse cancelamento corretamente
4. `generate_performance_snapshot()` registra a retenção real
5. Comissão é calculada com dados fidedignos

---

## Checklist de Implementação

- [ ] Adicionar `trainerUpdateStudentStatus()` em `web/src/app/actions/manager.ts`
- [ ] Atualizar imports em `web/src/app/dashboard/trainer/students/student-table.tsx`
- [ ] Adicionar `handleStatusChange()` no componente `StudentTable` do treinador
- [ ] Atualizar dropdown com opções Pausar/Cancelar/Ativar
- [ ] Verificar/ajustar query em `web/src/app/dashboard/trainer/students/page.tsx`
- [ ] Testar: treinador pausar aluno → status muda, evento registrado
- [ ] Testar: treinador cancelar aluno → status muda, end_date setado, evento registrado
- [ ] Testar: treinador reativar aluno pausado → status volta a active
- [ ] Verificar que snapshot do mês reflete cancelamentos corretamente

---

## Arquivos Modificados

| Arquivo | Tipo de Mudança |
|---------|----------------|
| `web/src/app/actions/manager.ts` | Nova função `trainerUpdateStudentStatus()` |
| `web/src/app/dashboard/trainer/students/student-table.tsx` | Novos imports, handler, opções no dropdown |
| `web/src/app/dashboard/trainer/students/page.tsx` | Ajuste de query (se necessário) |

**Nenhuma migration necessária** — as RLS policies já suportam essa operação.
