-- ============================================
-- 051 — RPC save_workout_log (A4)
-- ============================================
-- Irmã da save_assigned_program_tree (048), rasa (2 níveis: log -> set_logs).
-- SECURITY INVOKER + search_path=''. Guarda por attends_student. Upsert-by-id do
-- workout_logs; delete-recreate dos set_logs (snapshot do prescrito + actuals).
-- Transacional. Retorna o workout_log_id.

CREATE OR REPLACE FUNCTION public.save_workout_log(payload jsonb)
RETURNS uuid
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = ''
AS $$
DECLARE
    v_uid uuid := auth.uid();
    v_log_id uuid := NULLIF(payload->>'id','')::uuid;
    v_student_id uuid := NULLIF(payload->>'student_id','')::uuid;
    v_set jsonb;
BEGIN
    IF v_uid IS NULL THEN RAISE EXCEPTION 'Unauthorized'; END IF;

    IF v_log_id IS NOT NULL THEN
        IF NOT EXISTS (SELECT 1 FROM public.workout_logs
                       WHERE id = v_log_id
                         AND (public.is_manager() OR public.attends_student(student_id))) THEN
            RAISE EXCEPTION 'Not allowed for this student';
        END IF;
        UPDATE public.workout_logs
           SET performed_at = COALESCE(NULLIF(payload->>'performed_at','')::date, performed_at),
               overall_rpe = NULLIF(payload->>'overall_rpe','')::numeric,
               notes = payload->>'notes',
               session_name = payload->>'session_name',
               updated_at = now()
         WHERE id = v_log_id;
    ELSE
        IF v_student_id IS NULL THEN RAISE EXCEPTION 'student_id is required'; END IF;
        IF NOT (public.is_manager() OR public.attends_student(v_student_id)) THEN
            RAISE EXCEPTION 'Not allowed for this student';
        END IF;
        INSERT INTO public.workout_logs
            (student_id, assigned_program_id, assigned_session_id, session_name,
             performed_at, overall_rpe, notes, logged_by)
        VALUES (v_student_id,
                NULLIF(payload->>'assigned_program_id','')::uuid,
                NULLIF(payload->>'assigned_session_id','')::uuid,
                payload->>'session_name',
                COALESCE(NULLIF(payload->>'performed_at','')::date, CURRENT_DATE),
                NULLIF(payload->>'overall_rpe','')::numeric,
                payload->>'notes', v_uid)
        RETURNING id INTO v_log_id;
    END IF;

    DELETE FROM public.set_logs WHERE workout_log_id = v_log_id;

    FOR v_set IN SELECT jsonb_array_elements(COALESCE(payload->'sets','[]'::jsonb)) LOOP
        INSERT INTO public.set_logs
            (workout_log_id, assigned_set_id, exercise_name, group_label, phase, category_key,
             set_number, planned_reps, planned_reps_max, planned_load_kg,
             planned_duration_seconds, planned_distance_m, planned_target_zone,
             reps_done, load_kg_done, duration_done_seconds, distance_done_m, rpe, completed,
             notes, order_index)
        VALUES (v_log_id, NULLIF(v_set->>'assigned_set_id','')::uuid,
                COALESCE(NULLIF(v_set->>'exercise_name',''), 'Exercício'),
                v_set->>'group_label', v_set->>'phase', v_set->>'category_key',
                NULLIF(v_set->>'set_number','')::int,
                NULLIF(v_set->>'planned_reps','')::int, NULLIF(v_set->>'planned_reps_max','')::int,
                NULLIF(v_set->>'planned_load_kg','')::numeric,
                NULLIF(v_set->>'planned_duration_seconds','')::int, NULLIF(v_set->>'planned_distance_m','')::int,
                v_set->>'planned_target_zone',
                NULLIF(v_set->>'reps_done','')::int, NULLIF(v_set->>'load_kg_done','')::numeric,
                NULLIF(v_set->>'duration_done_seconds','')::int, NULLIF(v_set->>'distance_done_m','')::int,
                NULLIF(v_set->>'rpe','')::numeric, COALESCE((v_set->>'completed')::boolean, false),
                v_set->>'notes', COALESCE((v_set->>'order_index')::int, 0));
    END LOOP;

    RETURN v_log_id;
END;
$$;

GRANT EXECUTE ON FUNCTION public.save_workout_log(jsonb) TO authenticated;
