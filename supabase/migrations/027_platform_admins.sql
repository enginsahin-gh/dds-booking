-- =============================================
-- Migration 027: Platform admins table
-- =============================================

BEGIN;

CREATE TABLE IF NOT EXISTS platform_admins (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL UNIQUE,
  created_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE platform_admins ENABLE ROW LEVEL SECURITY;

-- Platform admin can read own record (optional, for future use)
DROP POLICY IF EXISTS "platform_admins_self_read" ON platform_admins;
CREATE POLICY "platform_admins_self_read" ON platform_admins
  FOR SELECT TO authenticated
  USING (user_id = auth.uid());

-- Service role full access
DROP POLICY IF EXISTS "platform_admins_service_role" ON platform_admins;
CREATE POLICY "platform_admins_service_role" ON platform_admins
  FOR ALL
  USING (auth.role() = 'service_role')
  WITH CHECK (auth.role() = 'service_role');

COMMIT;
