# Spec Fase 3.02 — Encaminhamentos e Solicitações

## Contexto

A spec 3.01 entregou a fundação de dados (`interdisciplinary_referrals` + `referral_replies`) e as server actions (`referrals.ts`). Agora falta a interface para os profissionais **usarem** esse canal: criar um encaminhamento/solicitação, ver a caixa de entrada, abrir uma thread e responder.

Dois cenários reais que essa UI resolve:

- **Encaminhamento** (`referral`): o treinador percebe que o aluno reclama de dor no joelho e encaminha para o fisioterapeuta com contexto.
- **Solicitação** (`request`): o nutricionista precisa do gasto calórico estimado do treino para fechar a dieta e solicita essa informação ao treinador.

## Objetivo

Criar a página **"Mensagens"** (inbox unificado), o dialog de **nova mensagem** acessível a partir da ficha do aluno, e o componente de **thread** com respostas e mudança de status. Adicionar o link no sidebar para todos os perfis profissionais.

---

## Arquitetura de Navegação

A comunicação é acessível por dois caminhos:

1. **Inbox global** (`/dashboard/messages`): lista todas as mensagens recebidas/enviadas do profissional, independente do aluno. É a "caixa de entrada" do dia a dia.
2. **Contextual na ficha do aluno**: botão "Nova mensagem" e lista de mensagens daquele aluno, dentro da aba 360° (reaproveitando o layout de tabs da spec 2.01).

O inbox é rota compartilhada por `manager`, `trainer`, `nutritionist` e `physiotherapist` — cada um vê o que o RLS permite.

---

## Tarefa 1 — Link no Sidebar

**Arquivo**: `web/src/components/sidebar.tsx`

Adicionar o item "Mensagens" às listas de links de **todos** os perfis (`managerActiveLinks`, `trainerActiveLinks`, `nutritionistActiveLinks`, `physiotherapistActiveLinks`):

```typescript
import { MessageSquare } from 'lucide-react';

// Em cada lista de links ativos, adicionar:
{ href: '/dashboard/messages', label: 'Mensagens', icon: MessageSquare },
```

O badge de contagem de pendências entra na spec 05 (junto com o sino de notificações). Por ora o link é estático.

---

## Tarefa 2 — Página Inbox

**Arquivo**: `web/src/app/dashboard/messages/page.tsx` (novo, server component)

```typescript
import { getMyReferrals } from '@/app/actions/referrals';
import { getProfile } from '@/app/actions/auth';
import { MessagesInbox } from './messages-inbox';

export default async function MessagesPage() {
    const [profile, inbox, sent] = await Promise.all([
        getProfile(),
        getMyReferrals('inbox'),
        getMyReferrals('sent'),
    ]);

    return (
        <div className="space-y-6">
            <div>
                <h1 className="text-2xl font-semibold text-zinc-900">Mensagens</h1>
                <p className="text-sm text-zinc-500">
                    Encaminhamentos e solicitações entre os profissionais que atendem os mesmos alunos.
                </p>
            </div>
            <MessagesInbox inbox={inbox} sent={sent} isManager={profile?.role === 'manager'} />
        </div>
    );
}
```

> **Nota para o manager**: ele não cria nem responde encaminhamentos, mas acompanha. Para o manager, `getMyReferrals` retornará vazio (ele não tem `professional_id`). Mostre, em vez disso, uma visão somente-leitura de todos os encaminhamentos recentes — opcional nesta spec; se for incluir, crie `getAllReferrals()` em `referrals.ts` restrito a `is_manager`.

---

## Tarefa 3 — Componente Inbox

**Arquivo**: `web/src/app/dashboard/messages/messages-inbox.tsx` (novo, `'use client'`)

Layout master-detail:

- **Coluna esquerda**: tabs "Recebidos" / "Enviados" + lista de mensagens (assunto, aluno, remetente/destinatário, badge de status, badge de prioridade, tempo relativo). Item não-resolvido com `status='pending'` em destaque.
- **Coluna direita**: thread selecionada (`ReferralThread`, Tarefa 5). Em mobile, vira navegação por tela cheia.

```typescript
interface MessagesInboxProps {
    inbox: InterdisciplinaryReferral[];
    sent: InterdisciplinaryReferral[];
    isManager: boolean;
}
```

Mapeamento visual (reaproveite os tokens de cor da spec 2.02):

```
Status:
- pending    → amber   ("Pendente")
- accepted   → blue    ("Em andamento")
- completed  → emerald ("Concluído")
- declined   → zinc    ("Recusado")

Tipo (ícone + label):
- referral → ArrowRightLeft  ("Encaminhamento")
- request  → HelpCircle      ("Solicitação")
- clearance→ ShieldCheck     ("Liberação")  // criado na spec 03
- alert    → Bell            ("Alerta")

Prioridade:
- high   → ponto vermelho + "Alta"
- normal → sem destaque
- low    → texto zinc-400
```

Use `ProfessionBadge` (`components/profession-badge.tsx`) para mostrar a profissão do outro participante.

---

## Tarefa 4 — Dialog "Nova Mensagem"

**Arquivo**: `web/src/components/referrals/new-referral-dialog.tsx` (novo, `'use client'`)

Reaproveite o padrão de `components/link-professional-dialog.tsx` (Radix Dialog já usado no projeto).

```typescript
interface NewReferralDialogProps {
    studentId: string;
    studentName: string;
    // Profissionais que atendem o aluno (de getCoProfessionals), exceto eu
    coProfessionals: { id: string; profession_type: ProfessionType; full_name: string }[];
    // Pré-preenche contexto quando aberto a partir de uma consulta/sessão específica
    defaultContextRef?: { table: string; id: string };
    trigger?: React.ReactNode;
}
```

Campos do formulário:

| Campo | Controle | Observação |
|-------|----------|------------|
| Tipo | Select | `referral` ou `request` (clearance tem fluxo próprio na spec 03) |
| Destinatário | Select | opções de `coProfessionals`, rotuladas "Nome — Profissão" |
| Prioridade | Select | low / normal / high (default normal) |
| Assunto | Input | obrigatório |
| Mensagem | Textarea | opcional |

Ao enviar, chama `createReferral(...)`. Em sucesso, fecha o dialog, toast de confirmação (`sonner` já é dependência) e `router.refresh()`. Em erro, mostra a mensagem retornada pela action.

Estado vazio: se `coProfessionals.length === 0`, mostrar aviso "Este aluno ainda não tem outros profissionais vinculados" com CTA desabilitado — não dá para encaminhar sem destinatário.

---

## Tarefa 5 — Componente Thread

**Arquivo**: `web/src/components/referrals/referral-thread.tsx` (novo, `'use client'`)

Renderiza uma mensagem aberta:

- **Cabeçalho**: assunto, badges (tipo, status, prioridade), aluno (link para a ficha), remetente → destinatário com `ProfessionBadge`, data.
- **Contexto de origem** (se `context_ref`): card clicável "Ver origem" que leva ao registro (ex.: `physio_sessions` → ficha do paciente na aba fisio). Mapeie `context_ref.table` → href.
- **Corpo** + **lista de respostas** (`replies`) em ordem cronológica, cada uma com autor e profissão.
- **Ações de status** (apenas para o **destinatário**, e enquanto não resolvido):
  - `pending` → botões "Aceitar" (`accepted`) e "Recusar" (`declined`)
  - `accepted` → botão "Marcar como concluído" (`completed`)
  - Remetente vê botão "Cancelar" (`declined`) enquanto `pending`.
- **Campo de resposta**: textarea + botão "Responder" → `addReferralReply`.

Todas as ações chamam as server actions da spec 01 e fazem `router.refresh()`.

```typescript
interface ReferralThreadProps {
    referral: InterdisciplinaryReferral;   // de getReferralThread()
    currentProfessionalId: string | null;  // para decidir quem vê quais botões
    readOnly?: boolean;                     // true para o manager
}
```

---

## Tarefa 6 — Integração na Ficha do Aluno (aba 360°)

**Arquivo**: `web/src/components/integrated/student-detail-tabs.tsx` (criado na spec 2.01) e a página `manager/students/[id]` e `trainer/students/[id]`.

Na aba **360°** (ou em uma nova sub-seção "Comunicação"):

1. Botão **"Nova mensagem"** que abre o `NewReferralDialog` já com `studentId`/`coProfessionals` daquele aluno.
2. Lista das mensagens **daquele aluno** (filtrar `getMyReferrals` por `student_id`, ou criar `getStudentReferrals(studentId)` em `referrals.ts`).

Para nutricionista/fisioterapeuta, o botão "Nova mensagem" também deve aparecer na ficha do paciente (`nutritionist/patients/[id]`, `physiotherapist/patients/[id]`) — é onde eles naturalmente decidem encaminhar/solicitar.

### Nova action auxiliar

Adicionar em `web/src/app/actions/referrals.ts`:

```typescript
export async function getStudentReferrals(studentId: string): Promise<InterdisciplinaryReferral[]> {
    const myId = await getMyProfessionalId();
    const profile = await getProfile();
    if (!myId && profile?.role !== 'manager') return [];

    const admin = createAdminClient();
    let query = admin
        .from('interdisciplinary_referrals')
        .select(`
            *,
            from_professional:professionals!from_professional_id(id, profession_type, profile:profiles!profile_id(full_name)),
            to_professional:professionals!to_professional_id(id, profession_type, profile:profiles!profile_id(full_name)),
            replies:referral_replies(count)
        `)
        .eq('student_id', studentId)
        .order('created_at', { ascending: false });

    // Profissional só vê threads em que participa; manager vê tudo do aluno.
    if (profile?.role !== 'manager' && myId) {
        query = query.or(`from_professional_id.eq.${myId},to_professional_id.eq.${myId}`);
    }

    const { data } = await query;
    return (data || []).map(normalizeReferral);
}
```

> Como `normalizeReferral` é função interna do módulo, exporte-a ou mantenha `getStudentReferrals` no mesmo arquivo (`referrals.ts`).

---

## Estrutura de arquivos

```
web/src/
├── app/dashboard/messages/
│   ├── page.tsx                          # inbox (server)
│   └── messages-inbox.tsx                # master-detail (client)
├── components/
│   ├── sidebar.tsx                       # + link "Mensagens" em todos os perfis
│   └── referrals/
│       ├── new-referral-dialog.tsx       # criar encaminhamento/solicitação
│       └── referral-thread.tsx           # thread + respostas + status
└── app/actions/referrals.ts              # + getStudentReferrals()
```

Nenhuma migration nesta spec.

---

## Checklist

### Navegação e inbox
- [ ] Adicionar link "Mensagens" no sidebar para os 4 perfis
- [ ] Criar `/dashboard/messages/page.tsx` + `messages-inbox.tsx`
- [ ] Tabs Recebidos/Enviados funcionando, com badges de status/tipo/prioridade

### Criação e thread
- [ ] `new-referral-dialog.tsx` cria encaminhamento e solicitação
- [ ] Estado vazio quando o aluno não tem co-profissionais
- [ ] `referral-thread.tsx` mostra corpo, respostas, contexto de origem
- [ ] Ações de status visíveis só para o destinatário; "Cancelar" só para remetente em pending
- [ ] Responder em thread funciona e atualiza a lista

### Integração ficha do aluno
- [ ] Botão "Nova mensagem" na aba 360° (manager + trainer)
- [ ] Botão "Nova mensagem" na ficha do paciente (nutri + fisio)
- [ ] `getStudentReferrals` lista mensagens do aluno respeitando participação/role

### Verificação
- [ ] Type check (`npx tsc --noEmit`)
- [ ] Fluxo ponta a ponta: treinador encaminha → fisio recebe no inbox → aceita → responde → conclui
- [ ] Solicitação do nutricionista ao treinador aparece corretamente nos dois lados
- [ ] Manager vê as threads em modo leitura (sem botões de ação)
- [ ] Responsividade mobile do inbox master-detail

---

## Resultado Esperado

Um profissional abre "Mensagens", vê os encaminhamentos e solicitações recebidos, abre uma thread, aceita/conclui e responde. A partir da ficha de um aluno, qualquer profissional vinculado consegue criar um encaminhamento ou solicitação para um colega que atende o mesmo aluno — substituindo o WhatsApp por um registro rastreável dentro do Playbook.
</content>
