# Ponto de retomada — Playbook

_Atualizado em 2026-05-28._

## Onde paramos

Sessão focada em **comunicação interdisciplinar (Fase 3)**, **hardening de segurança** e **agenda/fluxos de fisioterapia**. Tudo abaixo está **commitado no `main` e aplicado em produção** (Supabase), mas **ainda não testado no navegador**.

### Entregue e no ar
- **Segurança (migrations 026–027):** view `trainer_activity_summary` → `security_invoker`; `search_path` fixo nas funções; RLS migrado de `public` → `authenticated`; leitura anônima de `game_rules`/catálogos fechada.
- **Fase 3 — comunicação interdisciplinar (migrations 028–032):** encaminhamentos/solicitações (`/dashboard/messages`), liberações clínicas, notas compartilhadas, central de notificações (sino no header), tudo integrado nas fichas.
- **Agenda de fisioterapia (migrations 033–034):** tabelas paralelas `physio_schedule_*` (owner = fisioterapeuta), workspace genérico com toggle **Treino | Fisioterapia** (gestor), página de agenda no dashboard do fisio, e **tipo de atendimento** por participante (avaliação/recovery/sessão).
- **Cadastro compartilhado de alunos (migration 035):** `students.trainer_id` opcional; nutri/fisio adicionam pacientes com **busca-primeiro** (sem duplicar); treinador **assume** aluno já cadastrado sem recadastrar; badge + filtro "Sem treinador" na lista do gestor.
- **Fisioterapia — paciente (migrations 036–037):** status **em atendimento / alta** (com data); **contagens** de avaliações/recovery/sessões derivadas das presenças na agenda; **evolução** em texto com **ditado por voz** (Web Speech API), também na **timeline 360°**.

Migrations aplicadas até a **037**. `tsc --noEmit` e `next build` passando.

## Pendências imediatas (frente 1 — validar antes de seguir)
1. **QA no navegador** após deploy Vercel — nada do que foi feito hoje foi exercitado no app. Atenção especial ao ditado por voz (precisa de HTTPS + permissão de microfone; melhor no Chrome/Edge).
2. **Onboarding de dados reais** — só existem treinadores cadastrados. Criar fisioterapeutas/nutricionistas e vincular pacientes; sem isso as telas aparecem vazias.
3. **Ativar Leaked Password Protection** no painel Supabase (Authentication → Policies) — único item de segurança manual pendente.

## Próximas etapas (decidir ao retomar)
- **Paridade do nutricionista:** dar ao nutri o equivalente do fisio (status, contagens, evolução) — ainda não decidido se é necessário.
- **Polimentos:** contagens na lista de pacientes do fisio; badge do tipo no card fechado da agenda; evolução do nutri na timeline.
- **Fase 4 — Painel do aluno** (só no PRD): visão consolidada para o aluno; exige decisões de acesso/login do aluno.

## Como retomar o ambiente
```bash
cd /Users/gustavoprado/playbook/web
npm install            # se node_modules não existir
./node_modules/.bin/tsc --noEmit
./node_modules/.bin/next build
```
MCP do Supabase já configurado em `.mcp.json` (project ref `grpoxzjtuaynxtxpixtr`).

> Nota: `.mcp.json` e `docs/context-prompt.md` seguem **fora do controle de versão** por opção.
</content>
