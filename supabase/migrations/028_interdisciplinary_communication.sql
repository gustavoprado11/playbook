-- ============================================
-- Migration 028: Comunicação interdisciplinar (base)
-- Encaminhamentos, solicitações e respostas entre profissionais
-- ============================================

CREATE TABLE IF NOT EXISTS interdisciplinary_referrals (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    student_id UUID NOT NULL REFERENCES students(id) ON DELETE CASCADE,
    from_professional_id UUID NOT NULL REFERENCES professionals(id) ON DELETE CASCADE,
    to_professional_id UUID NOT NULL REFERENCES professionals(id) ON DELETE CASCADE,
    type TEXT NOT NULL CHECK (type IN ('referral', 'request', 'alert', 'clearance')),
    priority TEXT NOT NULL DEFAULT 'normal' CHECK (priority IN ('low', 'normal', 'high')),
    subject TEXT NOT NULL,
    body TEXT,
    context_ref JSONB,
    status TEXT NOT NULL DEFAULT 'pending'
        CHECK (status IN ('pending', 'accepted', 'completed', 'declined')),
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    resolved_at TIMESTAMPTZ,
    CONSTRAINT referral_distinct_professionals CHECK (from_professional_id <> to_professional_id)
);

CREATE INDEX IF NOT EXISTS idx_referrals_student ON interdisciplinary_referrals(student_id);
CREATE INDEX IF NOT EXISTS idx_referrals_from ON interdisciplinary_referrals(from_professional_id);
CREATE INDEX IF NOT EXISTS idx_referrals_to ON interdisciplinary_referrals(to_professional_id);
CREATE INDEX IF NOT EXISTS idx_referrals_status ON interdisciplinary_referrals(status);
CREATE INDEX IF NOT EXISTS idx_referrals_to_status ON interdisciplinary_referrals(to_professional_id, status);

CREATE TABLE IF NOT EXISTS referral_replies (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    referral_id UUID NOT NULL REFERENCES interdisciplinary_referrals(id) ON DELETE CASCADE,
    author_professional_id UUID NOT NULL REFERENCES professionals(id) ON DELETE CASCADE,
    body TEXT NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_referral_replies_referral ON referral_replies(referral_id);

CREATE TRIGGER set_referrals_updated_at
    BEFORE UPDATE ON interdisciplinary_referrals
    FOR EACH ROW EXECUTE FUNCTION update_professionals_updated_at();

-- ============================================
-- Helper: o usuário autenticado atende este aluno?
-- (treinador via students.trainer_id OU profissional via student_professionals)
-- ============================================
CREATE OR REPLACE FUNCTION public.attends_student(p_student_id UUID)
RETURNS BOOLEAN
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = ''
AS $$
    SELECT EXISTS (
        SELECT 1
        FROM public.student_professionals sp
        JOIN public.professionals p ON p.id = sp.professional_id
        WHERE sp.student_id = p_student_id
          AND sp.status = 'active'
          AND p.profile_id = auth.uid()
          AND p.is_active = true
        UNION
        SELECT 1
        FROM public.students s
        JOIN public.trainers t ON t.id = s.trainer_id
        WHERE s.id = p_student_id
          AND t.profile_id = auth.uid()
    );
$$;

-- ============================================
-- RLS: interdisciplinary_referrals
-- ============================================
ALTER TABLE interdisciplinary_referrals ENABLE ROW LEVEL SECURITY;

CREATE POLICY referrals_manager_select ON interdisciplinary_referrals
    FOR SELECT TO authenticated
    USING (public.is_manager());

CREATE POLICY referrals_participant_select ON interdisciplinary_referrals
    FOR SELECT TO authenticated
    USING (
        from_professional_id IN (SELECT id FROM professionals WHERE profile_id = auth.uid())
        OR to_professional_id IN (SELECT id FROM professionals WHERE profile_id = auth.uid())
    );

CREATE POLICY referrals_insert ON interdisciplinary_referrals
    FOR INSERT TO authenticated
    WITH CHECK (
        from_professional_id IN (SELECT id FROM professionals WHERE profile_id = auth.uid())
        AND public.attends_student(student_id)
    );

CREATE POLICY referrals_update ON interdisciplinary_referrals
    FOR UPDATE TO authenticated
    USING (
        from_professional_id IN (SELECT id FROM professionals WHERE profile_id = auth.uid())
        OR to_professional_id IN (SELECT id FROM professionals WHERE profile_id = auth.uid())
    )
    WITH CHECK (
        from_professional_id IN (SELECT id FROM professionals WHERE profile_id = auth.uid())
        OR to_professional_id IN (SELECT id FROM professionals WHERE profile_id = auth.uid())
    );

-- ============================================
-- RLS: referral_replies
-- ============================================
ALTER TABLE referral_replies ENABLE ROW LEVEL SECURITY;

CREATE POLICY referral_replies_manager_select ON referral_replies
    FOR SELECT TO authenticated
    USING (public.is_manager());

CREATE POLICY referral_replies_participant_select ON referral_replies
    FOR SELECT TO authenticated
    USING (
        referral_id IN (
            SELECT id FROM interdisciplinary_referrals
            WHERE from_professional_id IN (SELECT id FROM professionals WHERE profile_id = auth.uid())
               OR to_professional_id IN (SELECT id FROM professionals WHERE profile_id = auth.uid())
        )
    );

CREATE POLICY referral_replies_insert ON referral_replies
    FOR INSERT TO authenticated
    WITH CHECK (
        author_professional_id IN (SELECT id FROM professionals WHERE profile_id = auth.uid())
        AND referral_id IN (
            SELECT id FROM interdisciplinary_referrals
            WHERE from_professional_id IN (SELECT id FROM professionals WHERE profile_id = auth.uid())
               OR to_professional_id IN (SELECT id FROM professionals WHERE profile_id = auth.uid())
        )
    );
