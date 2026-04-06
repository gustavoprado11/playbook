# Spec 05 — Testes de Integração Fase 1

**Objetivo:** Validar que toda a implementação da Fase 1 funciona end-to-end contra o Supabase real.
**Pré-requisito:** Specs 01-04 implementadas, migrations aplicadas no Supabase.
**Executor:** Claude Code (com acesso de rede ao Supabase)

---

## Instruções para o Claude Code

1. Leia o arquivo `web/scripts/test-fase1.mjs`
2. Execute com `cd web && node scripts/test-fase1.mjs`
3. O script precisa de acesso de rede ao Supabase (usa as credenciais de `.env.local`)
4. Analise os resultados e reporte quaisquer falhas
5. Se houver falhas, investigue a causa e corrija

---

## O que o script testa (10 seções)

### 1. Validação de Schema
Verifica que todas as 14 tabelas novas existem com as colunas corretas:
- `professionals`, `student_professionals`
- `nutrition_consultations`, `nutrition_anamnesis`, `nutrition_metrics`, `nutrition_meal_plans`, `nutrition_lab_results`
- `physio_sessions`, `physio_anamnesis`, `physio_metrics`, `physio_treatment_plans`, `physio_session_evolution`, `physio_attachments`
- Campo `profiles.profession_type`

### 2. Validação de Enums
- `profession_type` enum existe e aceita 'trainer', 'nutritionist', 'physiotherapist'
- `user_role` enum aceita 'professional'

### 3. Migração de Dados
- Todos os trainers existentes foram migrados para `professionals`
- Vínculos `students.trainer_id` foram espelhados em `student_professionals`

### 4. CRUD de Profissionais
- Criar usuário auth + profile + professional (nutricionista e fisioterapeuta)
- Toggle de status (ativo/inativo)

### 5. Vínculos Aluno ↔ Profissional
- Vincular aluno a nutricionista e fisioterapeuta
- Verificar vínculo ativo
- Desvincular (status → inactive)
- Revincular

### 6. Módulo Nutrição — CRUD Completo
- Criar consulta nutricional (initial_assessment)
- Criar anamnese com arrays (alergias, intolerâncias, suplementos)
- Criar métricas antropométricas
- Criar plano alimentar com JSONB de refeições
- Criar resultado de exame laboratorial com JSONB
- Leitura com JOIN (consulta + anamnese + métricas)
- Update + validar trigger updated_at

### 7. Módulo Fisioterapia — CRUD Completo
- Criar sessão de avaliação inicial
- Criar anamnese fisioterapêutica (dor, localização, fatores)
- Criar múltiplas métricas (ROM, dor EVA, força)
- Criar protocolo de tratamento com exercícios e modalidades JSONB
- Criar sessão de tratamento com evolução (dor antes/depois)
- Finalizar protocolo (status → completed)
- Validar constraint EVA (0-10) rejeita valores inválidos

### 8. RLS — Isolamento entre Profissionais
- Login como nutricionista → acessa nutrition_*, NÃO acessa physio_*
- Login como fisioterapeuta → acessa physio_*, NÃO acessa nutrition_*
- Profissional só vê seu próprio registro em professionals
- Validar que RLS está habilitado em todas as 14 tabelas

### 9. Constraints e Edge Cases
- UNIQUE (profile_id, profession_type) em professionals
- UNIQUE (consultation_id) em nutrition_anamnesis
- CHECK constraint consultation_type rejeita valor inválido
- CHECK constraint metric_type rejeita valor inválido
- CASCADE DELETE: deletar consulta remove anamnese e métricas filhas

### 10. Limpeza
- Remove todos os dados de teste criados
- Remove usuários auth de teste

---

## Bugs já corrigidos antes dos testes

### Bug 1: `professionals.ts` — Auth check errado (CRÍTICO)
**Problema:** `checkTrainerAuth()` consultava tabela `trainers` com campo `auth_user_id` (inexistente). Resultado: TODAS as actions de profissionais retornavam "Não autorizado".
**Correção:** Renomeado para `checkManagerAuth()`, agora consulta `profiles.role === 'manager'`.

### Bug 2: `professionals.ts` — Insert com campos inexistentes (CRÍTICO)
**Problema:** `createProfessional()` tentava inserir `auth_user_id`, `name`, `email` na tabela `professionals` — campos que não existem no schema. O schema usa `profile_id`.
**Correção:** Agora faz upsert no `profiles` primeiro, depois insert em `professionals` com `profile_id`.

### Bug 3: `professionals.ts` — Reset password com campo errado
**Problema:** `resetProfessionalPassword()` buscava `auth_user_id` — campo inexistente.
**Correção:** Agora busca `profile_id`.

### Melhoria: `listProfessionals()` sem join no profiles
**Problema:** Listava profissionais sem trazer nome/email (dados estão em `profiles`, não em `professionals`).
**Correção:** Adicionado join `profile:profiles!profile_id(full_name, email)`.

---

## Resultado esperado

```
✅ Passed:  ~40-45
❌ Failed:  0
⏭️  Skipped: 0
🎉 TODOS OS TESTES PASSARAM!
```

Se houver falhas, o script lista cada uma com detalhes para debugging.
