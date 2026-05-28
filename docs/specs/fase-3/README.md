# Specs — Fase 3: Comunicação Interdisciplinar

Este diretório contém as especificações técnicas detalhadas para a Fase 3 do ecossistema integrado de saúde do Playbook.

## Pré-requisito

A **Fase 2 (Visibilidade Cruzada)** já está implementada: visão 360° do aluno (`integrated.ts`), alertas proativos nos dashboards (`alerts.ts`), relatórios consolidados (`reports.ts`) e KPIs interdisciplinares (`kpis.ts`). A Fase 3 assume que os profissionais já visualizam dados uns dos outros — agora eles passam a **comunicar e agir** sobre um mesmo aluno.

> **Antes de codar:** o PRD (seção 4) recomenda validar a Fase 2 em uso real e coletar feedback dos profissionais sobre quais informações vale a pena trocar. Estas specs assumem que essa validação aconteceu e refletem o escopo mínimo decidido.

## Objetivo da Fase 3

Formalizar no sistema a comunicação que hoje acontece de forma informal (WhatsApp, conversa no corredor): encaminhamentos, solicitações, liberações clínicas, notas compartilhadas e notificações entre treinadores, nutricionistas e fisioterapeutas que atendem o mesmo aluno.

## Documentos

| # | Arquivo | Escopo | Migration |
|---|---------|--------|-----------|
| 1 | `01-infraestrutura-comunicacao.md` | Tabela `interdisciplinary_referrals` + respostas, RLS, helpers, tipos, server actions base | 028 |
| 2 | `02-encaminhamentos-solicitacoes.md` | Fluxo de encaminhamentos e solicitações: compose, inbox, thread, mudança de status | — |
| 3 | `03-liberacoes-clinicas.md` | Liberações/restrições da fisio que impactam o treino; surface no módulo de treino | 029 |
| 4 | `04-notas-compartilhadas.md` | Notas visíveis a todos os profissionais do aluno; integração na timeline 360° | 030 |
| 5 | `05-central-notificacoes.md` | Tabela `notifications` + triggers, sino com contador no header, painel de notificações | 031 |

## Princípios de design (continuidade com as fases anteriores)

1. **Migrations aditivas.** Nunca alteram ou removem estruturas existentes. As novas tabelas referenciam `students`, `professionals` e `student_professionals` da Fase 1.
2. **RLS por vínculo compartilhado.** Diferente da Fase 1 (cada profissional só vê o seu), aqui um profissional pode ler/escrever uma mensagem **se ele e o destinatário atendem o mesmo aluno** (via `student_professionals`). O manager vê tudo.
3. **Eventos com ciclo de vida são armazenados.** A Fase 2.02 deliberadamente *não* criou tabela de alertas (eram calculados). A Fase 3 é diferente: encaminhamentos, liberações e notificações têm estado (pendente/aceito/concluído, lido/não lido) e **precisam** ser persistidos.
4. **Reusar componentes existentes.** Badges de profissão (`ProfessionBadge`), timeline integrada (`IntegratedTimeline`), padrões de dialog (`link-professional-dialog.tsx`) e o componente de alertas são reaproveitados.

## Convenções herdadas (verificadas no código)

- **Roles**: `profiles.role` ∈ `manager | trainer | professional`; `profiles.profession_type` ∈ `trainer | nutritionist | physiotherapist | null`.
- **Helpers SQL já existentes** (migrations 003 e 020): `public.is_manager()`, `public.get_professional_id()`, `public.get_professional_id_by_type(p_type)`, `public.is_profession(p_type)`.
- **Padrão RLS de "dono"**: `professional_id IN (SELECT id FROM professionals WHERE profile_id = auth.uid())`.
- **Server actions**: em `web/src/app/actions/*.ts`, marcadas `'use server'`. Usam `createClient()` (respeita RLS) ou `createAdminClient()` (bypassa RLS para leituras cross-role). Helpers de auth: `getProfile()`, `getTrainerId()`.
- **Tipos**: declarados em `web/src/types/database.ts` (interfaces `Row` + enums no topo).
- **Navegação**: `web/src/components/sidebar.tsx` decide os links por `role`/`professionType`.

## Como usar com Claude Code

Cada spec foi escrita para ser delegada diretamente ao Claude Code, em ordem:

```bash
cd /Users/gustavoprado/playbook
claude "Leia docs/specs/fase-3/01-infraestrutura-comunicacao.md e implemente todas as tarefas. Siga exatamente os padrões de migration, RLS, tipos e server actions já usados nas fases 1 e 2."
```

## Ordem de execução

As specs devem ser executadas **em ordem** (01 → 02 → 03 → 04 → 05). A 02 depende da infraestrutura da 01; a 05 (notificações) é a última pois consome eventos gerados pelas anteriores.

```
01 (infra: referrals)
 └─ 02 (encaminhamentos/solicitações UI)
03 (liberações clínicas)      ──┐
04 (notas compartilhadas)     ──┼─→ 05 (notificações: consolida eventos de 02/03/04)
```

## Fora do escopo da Fase 3

- **Painel do aluno** (Fase 4): nenhuma dessas funcionalidades é exposta ao aluno final.
- **Comissão para nutri/fisio**: continua exclusiva dos treinadores. Comunicação não gera KPI.
- **Chat livre em tempo real**: a comunicação é estruturada (encaminhamento, solicitação, nota), não um messenger genérico. Sem websockets — atualização via `revalidatePath`/polling leve.
- **Anexos em mensagens**: encaminhamentos referenciam dados existentes (consulta, sessão, exame) por link, não carregam novos arquivos. Anexos clínicos continuam nos módulos de origem.
</content>
</invoke>
