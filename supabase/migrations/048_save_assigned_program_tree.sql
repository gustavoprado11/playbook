-- ============================================
-- 048 — RPC save_assigned_program_tree (A3)
-- ============================================
-- Irmã da save_program_tree (045) para a árvore ATRIBUÍDA por aluno.
-- Diferenças: root de posse = attends_student(student_id) (não created_by);
-- o programa carrega student_id/source_template_id/assigned_by/status/start_date;
-- o item grava os SNAPSHOTS (exercise_name/pattern/muscles/video/cues) que o
-- cliente já montou a partir do catálogo. SECURITY INVOKER + search_path=''.
-- Delete-recreate dos filhos; transacional (rollback total em erro).

CREATE OR REPLACE FUNCTION public.save_assigned_program_tree(payload jsonb)
RETURNS uuid
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = ''
AS $$
DECLARE
    v_uid uuid := auth.uid();
    v_program_id uuid := NULLIF(payload->>'id','')::uuid;
    v_student_id uuid := NULLIF(payload->>'student_id','')::uuid;
    v_session jsonb; v_block jsonb; v_item jsonb; v_set jsonb;
    v_session_id uuid; v_block_id uuid; v_item_id uuid;
BEGIN
    IF v_uid IS NULL THEN RAISE EXCEPTION 'Unauthorized'; END IF;
    IF NULLIF(payload->>'name','') IS NULL THEN
        RAISE EXCEPTION 'Program name is required';
    END IF;

    IF v_program_id IS NOT NULL THEN
        IF NOT EXISTS (SELECT 1 FROM public.assigned_programs
                       WHERE id = v_program_id
                         AND (public.is_manager() OR public.attends_student(student_id))) THEN
            RAISE EXCEPTION 'Not allowed for this student';
        END IF;
        UPDATE public.assigned_programs
           SET name = payload->>'name', description = payload->>'description',
               goal = payload->>'goal',
               status = COALESCE(NULLIF(payload->>'status',''),'active'),
               start_date = NULLIF(payload->>'start_date','')::date,
               updated_at = now()
         WHERE id = v_program_id;
    ELSE
        IF v_student_id IS NULL THEN RAISE EXCEPTION 'student_id is required'; END IF;
        IF NOT (public.is_manager() OR public.attends_student(v_student_id)) THEN
            RAISE EXCEPTION 'Not allowed for this student';
        END IF;
        INSERT INTO public.assigned_programs
            (student_id, source_template_id, name, description, goal, status, start_date, assigned_by)
        VALUES (v_student_id, NULLIF(payload->>'source_template_id','')::uuid,
                payload->>'name', payload->>'description', payload->>'goal',
                COALESCE(NULLIF(payload->>'status',''),'active'),
                NULLIF(payload->>'start_date','')::date, v_uid)
        RETURNING id INTO v_program_id;
    END IF;

    -- Substitui filhos (CASCADE apaga blocks/items/sets)
    DELETE FROM public.assigned_sessions WHERE assigned_program_id = v_program_id;

    FOR v_session IN SELECT jsonb_array_elements(COALESCE(payload->'sessions','[]'::jsonb)) LOOP
        INSERT INTO public.assigned_sessions (assigned_program_id, name, order_index, scheduled_days, notes)
        VALUES (v_program_id, v_session->>'name',
                COALESCE((v_session->>'order_index')::int,0),
                COALESCE(ARRAY(SELECT (d)::int FROM jsonb_array_elements_text(COALESCE(v_session->'scheduled_days','[]'::jsonb)) d), '{}'),
                v_session->>'notes')
        RETURNING id INTO v_session_id;

        FOR v_block IN SELECT jsonb_array_elements(COALESCE(v_session->'blocks','[]'::jsonb)) LOOP
            INSERT INTO public.assigned_blocks (assigned_session_id, phase, category_key, order_index, label, notes)
            VALUES (v_session_id, v_block->>'phase', v_block->>'category_key',
                    COALESCE((v_block->>'order_index')::int,0), v_block->>'label', v_block->>'notes')
            RETURNING id INTO v_block_id;

            FOR v_item IN SELECT jsonb_array_elements(COALESCE(v_block->'items','[]'::jsonb)) LOOP
                INSERT INTO public.assigned_items
                    (assigned_block_id, exercise_id, exercise_name, movement_pattern_key,
                     primary_muscles, secondary_muscles, video_url, cues,
                     custom_name, group_label, order_index, method_key, rounds, notes)
                VALUES (v_block_id, NULLIF(v_item->>'exercise_id','')::uuid,
                        COALESCE(NULLIF(v_item->>'exercise_name',''), v_item->>'custom_name', 'Exercício'),
                        NULLIF(v_item->>'movement_pattern_key',''),
                        COALESCE(ARRAY(SELECT jsonb_array_elements_text(COALESCE(v_item->'primary_muscles','[]'::jsonb))), '{}'),
                        COALESCE(ARRAY(SELECT jsonb_array_elements_text(COALESCE(v_item->'secondary_muscles','[]'::jsonb))), '{}'),
                        NULLIF(v_item->>'video_url',''), NULLIF(v_item->>'cues',''),
                        v_item->>'custom_name', v_item->>'group_label',
                        COALESCE((v_item->>'order_index')::int,0),
                        NULLIF(v_item->>'method_key',''), NULLIF(v_item->>'rounds','')::int, v_item->>'notes')
                RETURNING id INTO v_item_id;

                FOR v_set IN SELECT jsonb_array_elements(COALESCE(v_item->'sets','[]'::jsonb)) LOOP
                    INSERT INTO public.assigned_sets
                        (assigned_item_id, set_number, set_type, reps, reps_max, each_side, load_kg,
                         rir, tempo, rest_seconds, round_number, duration_seconds, distance_m, target_zone, notes)
                    VALUES (v_item_id, COALESCE((v_set->>'set_number')::int,1), v_set->>'set_type',
                        NULLIF(v_set->>'reps','')::int, NULLIF(v_set->>'reps_max','')::int,
                        COALESCE((v_set->>'each_side')::boolean,false), NULLIF(v_set->>'load_kg','')::numeric,
                        NULLIF(v_set->>'rir','')::int, v_set->>'tempo', NULLIF(v_set->>'rest_seconds','')::int,
                        NULLIF(v_set->>'round_number','')::int, NULLIF(v_set->>'duration_seconds','')::int,
                        NULLIF(v_set->>'distance_m','')::int, v_set->>'target_zone', v_set->>'notes');
                END LOOP;
            END LOOP;
        END LOOP;
    END LOOP;

    RETURN v_program_id;
END;
$$;

GRANT EXECUTE ON FUNCTION public.save_assigned_program_tree(jsonb) TO authenticated;
