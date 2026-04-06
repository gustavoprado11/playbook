# PRD — Playbook: Ecossistema Integrado de Saúde

**Versão:** 1.0
**Data:** 02 de Abril de 2026
**Autor:** Gustavo Costa + Claude
**Status:** Rascunho para validação

---

## 1. Contexto e Visão

### O que o Playbook é hoje

O Playbook é uma plataforma de gestão de performance e comissão variável para treinadores de academia. Ele automatiza o cálculo de KPIs (retenção, indicações, gestão de resultados), gerencia portfólios de alunos, agenda de aulas e avaliações físicas. O sistema possui dois perfis: **manager** (gestor) e **trainer** (treinador).

### Para onde queremos ir

Evoluir o Playbook para um **ecossistema integrado de saúde**, onde treinadores, nutricionistas e fisioterapeutas consigam gerir seus alunos/pacientes em uma plataforma unificada. A visão de longo prazo é a comunicação interdisciplinar completa — mas chegaremos lá de forma incremental.

### Premissas e restrições

- **Não quebrar o que funciona.** Toda a funcionalidade existente de treinadores deve continuar operando normalmente.
- **Validação em uma única academia.** Não precisamos de multi-tenancy, gerenciamento de login avançado, pagamentos ou onboarding público.
- **Comissão permanece exclusiva dos treinadores.** O sistema de KPIs e recompensas não se aplica aos novos profissionais nesta fase.
- **Sem acesso do aluno por enquanto.** O foco é nos profissionais; o painel do aluno é uma evolução futura.
- **Escala inicial:** 3-5 nutricionistas e 3-5 fisioterapeutas, além dos treinadores existentes.

---

## 2. Estratégia de Fases

### Fase 1 — Fundação Multidisciplinar
**Objetivo:** Permitir que nutricionistas e fisioterapeutas tenham acesso ao sistema com seus próprios módulos de registro, sem afetar o fluxo dos treinadores.

### Fase 2 — Visibilidade Cruzada
**Objetivo:** Permitir que cada profissional visualize os dados registrados por outras disciplinas sobre um mesmo aluno/paciente.

### Fase 3 — Comunicação Interdisciplinar
**Objetivo:** Criar fluxos de encaminhamento, solicitações entre profissionais e protocolos compartilhados.

### Fase 4 — Painel do Aluno (futuro)
**Objetivo:** Dar ao aluno uma visão consolidada do seu acompanhamento em todas as disciplinas.

---

## 3. Fase 1 — Fundação Multidisciplinar (Detalhamento)

Esta é a fase que vamos planejar em detalhe. As demais serão refinadas conforme validarmos a Fase 1 na academia.

### 3.1 Novos perfis de usuário

Hoje o sistema tem dois roles: `manager` e `trainer`. Precisamos expandir para suportar novos tipos de profissional sem quebrar o modelo existente.

**Abordagem recomendada:** adicionar um campo `profession_type` ao modelo, mantendo o `role` existente para controle de permissões.

```
Roles (controle de acesso):
  - manager     → acesso administrativo
  - professional → acesso ao módulo da sua profissão

Profession Types (tipo de profissional):
  - trainer        → Treinador (já existente, migrado de role='trainer')
  - nutritionist   → Nutricionista
  - physiotherapist → Fisioterapeuta
```

**Por que separar role de profession_type?** Porque o `role` define permissões (o que o usuário pode fazer no sistema), enquanto `profession_type` define o contexto (quais módulos e dados ele acessa). Isso nos dá flexibilidade — por exemplo, no futuro um nutricionista poderia ser promovido a manager sem perder sua identidade profissional.

### 3.2 Modelo de dados — Novos prontuários

Cada profissão terá seu módulo de prontuário. A estrutura é propositalmente similar entre eles para facilitar a Fase 2 (visibilidade cruzada), mas os campos específicos refletem as necessidades de cada área.

#### 3.2.1 Tabelas compartilhadas (novo)

```sql
-- Tabela de profissionais (generaliza a tabela 'trainers' existente)
CREATE TABLE professionals (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  profile_id UUID REFERENCES profiles(id) NOT NULL,
  profession_type TEXT NOT NULL CHECK (profession_type IN ('trainer', 'nutritionist', 'physiotherapist')),
  start_date DATE NOT NULL DEFAULT CURRENT_DATE,
  is_active BOOLEAN NOT NULL DEFAULT true,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(profile_id, profession_type)
);

-- Vínculo aluno ↔ profissional (generaliza o trainer_id em students)
CREATE TABLE student_professionals (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  student_id UUID REFERENCES students(id) NOT NULL,
  professional_id UUID REFERENCES professionals(id) NOT NULL,
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'inactive')),
  started_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  ended_at TIMESTAMPTZ,
  notes TEXT,
  UNIQUE(student_id, professional_id)
);
```

> **Nota sobre migração:** A tabela `trainers` existente e o campo `students.trainer_id` continuam funcionando normalmente. A tabela `professionals` é uma camada adicional. Na migração, criamos registros em `professionals` para cada treinador existente, e `student_professionals` para refletir os vínculos atuais. O código existente não precisa mudar — os novos módulos usam a nova estrutura.

#### 3.2.2 Módulo Nutrição

```sql
-- Consultas nutricionais
CREATE TABLE nutrition_consultations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  student_id UUID REFERENCES students(id) NOT NULL,
  professional_id UUID REFERENCES professionals(id) NOT NULL,
  consultation_date TIMESTAMPTZ NOT NULL DEFAULT now(),
  consultation_type TEXT NOT NULL CHECK (consultation_type IN (
    'initial_assessment', 'follow_up', 'reassessment'
  )),
  chief_complaint TEXT,          -- queixa principal
  clinical_notes TEXT,           -- notas clínicas
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Anamnese nutricional
CREATE TABLE nutrition_anamnesis (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  consultation_id UUID REFERENCES nutrition_consultations(id) NOT NULL,
  dietary_history TEXT,           -- histórico alimentar
  food_allergies TEXT[],          -- alergias alimentares (array)
  food_intolerances TEXT[],       -- intolerâncias
  supplements TEXT[],             -- suplementos em uso
  pathologies TEXT[],             -- patologias relevantes
  medications TEXT[],             -- medicações em uso
  objective TEXT,                 -- objetivo do paciente (emagrecimento, hipertrofia, etc.)
  daily_routine TEXT,             -- rotina diária (horários, trabalho, treino)
  water_intake_ml INTEGER,        -- ingestão hídrica diária
  bowel_habits TEXT,              -- hábitos intestinais
  sleep_quality TEXT,             -- qualidade do sono
  additional_notes TEXT
);

-- Métricas nutricionais (antropometria e composição)
CREATE TABLE nutrition_metrics (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  consultation_id UUID REFERENCES nutrition_consultations(id) NOT NULL,
  weight_kg DECIMAL(5,2),
  height_cm DECIMAL(5,1),
  bmi DECIMAL(4,1),
  body_fat_pct DECIMAL(4,1),
  lean_mass_kg DECIMAL(5,2),
  waist_cm DECIMAL(5,1),
  hip_cm DECIMAL(5,1),
  arm_cm DECIMAL(5,1),
  thigh_cm DECIMAL(5,1),
  chest_cm DECIMAL(5,1),
  calf_cm DECIMAL(5,1),
  visceral_fat_level INTEGER,
  basal_metabolic_rate INTEGER,   -- TMB
  additional_measures JSONB       -- medidas extras flexíveis
);

-- Planos alimentares
CREATE TABLE nutrition_meal_plans (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  student_id UUID REFERENCES students(id) NOT NULL,
  professional_id UUID REFERENCES professionals(id) NOT NULL,
  title TEXT NOT NULL,
  objective TEXT,
  total_calories INTEGER,
  protein_g INTEGER,
  carbs_g INTEGER,
  fat_g INTEGER,
  start_date DATE NOT NULL,
  end_date DATE,
  is_active BOOLEAN NOT NULL DEFAULT true,
  notes TEXT,
  meals JSONB NOT NULL,           -- estrutura flexível das refeições
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Exames laboratoriais
CREATE TABLE nutrition_lab_results (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  student_id UUID REFERENCES students(id) NOT NULL,
  professional_id UUID REFERENCES professionals(id) NOT NULL,
  exam_date DATE NOT NULL,
  exam_type TEXT NOT NULL,         -- hemograma, lipidograma, glicemia, etc.
  results JSONB NOT NULL,          -- resultados flexíveis
  file_path TEXT,                  -- upload do exame
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
```

#### 3.2.3 Módulo Fisioterapia

```sql
-- Sessões de fisioterapia
CREATE TABLE physio_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  student_id UUID REFERENCES students(id) NOT NULL,
  professional_id UUID REFERENCES professionals(id) NOT NULL,
  session_date TIMESTAMPTZ NOT NULL DEFAULT now(),
  session_type TEXT NOT NULL CHECK (session_type IN (
    'initial_assessment', 'treatment', 'reassessment', 'discharge'
  )),
  clinical_notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Anamnese fisioterapêutica
CREATE TABLE physio_anamnesis (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id UUID REFERENCES physio_sessions(id) NOT NULL,
  chief_complaint TEXT,            -- queixa principal
  pain_location TEXT[],            -- localização da dor (array)
  pain_intensity INTEGER CHECK (pain_intensity BETWEEN 0 AND 10), -- EVA
  pain_type TEXT,                  -- tipo de dor (aguda, crônica, etc.)
  onset_date DATE,                 -- início dos sintomas
  aggravating_factors TEXT[],      -- fatores que pioram
  relieving_factors TEXT[],        -- fatores que melhoram
  medical_history TEXT,            -- histórico médico
  surgical_history TEXT,           -- histórico cirúrgico
  medications TEXT[],
  imaging_results TEXT,            -- resultados de exames de imagem
  functional_limitations TEXT,     -- limitações funcionais
  previous_treatments TEXT,        -- tratamentos anteriores
  additional_notes TEXT
);

-- Métricas fisioterapêuticas
CREATE TABLE physio_metrics (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id UUID REFERENCES physio_sessions(id) NOT NULL,
  metric_type TEXT NOT NULL CHECK (metric_type IN (
    'rom', 'strength', 'pain', 'functional_test', 'posture', 'gait', 'balance'
  )),
  body_region TEXT NOT NULL,       -- região do corpo avaliada
  movement TEXT,                   -- movimento avaliado (flexão, extensão, etc.)
  value DECIMAL(6,2),             -- valor medido
  unit TEXT,                       -- graus, kg, segundos, etc.
  side TEXT CHECK (side IN ('left', 'right', 'bilateral', 'midline')),
  is_within_normal BOOLEAN,
  reference_value TEXT,            -- valor de referência
  notes TEXT
);

-- Protocolos de tratamento
CREATE TABLE physio_treatment_plans (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  student_id UUID REFERENCES students(id) NOT NULL,
  professional_id UUID REFERENCES professionals(id) NOT NULL,
  diagnosis TEXT NOT NULL,         -- diagnóstico fisioterapêutico
  objectives TEXT[] NOT NULL,      -- objetivos do tratamento
  contraindications TEXT[],        -- contraindicações
  estimated_sessions INTEGER,      -- sessões estimadas
  frequency TEXT,                  -- frequência (2x/semana, etc.)
  start_date DATE NOT NULL,
  end_date DATE,
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN (
    'active', 'completed', 'paused', 'cancelled'
  )),
  exercises JSONB,                 -- exercícios prescritos
  modalities JSONB,                -- modalidades terapêuticas (crioterapia, etc.)
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Evolução por sessão
CREATE TABLE physio_session_evolution (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id UUID REFERENCES physio_sessions(id) NOT NULL,
  treatment_plan_id UUID REFERENCES physio_treatment_plans(id),
  procedures_performed TEXT[],     -- procedimentos realizados
  patient_response TEXT,           -- resposta do paciente
  pain_before INTEGER CHECK (pain_before BETWEEN 0 AND 10),
  pain_after INTEGER CHECK (pain_after BETWEEN 0 AND 10),
  exercises_performed JSONB,       -- exercícios executados na sessão
  home_exercises JSONB,            -- exercícios para casa
  next_session_plan TEXT,          -- plano para próxima sessão
  notes TEXT
);

-- Anexos de exames (imagem, laudos)
CREATE TABLE physio_attachments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id UUID REFERENCES physio_sessions(id),
  treatment_plan_id UUID REFERENCES physio_treatment_plans(id),
  file_path TEXT NOT NULL,
  file_type TEXT NOT NULL,
  file_size INTEGER,
  description TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
```

### 3.3 Estrutura de navegação (Frontend)

A ideia é que cada profissional, ao fazer login, veja **apenas o módulo relevante à sua profissão**, com uma experiência similar à que os treinadores já têm hoje.

```
/dashboard
  /trainer/*        → (já existe, sem alteração)
  /nutritionist/
    /patients       → lista de pacientes vinculados
    /patients/[id]  → prontuário do paciente (consultas, métricas, planos)
    /consultations  → agenda de consultas
    /meal-plans     → planos alimentares ativos
  /physiotherapist/
    /patients       → lista de pacientes vinculados
    /patients/[id]  → prontuário do paciente (sessões, métricas, planos)
    /sessions       → agenda de sessões
    /treatment-plans → protocolos ativos
  /manager/*        → (já existe + novo painel de profissionais)
```

### 3.4 O que muda no Manager (mínimo)

Inicialmente, o manager **não gerencia** nutricionistas e fisioterapeutas com KPIs. Porém, o manager precisa de funcionalidades básicas:

- **Cadastrar profissionais** de nutrição e fisioterapia (criar perfil + login)
- **Visualizar a lista** de profissionais ativos por área
- **Vincular/desvincular** alunos a profissionais
- **Visualizar** (somente leitura) que um aluno está sendo acompanhado por nutri/fisio

### 3.5 Migração e compatibilidade

A migração deve ser **aditiva** — só adiciona, nunca altera ou remove estruturas existentes.

| Ação | Detalhe |
|------|---------|
| Novo campo em `profiles` | `profession_type` (nullable, default null para manter compatibilidade) |
| Nova tabela `professionals` | Camada de abstração; registros criados para treinadores existentes |
| Nova tabela `student_professionals` | Espelha vínculos existentes de `students.trainer_id` |
| Tabelas de nutrição | Todas novas, sem FK para tabelas de treino |
| Tabelas de fisioterapia | Todas novas, sem FK para tabelas de treino |
| Código existente | **Zero alterações.** Treinadores continuam usando `trainers` + `students.trainer_id` |

### 3.6 RLS (Row Level Security)

Cada profissional só pode ver e editar dados dos seus próprios pacientes:

- Nutricionista vê apenas `nutrition_*` onde `professional_id` corresponde ao seu registro
- Fisioterapeuta vê apenas `physio_*` onde `professional_id` corresponde ao seu registro
- Manager vê tudo (leitura)
- Treinador não vê dados de nutrição/fisioterapia (isso muda na Fase 2)

---

## 4. Fase 2 — Visibilidade Cruzada (Visão Geral)

> Detalhamento completo será feito após validação da Fase 1.

### Conceito

Cada profissional poderá ver (somente leitura) os dados de outras disciplinas sobre seus pacientes em comum. Exemplo: o treinador abre o perfil de um aluno e vê uma aba "Nutrição" com o resumo do acompanhamento nutricional.

### O que envolve

- **Ficha unificada do aluno:** Uma visão consolidada com abas por disciplina
- **Resumo cross-disciplinar:** Cada módulo expõe um "resumo" simplificado para os outros profissionais (não o prontuário completo)
- **Ajuste de RLS:** Permitir leitura cruzada quando há aluno em comum via `student_professionals`
- **Timeline compartilhada:** Uma linha do tempo unificada mostrando eventos de todas as disciplinas

### Pré-requisito

- Fase 1 validada e em uso pelos profissionais
- Feedback dos profissionais sobre quais informações são úteis para compartilhamento

---

## 5. Fase 3 — Comunicação Interdisciplinar (Visão Geral)

> Detalhamento completo será feito após validação da Fase 2.

### Conceito

Criar fluxos formais de comunicação entre profissionais sobre um mesmo aluno. Isso formaliza o que hoje acontece de forma informal (WhatsApp, conversa no corredor).

### Funcionalidades previstas

- **Encaminhamentos:** Treinador encaminha aluno para nutricionista/fisioterapeuta com contexto
- **Solicitações:** Fisioterapeuta solicita adaptação de treino ao treinador; nutricionista pede informações sobre gasto calórico
- **Notas compartilhadas:** Anotações que ficam visíveis para todos os profissionais do aluno
- **Alertas:** Notificações quando um profissional registra algo relevante para outra disciplina (ex: fisio registra restrição de movimento → treinador é notificado)
- **Liberações:** Fisioterapeuta libera/restringe aluno para determinados exercícios

### Modelo simplificado

```sql
-- Encaminhamentos / Solicitações
CREATE TABLE interdisciplinary_referrals (
  id UUID PRIMARY KEY,
  student_id UUID REFERENCES students(id),
  from_professional_id UUID REFERENCES professionals(id),
  to_professional_id UUID REFERENCES professionals(id),
  type TEXT CHECK (type IN ('referral', 'request', 'alert', 'clearance')),
  subject TEXT,
  body TEXT,
  status TEXT CHECK (status IN ('pending', 'accepted', 'completed', 'declined')),
  created_at TIMESTAMPTZ DEFAULT now(),
  resolved_at TIMESTAMPTZ
);
```

---

## 6. Fase 4 — Painel do Aluno (Visão Futura)

### Conceito

O aluno acessa um painel simplificado onde vê, de forma consolidada:

- Seus treinos e frequência
- Seu plano alimentar ativo
- Suas sessões de fisioterapia e exercícios para casa
- Sua evolução (gráficos de métricas ao longo do tempo)
- Próximas consultas/sessões agendadas

### Considerações

- Requer um novo role: `student`
- Dados exibidos são somente leitura
- Cada profissional controla o que é visível para o aluno
- Pode ser um app mobile separado ou uma versão responsiva do web

---

## 7. Roadmap Sugerido — Fase 1

### Sprint 1: Infraestrutura (1-2 semanas)

| # | Tarefa | Detalhe |
|---|--------|---------|
| 1 | Migration: tabela `professionals` | Criar tabela + migrar treinadores existentes |
| 2 | Migration: tabela `student_professionals` | Criar tabela + espelhar vínculos existentes |
| 3 | Atualizar `profiles` | Adicionar campo `profession_type` |
| 4 | RLS para novas tabelas | Políticas de acesso por profissional |
| 5 | Server Actions base | CRUD de profissionais (criar, listar, ativar/desativar) |
| 6 | Middleware de roteamento | Redirecionar profissional para o dashboard correto após login |

### Sprint 2: Módulo Nutrição — Prontuário (2-3 semanas)

| # | Tarefa | Detalhe |
|---|--------|---------|
| 1 | Migrations nutrição | Todas as tabelas `nutrition_*` |
| 2 | Dashboard nutricionista | Layout base, lista de pacientes |
| 3 | Ficha do paciente | Visualização de histórico de consultas |
| 4 | Registro de consulta | Formulário de consulta + anamnese + métricas |
| 5 | Planos alimentares | CRUD de planos com estrutura de refeições |
| 6 | Exames laboratoriais | Upload e registro de resultados |

### Sprint 3: Módulo Fisioterapia — Prontuário (2-3 semanas)

| # | Tarefa | Detalhe |
|---|--------|---------|
| 1 | Migrations fisioterapia | Todas as tabelas `physio_*` |
| 2 | Dashboard fisioterapeuta | Layout base, lista de pacientes |
| 3 | Ficha do paciente | Visualização de histórico de sessões |
| 4 | Registro de sessão | Formulário de sessão + anamnese + métricas |
| 5 | Protocolos de tratamento | CRUD de protocolos com exercícios |
| 6 | Evolução por sessão | Registro de evolução vinculada ao protocolo |

### Sprint 4: Integração Manager + Polish (1-2 semanas)

| # | Tarefa | Detalhe |
|---|--------|---------|
| 1 | Painel de profissionais no Manager | Listar, cadastrar, ativar/desativar nutris e fisios |
| 2 | Gestão de vínculos | Vincular/desvincular alunos a profissionais |
| 3 | Indicador no perfil do aluno | Badge mostrando quais profissionais acompanham o aluno |
| 4 | Testes e ajustes | Testar fluxos completos, corrigir bugs |
| 5 | Deploy e onboarding | Configurar profissionais reais na academia |

**Estimativa total da Fase 1: 6-10 semanas**

---

## 8. Riscos e Mitigações

| Risco | Impacto | Mitigação |
|-------|---------|-----------|
| Migração quebrar funcionalidades existentes | Alto | Migrations aditivas, zero alteração em tabelas existentes, testes em branch separada |
| Profissionais não aderirem ao sistema | Médio | MVP enxuto, onboarding presencial, coletar feedback semanal |
| Modelo de dados engessado | Médio | Uso extensivo de JSONB para campos flexíveis, permitindo evolução sem migrations |
| Escopo crescer demais na Fase 1 | Alto | Definição clara: Fase 1 = registro + visualização própria. Sem comunicação cruzada |
| Performance com mais dados | Baixo | Indexes adequados, paginação, escala é pequena (academia única) |

---

## 9. Decisões em Aberto

Estas são questões que devemos resolver antes ou durante o desenvolvimento:

1. **Nomenclatura no sistema:** O aluno do treinador é o mesmo "paciente" do nutricionista e do fisioterapeuta. Usamos "aluno" para todos, "paciente" para nutri/fisio, ou um termo neutro como "cliente"?

2. **Plano alimentar — nível de detalhe:** O nutricionista precisa de um editor de refeições detalhado (com tabela de alimentos, macros por alimento) ou um campo de texto livre / JSONB flexível é suficiente para o MVP?

3. **Agenda de consultas/sessões:** Reutilizamos o sistema de attendance existente ou criamos um agendamento separado mais simples para nutri/fisio?

4. **Upload de arquivos:** Os prontuários terão muitos anexos (exames, laudos, fotos). Usamos o mesmo Supabase Storage ou precisamos de uma solução mais robusta?

---

## 10. Métricas de Sucesso da Fase 1

- [ ] Todos os nutricionistas e fisioterapeutas da academia com login ativo
- [ ] Pelo menos 80% dos pacientes com prontuário inicial preenchido após 30 dias
- [ ] Zero regressão nas funcionalidades existentes dos treinadores
- [ ] Feedback qualitativo positivo dos profissionais sobre usabilidade
- [ ] Tempo médio de registro de consulta/sessão < 5 minutos

---

*Este documento será refinado iterativamente conforme avançamos nas sprints e coletamos feedback dos profissionais da academia.*
