-- ============================================
-- Migration 031: Central de notificações
-- Eventos da comunicação interdisciplinar (Fase 3).
-- ============================================

CREATE TABLE IF NOT EXISTS notifications (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    recipient_profile_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
    type TEXT NOT NULL CHECK (type IN (
        'referral_received', 'referral_replied', 'referral_status_changed',
        'clearance_issued', 'shared_note_added'
    )),
    title TEXT NOT NULL,
    body TEXT,
    link TEXT,
    source_table TEXT,
    source_id UUID,
    is_read BOOLEAN NOT NULL DEFAULT false,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    read_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_notifications_recipient ON notifications(recipient_profile_id);
CREATE INDEX IF NOT EXISTS idx_notifications_unread ON notifications(recipient_profile_id, is_read);
CREATE INDEX IF NOT EXISTS idx_notifications_created ON notifications(created_at DESC);

ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;

CREATE POLICY notifications_own_select ON notifications
    FOR SELECT TO authenticated
    USING (recipient_profile_id = auth.uid());

CREATE POLICY notifications_own_update ON notifications
    FOR UPDATE TO authenticated
    USING (recipient_profile_id = auth.uid())
    WITH CHECK (recipient_profile_id = auth.uid());

-- Inserts vêm dos triggers (SECURITY DEFINER). Sem policy de INSERT pública.

-- ============================================
-- Helper: profile_id dono de um professional_id
-- ============================================
CREATE OR REPLACE FUNCTION public.profile_of_professional(p_professional_id UUID)
RETURNS UUID
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = ''
AS $$
    SELECT profile_id FROM public.professionals WHERE id = p_professional_id LIMIT 1;
$$;

-- ============================================
-- Trigger 1: novo encaminhamento -> notifica destinatário
-- ============================================
CREATE OR REPLACE FUNCTION public.notify_referral_created()
RETURNS TRIGGER
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
    recipient UUID;
    student_name TEXT;
BEGIN
    recipient := public.profile_of_professional(NEW.to_professional_id);
    SELECT full_name INTO student_name FROM public.students WHERE id = NEW.student_id;

    INSERT INTO public.notifications (recipient_profile_id, type, title, body, link, source_table, source_id)
    VALUES (
        recipient,
        'referral_received',
        CASE NEW.type WHEN 'request' THEN 'Nova solicitação' ELSE 'Novo encaminhamento' END,
        COALESCE(student_name, 'Aluno') || ': ' || NEW.subject,
        '/dashboard/messages',
        'interdisciplinary_referrals',
        NEW.id
    );
    RETURN NEW;
END;
$$;

CREATE TRIGGER trg_notify_referral_created
    AFTER INSERT ON interdisciplinary_referrals
    FOR EACH ROW EXECUTE FUNCTION public.notify_referral_created();

-- ============================================
-- Trigger 2: mudança de status -> notifica remetente
-- ============================================
CREATE OR REPLACE FUNCTION public.notify_referral_status()
RETURNS TRIGGER
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
    recipient UUID;
    student_name TEXT;
BEGIN
    IF NEW.status IS DISTINCT FROM OLD.status THEN
        recipient := public.profile_of_professional(NEW.from_professional_id);
        SELECT full_name INTO student_name FROM public.students WHERE id = NEW.student_id;
        INSERT INTO public.notifications (recipient_profile_id, type, title, body, link, source_table, source_id)
        VALUES (
            recipient,
            'referral_status_changed',
            'Atualização em encaminhamento',
            COALESCE(student_name, 'Aluno') || ': ' || NEW.subject || ' — ' ||
            CASE NEW.status
                WHEN 'accepted' THEN 'aceito'
                WHEN 'completed' THEN 'concluído'
                WHEN 'declined' THEN 'recusado'
                ELSE NEW.status
            END,
            '/dashboard/messages',
            'interdisciplinary_referrals',
            NEW.id
        );
    END IF;
    RETURN NEW;
END;
$$;

CREATE TRIGGER trg_notify_referral_status
    AFTER UPDATE ON interdisciplinary_referrals
    FOR EACH ROW EXECUTE FUNCTION public.notify_referral_status();

-- ============================================
-- Trigger 3: nova resposta -> notifica o outro participante
-- ============================================
CREATE OR REPLACE FUNCTION public.notify_referral_replied()
RETURNS TRIGGER
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
    ref RECORD;
    author_profile UUID;
    recipient UUID;
BEGIN
    SELECT * INTO ref FROM public.interdisciplinary_referrals WHERE id = NEW.referral_id;
    author_profile := public.profile_of_professional(NEW.author_professional_id);

    recipient := CASE
        WHEN public.profile_of_professional(ref.from_professional_id) = author_profile
            THEN public.profile_of_professional(ref.to_professional_id)
        ELSE public.profile_of_professional(ref.from_professional_id)
    END;

    INSERT INTO public.notifications (recipient_profile_id, type, title, body, link, source_table, source_id)
    VALUES (recipient, 'referral_replied', 'Nova resposta', ref.subject,
            '/dashboard/messages', 'interdisciplinary_referrals', ref.id);
    RETURN NEW;
END;
$$;

CREATE TRIGGER trg_notify_referral_replied
    AFTER INSERT ON referral_replies
    FOR EACH ROW EXECUTE FUNCTION public.notify_referral_replied();

-- ============================================
-- Trigger 4: restrição emitida -> notifica treinador(es) do aluno
-- ============================================
CREATE OR REPLACE FUNCTION public.notify_clearance_issued()
RETURNS TRIGGER
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
    student_name TEXT;
    trainer_profile UUID;
    issuer_profile UUID;
BEGIN
    SELECT full_name INTO student_name FROM public.students WHERE id = NEW.student_id;
    issuer_profile := public.profile_of_professional(NEW.issued_by_professional_id);

    FOR trainer_profile IN
        SELECT DISTINCT pr.id
        FROM (
            SELECT t.profile_id AS pid
            FROM public.students s JOIN public.trainers t ON t.id = s.trainer_id
            WHERE s.id = NEW.student_id
            UNION
            SELECT p.profile_id AS pid
            FROM public.student_professionals sp
            JOIN public.professionals p ON p.id = sp.professional_id
            WHERE sp.student_id = NEW.student_id AND sp.status = 'active'
              AND p.profession_type = 'trainer'
        ) src
        JOIN public.profiles pr ON pr.id = src.pid
        WHERE pr.id <> issuer_profile
    LOOP
        INSERT INTO public.notifications (recipient_profile_id, type, title, body, link, source_table, source_id)
        VALUES (
            trainer_profile,
            'clearance_issued',
            CASE NEW.clearance_level
                WHEN 'contraindicated' THEN 'Contraindicação clínica'
                WHEN 'restricted' THEN 'Nova restrição clínica'
                ELSE 'Liberação clínica'
            END,
            COALESCE(student_name, 'Aluno') || ': ' || NEW.description,
            '/dashboard/trainer/students/' || NEW.student_id,
            'student_clearances',
            NEW.id
        );
    END LOOP;
    RETURN NEW;
END;
$$;

CREATE TRIGGER trg_notify_clearance_issued
    AFTER INSERT ON student_clearances
    FOR EACH ROW EXECUTE FUNCTION public.notify_clearance_issued();
