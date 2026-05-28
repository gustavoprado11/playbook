-- ============================================
-- Migration 032: REVOKE EXECUTE nas funções internas da Fase 3
-- Mesma postura da migration 026: funções de trigger e helpers internos
-- não devem ser chamáveis via RPC (PostgREST). Triggers disparam
-- independentemente do grant de EXECUTE.
-- attends_student() NÃO é revogada: é usada dentro de policies RLS.
-- ============================================

REVOKE EXECUTE ON FUNCTION public.notify_referral_created() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.notify_referral_status() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.notify_referral_replied() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.notify_clearance_issued() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.profile_of_professional(uuid) FROM PUBLIC, anon, authenticated;
