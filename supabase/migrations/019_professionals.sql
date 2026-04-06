-- ============================================
-- Migration 019: Tabela professionals e enum profession_type
-- ============================================

-- 1. Enum para tipo de profissional
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'profession_type') THEN
        CREATE TYPE profession_type AS ENUM ('trainer', 'nutritionist', 'physiotherapist');
    END IF;
END
$$;

-- 2. Adicionar campo profession_type à tabela profiles (nullable para retrocompatibilidade)
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS profession_type profession_type;

-- 3. Atualizar profiles existentes com role='trainer' para profession_type='trainer'
UPDATE profiles SET profession_type = 'trainer' WHERE role = 'trainer' AND profession_type IS NULL;

-- 4. Expandir o enum user_role para incluir 'professional'
ALTER TYPE user_role ADD VALUE IF NOT EXISTS 'professional';

-- 5. Tabela professionals (abstração de todos os tipos de profissional)
CREATE TABLE IF NOT EXISTS professionals (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    profile_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
    profession_type profession_type NOT NULL,
    start_date DATE NOT NULL DEFAULT CURRENT_DATE,
    is_active BOOLEAN NOT NULL DEFAULT true,
    notes TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT professionals_profile_profession_unique UNIQUE(profile_id, profession_type)
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_professionals_profile_id ON professionals(profile_id);
CREATE INDEX IF NOT EXISTS idx_professionals_profession_type ON professionals(profession_type);
CREATE INDEX IF NOT EXISTS idx_professionals_is_active ON professionals(is_active);

-- Trigger para updated_at
CREATE OR REPLACE FUNCTION update_professionals_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER set_professionals_updated_at
    BEFORE UPDATE ON professionals
    FOR EACH ROW
    EXECUTE FUNCTION update_professionals_updated_at();

-- 6. Migrar treinadores existentes para a tabela professionals
INSERT INTO professionals (profile_id, profession_type, start_date, is_active, notes, created_at, updated_at)
SELECT
    t.profile_id,
    'trainer'::profession_type,
    t.start_date,
    t.is_active,
    t.notes,
    t.created_at,
    t.updated_at
FROM trainers t
ON CONFLICT (profile_id, profession_type) DO NOTHING;
