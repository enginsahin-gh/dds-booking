-- ============================================
-- 006: Mollie Connect OAuth columns on salons
-- ============================================

ALTER TABLE salons ADD COLUMN IF NOT EXISTS mollie_access_token text;
ALTER TABLE salons ADD COLUMN IF NOT EXISTS mollie_refresh_token text;
ALTER TABLE salons ADD COLUMN IF NOT EXISTS mollie_profile_id text;
ALTER TABLE salons ADD COLUMN IF NOT EXISTS mollie_organization_id text;
ALTER TABLE salons ADD COLUMN IF NOT EXISTS mollie_connected_at timestamptz;
