-- =====================================================
-- Migration 041: agenda a validação diária de indicações
-- =====================================================
-- A função validate_referrals() existe desde a migration 002 e deveria rodar
-- diariamente ("Should be called daily via CRON"), mas nunca foi agendada.
-- Resultado: students.referral_validated_at nunca era preenchido, então as
-- indicações ficavam eternamente "aguardando validação" e nenhuma contava para
-- a meta do treinador (nem para o bônus).
--
-- Esta migration:
--   1. Agenda validate_referrals() para rodar todo dia às 02:00 via pg_cron
--      (pg_cron já foi habilitado na migration 039).
--   2. Roda a validação uma vez agora para quitar o backlog acumulado
--      (indicações que já passaram dos N dias ativos são validadas na hora).
-- Idempotente: pode rodar de novo sem efeito colateral.

-- --------------------------------------------
-- 1. Agenda o job diário (resiliente se pg_cron não existir).
-- --------------------------------------------
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'pg_cron') THEN
        IF EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'validate-referrals') THEN
            PERFORM cron.unschedule('validate-referrals');
        END IF;
        PERFORM cron.schedule(
            'validate-referrals',
            '0 2 * * *',
            $cron$SELECT public.validate_referrals();$cron$
        );
    ELSE
        RAISE NOTICE 'pg_cron indisponível: agende validate_referrals() externamente (ex.: cron do Next.js).';
    END IF;
END $$;

-- --------------------------------------------
-- 2. Quita o backlog imediatamente.
-- --------------------------------------------
SELECT public.validate_referrals();
