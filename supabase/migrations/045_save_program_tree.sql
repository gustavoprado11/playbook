-- ============================================
-- 045 — RPC save_program_tree (A2: builder de sessão)
-- ============================================
-- Grava a árvore inteira de um PROGRAMA-TEMPLATE (program -> sessions -> blocks
-- -> items -> sets) numa única transação.
--
-- Design:
--   SECURITY INVOKER  -> a RLS do 043 (author-owned) é enforced em cada write.
--   search_path = ''  -> tudo qualificado (public.*, auth.uid()).
--   Guarda explícita de posse no upsert do programa (erro limpo, não 0-rows silencioso).
--   Delete-recreate dos filhos: seguro p/ TEMPLATE (nada externo referencia os ids;
--   o A3 usará snapshots, não FK). Programa é upsert-by-id.
--   Falha em qualquer ponto -> rollback total (corpo transacional da função).
--
-- %1RM e VBT/Output (load_pct_1rm, target_velocity_ms, velocity_loss_pct) ficam
-- FORA do INSERT de propósito: colunas seguem NULL (vetor VBT é Parte C).

CREATE OR REPLACE FUNCTION public.save_program_tree(payload jsonb)
RETURNS uuid
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = ''
AS $$
DECLARE
    v_uid uuid := auth.uid();
    v_program_id uuid := NULLIF(payload->>'id','')::uuid;
    v_session jsonb; v_block jsonb; v_item jsonb; v_set jsonb;
    v_session_id uuid; v_block_id uuid; v_item_id uuid;
BEGIN
    IF v_uid IS NULL THEN RAISE EXCEPTION 'Unauthorized'; END IF;

    IF NULLIF(payload->>'name','') IS NULL THEN
        RAISE EXCEPTION 'Program name is required';
    END IF;

    IF v_program_id IS NOT NULL THEN
        IF NOT EXISTS (SELECT 1 FROM public.program_templates
                       WHERE id = v_program_id AND (created_by = v_uid OR public.is_manager())) THEN
            RAISE EXCEPTION 'Program not found or not owned';
        END IF;
        UPDATE public.program_templates
           SET name = payload->>'name', description = payload->>'description',
               goal = payload->>'goal', updated_at = now()
         WHERE id = v_program_id;
    ELSE
        INSERT INTO public.program_templates (name, description, goal, created_by)
        VALUES (payload->>'name', payload->>'description', payload->>'goal', v_uid)
        RETURNING id INTO v_program_id;
    END IF;

    -- Substitui filhos (CASCADE apaga blocks/items/sets)
    DELETE FROM public.session_templates WHERE program_template_id = v_program_id;

    FOR v_session IN SELECT jsonb_array_elements(COALESCE(payload->'sessions','[]'::jsonb)) LOOP
        INSERT INTO public.session_templates (program_template_id, name, order_index, scheduled_days, notes)
        VALUES (v_program_id, v_session->>'name',
                COALESCE((v_session->>'order_index')::int,0),
                COALESCE(ARRAY(SELECT (d)::int FROM jsonb_array_elements_text(COALESCE(v_session->'scheduled_days','[]'::jsonb)) d), '{}'),
                v_session->>'notes')
        RETURNING id INTO v_session_id;

        FOR v_block IN SELECT jsonb_array_elements(COALESCE(v_session->'blocks','[]'::jsonb)) LOOP
            INSERT INTO public.block_templates (session_template_id, phase, category_key, order_index, label, notes)
            VALUES (v_session_id, v_block->>'phase', v_block->>'category_key',
                    COALESCE((v_block->>'order_index')::int,0), v_block->>'label', v_block->>'notes')
            RETURNING id INTO v_block_id;

            FOR v_item IN SELECT jsonb_array_elements(COALESCE(v_block->'items','[]'::jsonb)) LOOP
                INSERT INTO public.item_templates (block_template_id, exercise_id, custom_name, group_label, order_index, method_key, rounds, notes)
                VALUES (v_block_id, NULLIF(v_item->>'exercise_id','')::uuid, v_item->>'custom_name',
                        v_item->>'group_label', COALESCE((v_item->>'order_index')::int,0),
                        NULLIF(v_item->>'method_key',''), NULLIF(v_item->>'rounds','')::int, v_item->>'notes')
                RETURNING id INTO v_item_id;

                FOR v_set IN SELECT jsonb_array_elements(COALESCE(v_item->'sets','[]'::jsonb)) LOOP
                    INSERT INTO public.set_templates
                        (item_template_id, set_number, set_type, reps, reps_max, each_side, load_kg,
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

GRANT EXECUTE ON FUNCTION public.save_program_tree(jsonb) TO authenticated;
