-- ============================================
-- MÓDULO PRESCRIÇÃO DE TREINO — A0: fundação de dados
-- ============================================
-- Estrutura Exos de 2 níveis: Fase (ritual de ordem fixa) -> Categoria (recheio metodológico).
-- Só a biblioteca reutilizável de TEMPLATES neste marco (árvore atribuída por aluno = A3).
-- Aditivo, idempotente, single-tenant (sem organization_id). Não cria FK em tabelas clínicas.

-- ============================================
-- A. TAXONOMIA (referência seedada, extensível pelo estúdio)
-- ============================================

-- Padrões de movimento (vocabulário controlado, 1ª classe; extensível sem ALTER TYPE)
CREATE TABLE IF NOT EXISTS movement_patterns (
    pattern_key   TEXT PRIMARY KEY,           -- 'squat','hinge',...
    label         TEXT NOT NULL,
    display_order INTEGER NOT NULL DEFAULT 0,
    is_active     BOOLEAN NOT NULL DEFAULT TRUE,
    created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

INSERT INTO movement_patterns (pattern_key, label, display_order) VALUES
  ('squat','Agachamento',10),
  ('hinge','Dobradiça de quadril',20),
  ('lunge','Afundo / Passada',30),
  ('push_h','Empurrar horizontal',40),
  ('push_v','Empurrar vertical',50),
  ('pull_h','Puxar horizontal',60),
  ('pull_v','Puxar vertical',70),
  ('rotation','Rotação / Anti-rotação',80),
  ('carry','Carregamento',90),
  ('locomotion','Locomoção',100),
  ('jump','Salto / Aterrissagem',110),
  ('mobility','Mobilidade',120),
  ('integrated','Integrado',130)
ON CONFLICT (pattern_key) DO NOTHING;

-- Categorias de bloco, ESCOPADAS por fase (o 2º nível da estrutura Exos).
-- phase = ritual de ordem fixa (TEXT+CHECK); category_key = extensível.
CREATE TABLE IF NOT EXISTS block_categories (
    category_key  TEXT PRIMARY KEY,
    phase         TEXT NOT NULL CHECK (phase IN
                    ('preparacao_movimento','potencia_forca','dse','regeneracao')),
    label         TEXT NOT NULL,
    display_order INTEGER NOT NULL DEFAULT 0,
    is_active     BOOLEAN NOT NULL DEFAULT TRUE,
    created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
    -- alvo do FK composto de block_templates (garante categoria∈fase):
    CONSTRAINT block_categories_phase_key_unique UNIQUE (phase, category_key)
);

INSERT INTO block_categories (category_key, phase, label, display_order) VALUES
  -- Preparação de Movimento (aquecimento) — sub-blocos estruturais
  ('mobilidade','preparacao_movimento','Mobilidade',10),
  ('estabilidade','preparacao_movimento','Estabilidade',20),
  ('ativacao','preparacao_movimento','Ativação',30),
  ('integracao','preparacao_movimento','Integração de movimento',40),
  -- Potência / Força
  ('pliometria','potencia_forca','Pliometria',10),
  ('potencia','potencia_forca','Potência',20),
  ('forca','potencia_forca','Força',30),
  ('acessorio','potencia_forca','Acessório',40),
  -- DSE (periodizado por sistema)
  ('aerobio','dse','Aeróbio',10),
  ('anaerobio_capacidade','dse','Anaeróbio — capacidade',20),
  ('anaerobio_potencia','dse','Anaeróbio — potência',30),
  ('alatico','dse','Alático / Velocidade',40),
  -- Regeneração
  ('liberacao','regeneracao','Liberação miofascial',10),
  ('alongamento','regeneracao','Alongamento',20),
  ('respiracao','regeneracao','Respiração',30)
ON CONFLICT (category_key) DO NOTHING;

-- Métodos de treino (presets referenciados por item_templates.method_key)
CREATE TABLE IF NOT EXISTS training_methods (
    method_key    TEXT PRIMARY KEY,
    label         TEXT NOT NULL,
    description   TEXT,
    display_order INTEGER NOT NULL DEFAULT 0,
    is_active     BOOLEAN NOT NULL DEFAULT TRUE,
    created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

INSERT INTO training_methods (method_key, label, display_order) VALUES
  ('straight','Séries retas',10),
  ('superset','Superset',20),
  ('circuit','Circuito',30),
  ('pyramid','Pirâmide',40),
  ('drop_set','Drop-set',50),
  ('cluster','Cluster',60),
  ('rest_pause','Rest-pause',70),
  ('contrast','Contraste (força+potência)',80),
  ('wave','Ondulatório',90),
  ('tempo','Tempo',100),
  ('emom','EMOM',110),
  ('amrap','AMRAP',120),
  ('five_by_five','5x5',130)
ON CONFLICT (method_key) DO NOTHING;

-- ============================================
-- B. CATÁLOGO DE EXERCÍCIOS (studio-global, autorável por treinador)
-- ============================================

CREATE TABLE IF NOT EXISTS exercises (
    id                   UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name                 TEXT NOT NULL,
    movement_pattern_key TEXT REFERENCES movement_patterns(pattern_key),
    default_category_key TEXT REFERENCES block_categories(category_key),  -- p/ filtrar no builder
    primary_muscles      TEXT[] NOT NULL DEFAULT '{}',
    secondary_muscles    TEXT[] NOT NULL DEFAULT '{}',
    equipment            TEXT,
    difficulty           TEXT CHECK (difficulty IN ('beginner','intermediate','advanced')),
    video_url            TEXT,
    cues                 TEXT,
    is_active            BOOLEAN NOT NULL DEFAULT TRUE,
    created_by           UUID REFERENCES profiles(id),
    created_at           TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at           TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_exercises_pattern  ON exercises(movement_pattern_key);
CREATE INDEX IF NOT EXISTS idx_exercises_category ON exercises(default_category_key);
CREATE INDEX IF NOT EXISTS idx_exercises_active   ON exercises(is_active);
CREATE INDEX IF NOT EXISTS idx_exercises_name     ON exercises(lower(name));

DROP TRIGGER IF EXISTS set_exercises_updated_at ON exercises;
CREATE TRIGGER set_exercises_updated_at BEFORE UPDATE ON exercises
    FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
-- Não seedar exercícios — conteúdo do treinador, criado via UI no A1.

-- ============================================
-- C. ÁRVORE DE TEMPLATE (biblioteca reutilizável)
-- program_templates -> session_templates -> block_templates -> item_templates -> set_templates
-- ============================================

CREATE TABLE IF NOT EXISTS program_templates (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name        TEXT NOT NULL,
    description TEXT,
    goal        TEXT,
    is_active   BOOLEAN NOT NULL DEFAULT TRUE,
    created_by  UUID REFERENCES profiles(id),
    created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_program_templates_creator ON program_templates(created_by);

DROP TRIGGER IF EXISTS set_program_templates_updated_at ON program_templates;
CREATE TRIGGER set_program_templates_updated_at BEFORE UPDATE ON program_templates
    FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TABLE IF NOT EXISTS session_templates (
    id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    program_template_id UUID NOT NULL REFERENCES program_templates(id) ON DELETE CASCADE,
    name                TEXT NOT NULL,                   -- 'Treino A'
    order_index         INTEGER NOT NULL DEFAULT 0,
    scheduled_days      INTEGER[] NOT NULL DEFAULT '{}', -- 0=dom..6=sáb (frequência sugerida)
    notes               TEXT,
    created_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at          TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_session_templates_program ON session_templates(program_template_id);

DROP TRIGGER IF EXISTS set_session_templates_updated_at ON session_templates;
CREATE TRIGGER set_session_templates_updated_at BEFORE UPDATE ON session_templates
    FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Bloco = uma faixa (Fase + Categoria) dentro da sessão. FK COMPOSTO garante categoria∈fase.
CREATE TABLE IF NOT EXISTS block_templates (
    id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    session_template_id UUID NOT NULL REFERENCES session_templates(id) ON DELETE CASCADE,
    phase               TEXT NOT NULL CHECK (phase IN
                          ('preparacao_movimento','potencia_forca','dse','regeneracao')),
    category_key        TEXT NOT NULL,
    order_index         INTEGER NOT NULL DEFAULT 0,
    label               TEXT,
    notes               TEXT,
    created_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT block_templates_category_in_phase
        FOREIGN KEY (phase, category_key)
        REFERENCES block_categories(phase, category_key)
);
CREATE INDEX IF NOT EXISTS idx_block_templates_session ON block_templates(session_template_id);

-- Item = exercício/estação dentro do bloco. group_label = letra do superset (A/B/C); NULL = isolado.
CREATE TABLE IF NOT EXISTS item_templates (
    id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    block_template_id UUID NOT NULL REFERENCES block_templates(id) ON DELETE CASCADE,
    exercise_id       UUID REFERENCES exercises(id),
    custom_name       TEXT,                      -- p/ drill ad-hoc fora do catálogo
    group_label       TEXT,                      -- 'A','B',... (superset/estação)
    order_index       INTEGER NOT NULL DEFAULT 0,
    method_key        TEXT REFERENCES training_methods(method_key),
    rounds            INTEGER,                   -- rodadas do método (cluster/circuito)
    notes             TEXT,
    created_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT item_templates_has_exercise
        CHECK (exercise_id IS NOT NULL OR custom_name IS NOT NULL)
);
CREATE INDEX IF NOT EXISTS idx_item_templates_block    ON item_templates(block_template_id);
CREATE INDEX IF NOT EXISTS idx_item_templates_exercise ON item_templates(exercise_id);

-- Série. Campos de resistência + DSE (intervalo) + VBT (futuro), todos nullable.
CREATE TABLE IF NOT EXISTS set_templates (
    id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    item_template_id UUID NOT NULL REFERENCES item_templates(id) ON DELETE CASCADE,
    set_number       INTEGER NOT NULL DEFAULT 1,
    set_type         TEXT,          -- 'work','warmup','backoff','drop','failure',... (livre)
    -- resistência
    reps             INTEGER,
    reps_max         INTEGER,       -- faixa (ex.: 8–10): reps=8, reps_max=10
    each_side        BOOLEAN NOT NULL DEFAULT FALSE, -- 'ea.' (por lado)
    load_kg          NUMERIC(6,2),  -- carga v1 = kg absoluto
    load_pct_1rm     NUMERIC(5,2),  -- opção secundária
    rir              INTEGER,
    tempo            TEXT,          -- '3-1-1-0'
    rest_seconds     INTEGER,
    round_number     INTEGER,
    -- DSE (intervalo): duração/distância/zona em vez de reps+carga
    duration_seconds INTEGER,
    distance_m       INTEGER,
    target_zone      TEXT,          -- 'Z2','FC 140-150','RPE 7'
    -- VBT / Output (futuro C3) — já preparado, nullable
    target_velocity_ms NUMERIC(4,2),
    velocity_loss_pct  NUMERIC(5,2),
    notes            TEXT,
    created_at       TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_set_templates_item ON set_templates(item_template_id);
