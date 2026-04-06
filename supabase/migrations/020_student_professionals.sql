-- ============================================
-- Migration 020: Tabela student_professionals e helpers
-- ============================================

-- Tabela de vínculo aluno <-> profissional
CREATE TABLE IF NOT EXISTS student_professionals (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    student_id UUID NOT NULL REFERENCES students(id) ON DELETE CASCADE,
    professional_id UUID NOT NULL REFERENCES professionals(id) ON DELETE CASCADE,
    status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'inactive')),
    started_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    ended_at TIMESTAMPTZ,
    notes TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT student_professionals_unique UNIQUE(student_id, professional_id)
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_student_professionals_student ON student_professionals(student_id);
CREATE INDEX IF NOT EXISTS idx_student_professionals_professional ON student_professionals(professional_id);
CREATE INDEX IF NOT EXISTS idx_student_professionals_status ON student_professionals(status);

-- Migrar vínculos existentes: students.trainer_id -> student_professionals
INSERT INTO student_professionals (student_id, professional_id, status, started_at)
SELECT
    s.id,
    p.id,
    CASE WHEN s.status = 'active' THEN 'active' ELSE 'inactive' END,
    s.created_at
FROM students s
JOIN trainers t ON s.trainer_id = t.id
JOIN professionals p ON p.profile_id = t.profile_id AND p.profession_type = 'trainer'
ON CONFLICT (student_id, professional_id) DO NOTHING;

-- Função helper: buscar professional_id do usuário autenticado
CREATE OR REPLACE FUNCTION public.get_professional_id()
RETURNS UUID AS $$
    SELECT p.id
    FROM professionals p
    JOIN profiles pr ON pr.id = p.profile_id
    WHERE pr.id = auth.uid()
    AND p.is_active = true
    LIMIT 1;
$$ LANGUAGE sql SECURITY DEFINER STABLE;

-- Função helper: buscar professional_id por tipo
CREATE OR REPLACE FUNCTION public.get_professional_id_by_type(p_type profession_type)
RETURNS UUID AS $$
    SELECT p.id
    FROM professionals p
    WHERE p.profile_id = auth.uid()
    AND p.profession_type = p_type
    AND p.is_active = true
    LIMIT 1;
$$ LANGUAGE sql SECURITY DEFINER STABLE;

-- Função helper: verificar se é profissional de um tipo específico
CREATE OR REPLACE FUNCTION public.is_profession(p_type profession_type)
RETURNS BOOLEAN AS $$
    SELECT EXISTS (
        SELECT 1
        FROM professionals p
        WHERE p.profile_id = auth.uid()
        AND p.profession_type = p_type
        AND p.is_active = true
    );
$$ LANGUAGE sql SECURITY DEFINER STABLE;
