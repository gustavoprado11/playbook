-- ============================================
-- Migration 039: Retenção — pausa neutra com carência + auto-cancelamento
--
-- Bug relatado: a carteira caía (ex.: 40 -> 35) mas a taxa de retenção
-- mostrava 100%, porque a taxa era dirigida por uma contagem estreita de
-- `cancellations` (status='cancelled' E end_date no mês) que não reconciliava
-- com a queda real de alunos. Alunos que iam para `paused` sumiam do fim do
-- mês mas não eram contados como perda -> (40-0)/40 = 100%.
--
-- Regra de negócio definida:
--   * `paused` é NEUTRO durante uma janela de carência (default 35 dias):
--     sai do numerador E do denominador da taxa (não é perda... ainda).
--   * Passada a carência, o aluno é auto-convertido em `cancelled`
--     (end_date = data em que completou a carência) -> aí sim conta como perda.
--
-- A taxa passa a reconciliar pelo coorte de início:
--     base = ativos_no_inicio - pausados_em_carencia
--     retencao = (base - cancelamentos_do_coorte) / base
-- ============================================

-- --------------------------------------------
-- 1. Coluna paused_at (quando a pausa atual começou)
-- --------------------------------------------
ALTER TABLE students ADD COLUMN IF NOT EXISTS paused_at DATE;

-- Backfill para quem já está pausado: pega a data do último evento
-- status_change -> paused; fallback para updated_at/created_at.
UPDATE students s
SET paused_at = COALESCE(
    (SELECT MAX(e.event_date)::date
       FROM student_events e
      WHERE e.student_id = s.id
        AND e.event_type = 'status_change'
        AND e.new_value->>'status' = 'paused'),
    s.updated_at::date,
    s.created_at::date
)
WHERE s.status = 'paused' AND s.paused_at IS NULL;

-- --------------------------------------------
-- 2. get_pause_grace_days(): carência configurável (default 35)
--    Espelha o padrão de get_min_portfolio_size().
-- --------------------------------------------
CREATE OR REPLACE FUNCTION get_pause_grace_days()
RETURNS INTEGER AS $$
DECLARE
    v_rule game_rules;
BEGIN
    v_rule := get_active_game_rule();

    IF v_rule IS NULL THEN
        RETURN 35; -- Default fallback
    END IF;

    RETURN COALESCE((v_rule.kpi_config->'retention'->>'pause_grace_days')::INTEGER, 35);
END;
$$ LANGUAGE plpgsql STABLE
SET search_path = pg_catalog, public;

-- --------------------------------------------
-- 3. convert_expired_paused_students(): pausa expirada -> cancelado
--    Idempotente. Pode ser chamada pelo cron diário e on-demand.
--    Retorna a quantidade convertida.
-- --------------------------------------------
CREATE OR REPLACE FUNCTION convert_expired_paused_students()
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
DECLARE
    v_grace INTEGER;
    v_count INTEGER := 0;
    r RECORD;
BEGIN
    v_grace := get_pause_grace_days();

    FOR r IN
        SELECT id, paused_at
        FROM students
        WHERE status = 'paused'
          AND is_archived = FALSE
          AND paused_at IS NOT NULL
          AND paused_at <= (CURRENT_DATE - v_grace)
    LOOP
        UPDATE students
        SET status = 'cancelled',
            end_date = (r.paused_at + v_grace)
        WHERE id = r.id;

        INSERT INTO student_events (student_id, event_type, old_value, new_value, event_date)
        VALUES (
            r.id,
            'status_change',
            jsonb_build_object('status', 'paused'),
            jsonb_build_object('status', 'cancelled', 'reason', 'auto_pause_expired'),
            (r.paused_at + v_grace)
        );

        v_count := v_count + 1;
    END LOOP;

    RETURN v_count;
END;
$$;

-- Não deve ser chamável via RPC pelos clientes (mesma postura das migrations 026/032).
REVOKE EXECUTE ON FUNCTION public.convert_expired_paused_students() FROM PUBLIC, anon, authenticated;

-- --------------------------------------------
-- 4. Reescreve calculate_retention
--    Precisa de DROP+CREATE porque o RETURNS TABLE ganha a coluna paused_grace
--    (Postgres não troca tipo de retorno via CREATE OR REPLACE).
-- --------------------------------------------
DROP FUNCTION IF EXISTS calculate_retention(UUID, DATE);

CREATE FUNCTION calculate_retention(
    p_trainer_id UUID,
    p_reference_month DATE
) RETURNS TABLE (
    students_start INTEGER,   -- headcount real no início (inclui pausados)
    students_end INTEGER,     -- ativos no fim (inclui novos do mês) — informativo
    cancellations INTEGER,    -- perdas do coorte de início durante o mês
    paused_grace INTEGER,     -- pausados em carência (neutros) do coorte de início
    retention_rate DECIMAL(5,2),
    retention_eligible BOOLEAN
)
LANGUAGE plpgsql
STABLE
SET search_path = pg_catalog, public
AS $$
DECLARE
    v_month_start DATE;
    v_month_end DATE;
    v_min_portfolio INTEGER;
    v_base INTEGER;
BEGIN
    v_month_start := DATE_TRUNC('month', p_reference_month)::DATE;
    v_month_end := (DATE_TRUNC('month', p_reference_month) + INTERVAL '1 month' - INTERVAL '1 day')::DATE;
    v_min_portfolio := get_min_portfolio_size();

    -- Coorte de início: alunos que existiam antes do mês e não estavam
    -- cancelados no início (inclui os que hoje estão pausados).
    SELECT COUNT(*)::INTEGER INTO students_start
    FROM students s
    WHERE s.trainer_id = p_trainer_id
      AND s.is_archived = FALSE
      AND s.start_date < v_month_start
      AND (s.status != 'cancelled' OR s.end_date >= v_month_start);

    -- Pausados em carência (neutros): do coorte de início, hoje pausados.
    SELECT COUNT(*)::INTEGER INTO paused_grace
    FROM students s
    WHERE s.trainer_id = p_trainer_id
      AND s.is_archived = FALSE
      AND s.start_date < v_month_start
      AND s.status = 'paused';

    -- Cancelamentos do coorte durante o mês.
    SELECT COUNT(*)::INTEGER INTO cancellations
    FROM students s
    WHERE s.trainer_id = p_trainer_id
      AND s.is_archived = FALSE
      AND s.start_date < v_month_start
      AND s.status = 'cancelled'
      AND s.end_date BETWEEN v_month_start AND v_month_end;

    -- Ativos no fim do mês (headcount real, inclui novos) — informativo.
    SELECT COUNT(*)::INTEGER INTO students_end
    FROM students s
    WHERE s.trainer_id = p_trainer_id
      AND s.is_archived = FALSE
      AND s.start_date <= v_month_end
      AND s.status = 'active';

    -- Base de retenção = coorte de início menos pausados neutros.
    v_base := students_start - paused_grace;

    retention_eligible := v_base >= v_min_portfolio;

    IF v_base > 0 THEN
        retention_rate := ROUND(((v_base - cancellations)::DECIMAL / v_base) * 100, 2);
    ELSE
        retention_rate := 0.00;
    END IF;

    RETURN NEXT;
END;
$$;

-- Re-aplica o grant original (003) perdido no DROP.
GRANT EXECUTE ON FUNCTION calculate_retention(UUID, DATE) TO authenticated;

-- --------------------------------------------
-- 5. Backfill imediato: converte pausas já vencidas agora.
-- --------------------------------------------
SELECT convert_expired_paused_students();

-- --------------------------------------------
-- 6. Agenda o job diário via pg_cron (resiliente se a extensão não existir).
-- --------------------------------------------
DO $$
BEGIN
    BEGIN
        CREATE EXTENSION IF NOT EXISTS pg_cron;
    EXCEPTION WHEN OTHERS THEN
        RAISE NOTICE 'Não foi possível habilitar pg_cron: %', SQLERRM;
    END;

    IF EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'pg_cron') THEN
        IF EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'convert-expired-paused-students') THEN
            PERFORM cron.unschedule('convert-expired-paused-students');
        END IF;
        PERFORM cron.schedule(
            'convert-expired-paused-students',
            '0 3 * * *',
            $cron$SELECT public.convert_expired_paused_students();$cron$
        );
    ELSE
        RAISE NOTICE 'pg_cron indisponível: agende convert_expired_paused_students() externamente (ex.: cron do Next.js).';
    END IF;
END $$;
