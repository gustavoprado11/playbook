# Spec 04 — Painel Manager + Integração

**Sprint:** 4
**Estimativa:** 1-2 semanas
**Pré-requisito:** Specs 01, 02 e 03 implementadas
**Migrations:** Nenhuma (usa tabelas já criadas)

---

## Contexto

Com os módulos de nutrição e fisioterapia funcionando, o manager precisa de ferramentas para gerenciar os novos profissionais e seus vínculos com alunos. Além disso, a ficha do aluno no painel do manager e do treinador deve indicar quais profissionais o acompanham.

**Escopo desta spec:**
- Novo menu "Profissionais" no dashboard do manager
- Telas de CRUD de nutricionistas e fisioterapeutas
- Gestão de vínculos aluno ↔ profissional
- Indicadores de acompanhamento multidisciplinar no perfil do aluno

**Fora do escopo (será feito nas Fases 2-3):**
- Visibilidade cruzada de prontuários entre profissionais
- Comunicação/encaminhamento entre profissionais
- KPIs e comissão para nutricionistas/fisioterapeutas

---

## Tarefa 1: Página de listagem de profissionais

**Arquivo:** `web/src/app/dashboard/manager/professionals/page.tsx` (novo)

### Layout da página

- Header: "Profissionais" com botão "Novo profissional"
- Tabs ou filtro: "Todos" | "Nutricionistas" | "Fisioterapeutas"
  - Não incluir "Treinadores" aqui — eles continuam na tela existente `/dashboard/manager/trainers`
- Tabela com colunas:
  - Nome completo
  - Email
  - Tipo (badge: "Nutricionista" em verde, "Fisioterapeuta" em azul)
  - Data de início
  - Status (ativo/inativo com toggle)
  - Pacientes vinculados (número)
  - Ações (editar, resetar senha)

### Dados

Chamar `listProfessionals()` da action criada na Spec 01 (`web/src/app/actions/professionals.ts`), filtrando por `profession_type IN ('nutritionist', 'physiotherapist')`.

Para contar pacientes vinculados, usar subquery ou join com `student_professionals`:

```typescript
const { data } = await supabase
    .from('professionals')
    .select(`
        *,
        profile:profiles!profile_id(*),
        student_count:student_professionals(count)
    `)
    .in('profession_type', ['nutritionist', 'physiotherapist'])
    .order('created_at', { ascending: false });
```

---

## Tarefa 2: Formulário de criação de profissional

**Arquivo:** `web/src/app/dashboard/manager/professionals/new/page.tsx` (novo)

### Campos do formulário

- Nome completo (obrigatório)
- Email (obrigatório, validar formato)
- Senha temporária (obrigatório, mínimo 6 caracteres)
- Tipo de profissional (select: Nutricionista / Fisioterapeuta) — obrigatório
- Data de início (date picker, default hoje)
- Notas (textarea, opcional)

### Comportamento

1. Validar campos no frontend
2. Chamar `createProfessional()` da action em `professionals.ts`
3. Em caso de sucesso: redirecionar para `/dashboard/manager/professionals` com toast "Profissional criado com sucesso"
4. Em caso de erro (email duplicado, etc): mostrar mensagem de erro

### Padrão a seguir

Copiar o padrão de `/dashboard/manager/trainers/new/page.tsx` — o formulário de criação de treinador. A lógica é quase idêntica, mas com o campo adicional de `profession_type`.

---

## Tarefa 3: Gestão de vínculos aluno ↔ profissional

**Arquivo:** `web/src/app/dashboard/manager/students/[id]/page.tsx` (alterar existente)

### O que adicionar ao perfil do aluno no painel manager

Adicionar uma nova seção **"Equipe de Acompanhamento"** abaixo das informações existentes do aluno. Esta seção mostra:

**Profissionais vinculados:**
- Lista de profissionais que acompanham este aluno
- Cada item mostra: nome, tipo (badge), data de início do vínculo
- Botão "Remover vínculo" em cada item (chama `unlinkStudentFromProfessional()`)

**Vincular novo profissional:**
- Botão "Vincular profissional"
- Abre dialog/modal com:
  - Select de tipo (Nutricionista / Fisioterapeuta)
  - Select de profissional (lista filtrada por tipo selecionado, apenas ativos)
  - Botão confirmar (chama `linkStudentToProfessional()`)

### Dados necessários

Ao carregar o perfil do aluno, fazer query adicional:

```typescript
const { data: linkedProfessionals } = await supabase
    .from('student_professionals')
    .select(`
        *,
        professional:professionals!professional_id(
            *,
            profile:profiles!profile_id(full_name, email)
        )
    `)
    .eq('student_id', studentId)
    .eq('status', 'active');
```

---

## Tarefa 4: Indicador de acompanhamento multidisciplinar

### No painel do Manager — Lista de alunos

**Arquivo:** `web/src/app/dashboard/manager/students/page.tsx` (alterar existente)

Adicionar à tabela de alunos uma coluna **"Acompanhamento"** que mostra badges com os profissionais vinculados:

- Ícone de haltere / "T" para treinador (já implícito pelo `trainer_id`)
- Ícone de maçã / "N" em verde para nutricionista
- Ícone de osso / "F" em azul para fisioterapeuta
- Se não tem nenhum vínculo extra: mostrar apenas o treinador

Para não impactar performance, trazer essa informação de forma leve:

```typescript
const { data: studentsWithTeam } = await supabase
    .from('students')
    .select(`
        *,
        trainer:trainers!trainer_id(
            profile:profiles!profile_id(full_name)
        ),
        professionals:student_professionals(
            professional:professionals!professional_id(
                profession_type,
                profile:profiles!profile_id(full_name)
            )
        )
    `)
    .eq('is_archived', false)
    .order('full_name');
```

### No painel do Trainer — Lista de alunos

**Arquivo:** `web/src/app/dashboard/trainer/students/page.tsx` (alterar existente)

Mesma lógica: mostrar badges indicando se o aluno é acompanhado por nutricionista e/ou fisioterapeuta. O treinador NÃO vê os dados clínicos (isso é Fase 2), mas sabe que o aluno tem acompanhamento multidisciplinar.

---

## Tarefa 5: Navegação do Manager

**Arquivo:** Layout do manager (verificar se é `web/src/app/dashboard/manager/layout.tsx` ou componente de sidebar)

### Adicionar link na sidebar

Adicionar "Profissionais" na sidebar do manager, entre "Treinadores" e "Alunos" (ou após "Alunos"):

```
Painel
Treinadores
Profissionais    ← NOVO
Alunos
Regras
Resultados
Agenda
```

- Ícone sugerido: `Stethoscope` ou `UserCog` do lucide-react
- Link: `/dashboard/manager/professionals`

---

## Tarefa 6: Componentes de UI

**Diretório:** `web/src/components/` (componentes genéricos ou em subpasta adequada)

1. **`profession-badge.tsx`** — Badge colorido por tipo de profissional
   ```typescript
   // Props: { type: ProfessionType }
   // 'trainer' → badge cinza "Treinador"
   // 'nutritionist' → badge verde "Nutricionista"
   // 'physiotherapist' → badge azul "Fisioterapeuta"
   ```

2. **`team-badges.tsx`** — Linha de badges mostrando a equipe de um aluno
   ```typescript
   // Props: { professionals: { profession_type: ProfessionType, name: string }[] }
   // Renderiza badges compactos lado a lado
   ```

3. **`link-professional-dialog.tsx`** — Dialog para vincular profissional a aluno
   ```typescript
   // Props: { studentId: string, onLink: () => void }
   // Select de tipo → Select de profissional → Botão confirmar
   ```

---

## Tarefa 7: Testes e validação de integração end-to-end

### Cenários de teste manual

Execute estes cenários na ordem para validar o fluxo completo:

**Cenário 1: Criar profissionais**
1. Login como manager
2. Ir para `/dashboard/manager/professionals`
3. Criar um nutricionista (nome, email, senha)
4. Criar um fisioterapeuta (nome, email, senha)
5. Verificar que ambos aparecem na lista com status ativo

**Cenário 2: Vincular alunos**
1. Ainda como manager, ir para perfil de um aluno
2. Na seção "Equipe de Acompanhamento", vincular o nutricionista criado
3. Vincular o fisioterapeuta criado
4. Verificar badges na lista de alunos
5. Remover vínculo do nutricionista
6. Verificar que o badge some

**Cenário 3: Login como nutricionista**
1. Logout do manager
2. Login com email/senha do nutricionista criado
3. Verificar redirect para `/dashboard/nutritionist`
4. Verificar que o paciente vinculado aparece na lista
5. Criar uma consulta para o paciente
6. Verificar que a consulta aparece no prontuário

**Cenário 4: Login como fisioterapeuta**
1. Logout do nutricionista
2. Login com email/senha do fisioterapeuta criado
3. Verificar redirect para `/dashboard/physiotherapist`
4. Verificar paciente vinculado
5. Criar uma sessão de avaliação inicial
6. Criar um protocolo de tratamento

**Cenário 5: Isolamento (RLS)**
1. Login como nutricionista
2. Verificar que NÃO consegue ver dados de fisioterapia
3. Login como fisioterapeuta
4. Verificar que NÃO consegue ver dados de nutrição
5. Login como treinador existente
6. Verificar que tudo funciona normalmente (sem regressão)
7. Verificar que o treinador NÃO vê prontuários de nutri/fisio
8. Login como manager
9. Verificar que vê todos os dados em modo leitura

**Cenário 6: Regressão de treinadores**
1. Login como treinador
2. Verificar dashboard de KPIs (retenção, indicações, gestão)
3. Verificar lista de alunos
4. Criar avaliação física
5. Verificar agenda
6. Tudo deve funcionar exatamente como antes

---

## Checklist final da Fase 1

- [ ] `npm run build` passa sem erros
- [ ] Manager consegue criar nutricionistas e fisioterapeutas
- [ ] Manager consegue vincular/desvincular alunos a profissionais
- [ ] Badges de equipe aparecem na lista de alunos (manager e trainer)
- [ ] Nutricionista: login → dashboard → pacientes → consulta → plano alimentar → exames
- [ ] Fisioterapeuta: login → dashboard → pacientes → sessão → protocolo → evolução
- [ ] RLS funciona: cada profissional vê apenas seus dados
- [ ] RLS funciona: profissionais de uma disciplina NÃO veem dados de outra
- [ ] Zero regressão: treinadores e manager funcionam exatamente como antes
- [ ] Todas as mensagens da UI estão em português
- [ ] Formulários têm validação adequada com mensagens de erro claras
- [ ] Navegação é intuitiva e consistente entre os módulos
