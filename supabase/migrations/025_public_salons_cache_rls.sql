-- =============================================
-- Migration 025: Allow owner-triggered sync on public_salons_cache
-- =============================================

BEGIN;

-- Ensure RLS enabled (idempotent)
ALTER TABLE public_salons_cache ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "auth_insert_public_salons_cache" ON public_salons_cache;
CREATE POLICY "auth_insert_public_salons_cache" ON public_salons_cache
  FOR INSERT TO authenticated
  WITH CHECK (id = get_user_salon_id() AND is_salon_owner());

DROP POLICY IF EXISTS "auth_update_public_salons_cache" ON public_salons_cache;
CREATE POLICY "auth_update_public_salons_cache" ON public_salons_cache
  FOR UPDATE TO authenticated
  USING (id = get_user_salon_id() AND is_salon_owner())
  WITH CHECK (id = get_user_salon_id() AND is_salon_owner());

DROP POLICY IF EXISTS "auth_delete_public_salons_cache" ON public_salons_cache;
CREATE POLICY "auth_delete_public_salons_cache" ON public_salons_cache
  FOR DELETE TO authenticated
  USING (id = get_user_salon_id() AND is_salon_owner());

COMMIT;
