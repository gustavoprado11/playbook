-- =====================================================
-- Migration 026: Security hardening
-- Corrige achados do Supabase advisor (security):
--   1. View SECURITY DEFINER -> security_invoker
--   2. search_path mutável nas funções SECURITY DEFINER (rewrite + qualificação)
--   3. REVOKE EXECUTE nas funções de trigger (removê-las da superfície RPC)
--   4. search_path fixo nas demais funções SECURITY INVOKER
-- Não altera comportamento da aplicação.
-- =====================================================

-- =====================================================
-- 1. VIEW: trainer_activity_summary -> security_invoker
-- Confirmado: consumida só pelo gestor (manager/page.tsx) via client com RLS;
-- o gestor tem SELECT em profiles/trainers/trainer_activity_log via is_manager().
-- =====================================================
CREATE OR REPLACE VIEW public.trainer_activity_summary
WITH (security_invoker = true) AS
SELECT
    t.id AS trainer_id,
    p.full_name AS trainer_name,
    MAX(CASE WHEN tal.activity_type = 'login'
        THEN tal.occurred_at END) AS last_login,
    MAX(CASE WHEN tal.activity_type = 'result_management'
        THEN tal.occurred_at END) AS last_result_management,
    MAX(CASE WHEN tal.activity_type = 'student_status_update'
        THEN tal.occurred_at END) AS last_student_status_update,
    MAX(CASE WHEN tal.activity_type = 'referral_registered'
        THEN tal.occurred_at END) AS last_referral_registered,
    MAX(CASE WHEN tal.activity_type = 'student_registered'
        THEN tal.occurred_at END) AS last_student_registered,
    MAX(CASE WHEN tal.activity_type = 'schedule_update'
        THEN tal.occurred_at END) AS last_schedule_update,
    MAX(CASE WHEN tal.activity_type = 'student_archived'
        THEN tal.occurred_at END) AS last_student_archived
FROM public.trainers t
JOIN public.profiles p ON t.profile_id = p.id
LEFT JOIN public.trainer_activity_log tal ON t.id = tal.trainer_id
WHERE t.is_active = TRUE
GROUP BY t.id, p.full_name;

GRANT SELECT ON public.trainer_activity_summary TO authenticated;

-- =====================================================
-- 2. FUNÇÕES SECURITY DEFINER: search_path = '' + referências qualificadas
-- =====================================================

-- 2.1 Helpers de autorização (LANGUAGE sql). Mantêm EXECUTE para authenticated
-- pois são usados dentro de policies RLS (avaliadas no contexto do usuário).
CREATE OR REPLACE FUNCTION public.get_user_role()
RETURNS public.user_role
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = ''
AS $$
    SELECT role FROM public.profiles WHERE id = auth.uid();
$$;

CREATE OR REPLACE FUNCTION public.is_manager()
RETURNS BOOLEAN
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = ''
AS $$
    SELECT EXISTS (
        SELECT 1 FROM public.profiles
        WHERE id = auth.uid()
        AND role = 'manager'
    );
$$;

CREATE OR REPLACE FUNCTION public.get_trainer_id()
RETURNS UUID
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = ''
AS $$
    SELECT id FROM public.trainers WHERE profile_id = auth.uid();
$$;

CREATE OR REPLACE FUNCTION public.get_professional_id()
RETURNS UUID
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = ''
AS $$
    SELECT p.id
    FROM public.professionals p
    JOIN public.profiles pr ON pr.id = p.profile_id
    WHERE pr.id = auth.uid()
    AND p.is_active = true
    LIMIT 1;
$$;

CREATE OR REPLACE FUNCTION public.get_professional_id_by_type(p_type public.profession_type)
RETURNS UUID
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = ''
AS $$
    SELECT p.id
    FROM public.professionals p
    WHERE p.profile_id = auth.uid()
    AND p.profession_type = p_type
    AND p.is_active = true
    LIMIT 1;
$$;

CREATE OR REPLACE FUNCTION public.is_profession(p_type public.profession_type)
RETURNS BOOLEAN
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = ''
AS $$
    SELECT EXISTS (
        SELECT 1
        FROM public.professionals p
        WHERE p.profile_id = auth.uid()
        AND p.profession_type = p_type
        AND p.is_active = true
    );
$$;

-- 2.2 Funções de trigger (LANGUAGE plpgsql). search_path = '' + qualificação.
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
    INSERT INTO public.profiles (id, email, full_name, role)
    VALUES (
        NEW.id,
        NEW.email,
        COALESCE(NEW.raw_user_meta_data->>'full_name', split_part(NEW.email, '@', 1)),
        COALESCE((NEW.raw_user_meta_data->>'role')::public.user_role, 'trainer')
    )
    ON CONFLICT (id) DO UPDATE SET
        full_name = EXCLUDED.full_name,
        role = EXCLUDED.role;
    RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.log_result_management()
RETURNS TRIGGER
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
    v_trainer_id UUID;
BEGIN
    SELECT s.trainer_id INTO v_trainer_id
    FROM public.students s
    WHERE s.id = NEW.student_id
    AND s.trainer_id IS NOT NULL;

    IF v_trainer_id IS NOT NULL THEN
        INSERT INTO public.trainer_activity_log (trainer_id, activity_type, metadata)
        VALUES (
            v_trainer_id,
            'result_management',
            jsonb_build_object(
                'student_id', NEW.student_id,
                'assessment_id', NEW.id,
                'protocol_id', NEW.protocol_id
            )
        );
    END IF;

    RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.log_student_status_update()
RETURNS TRIGGER
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
    IF OLD.status IS DISTINCT FROM NEW.status THEN
        INSERT INTO public.trainer_activity_log (trainer_id, activity_type, metadata)
        VALUES (
            NEW.trainer_id,
            'student_status_update',
            jsonb_build_object(
                'student_id', NEW.id,
                'old_status', OLD.status::TEXT,
                'new_status', NEW.status::TEXT
            )
        );
    END IF;

    RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.log_referral_registered()
RETURNS TRIGGER
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
    IF NEW.origin = 'referral' AND NEW.referred_by_trainer_id IS NOT NULL THEN
        INSERT INTO public.trainer_activity_log (trainer_id, activity_type, metadata)
        VALUES (
            NEW.referred_by_trainer_id,
            'referral_registered',
            jsonb_build_object(
                'student_id', NEW.id,
                'student_name', NEW.full_name,
                'assigned_trainer_id', NEW.trainer_id
            )
        );
    END IF;

    RETURN NEW;
END;
$$;

-- =====================================================
-- 3. REVOKE EXECUTE nas funções de trigger.
-- Triggers disparam independentemente de EXECUTE; remover o grant
-- tira essas funções da superfície RPC (PostgREST) para anon/authenticated.
-- =====================================================
REVOKE EXECUTE ON FUNCTION public.handle_new_user() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.log_result_management() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.log_student_status_update() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.log_referral_registered() FROM PUBLIC, anon, authenticated;

-- =====================================================
-- 4. search_path fixo nas funções SECURITY INVOKER restantes.
-- Corpos não são reescritos; 'public' permanece no path para resolver os nomes.
-- =====================================================
ALTER FUNCTION public.calculate_management(uuid, date) SET search_path = pg_catalog, public;
ALTER FUNCTION public.calculate_referrals(uuid, date) SET search_path = pg_catalog, public;
ALTER FUNCTION public.calculate_retention(uuid, date) SET search_path = pg_catalog, public;
ALTER FUNCTION public.calculate_reward(boolean, boolean, boolean, uuid) SET search_path = pg_catalog, public;
ALTER FUNCTION public.finalize_performance_snapshot(uuid, date, uuid) SET search_path = pg_catalog, public;
ALTER FUNCTION public.generate_performance_snapshot(uuid, date) SET search_path = pg_catalog, public;
ALTER FUNCTION public.get_active_game_rule() SET search_path = pg_catalog, public;
ALTER FUNCTION public.get_management_window_days() SET search_path = pg_catalog, public;
ALTER FUNCTION public.get_min_portfolio_size() SET search_path = pg_catalog, public;
ALTER FUNCTION public.get_referral_validation_days() SET search_path = pg_catalog, public;
ALTER FUNCTION public.get_trainer_dashboard_data(uuid, date) SET search_path = pg_catalog, public;
ALTER FUNCTION public.prevent_finalized_snapshot_modification() SET search_path = pg_catalog, public;
ALTER FUNCTION public.sync_attendance_from_template() SET search_path = pg_catalog, public;
ALTER FUNCTION public.sync_attendance_trainer_id() SET search_path = pg_catalog, public;
ALTER FUNCTION public.sync_schedule_trainer_id() SET search_path = pg_catalog, public;
ALTER FUNCTION public.update_professionals_updated_at() SET search_path = pg_catalog, public;
ALTER FUNCTION public.update_updated_at_column() SET search_path = pg_catalog, public;
ALTER FUNCTION public.validate_referrals() SET search_path = pg_catalog, public;
