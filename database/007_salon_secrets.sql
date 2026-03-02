-- ============================================
-- 007: Salon Secrets — Mollie tokens beveiligen
-- Sensitive data moved from public `salons` to `salon_secrets`
-- salon_secrets has RLS enabled with NO policies = only service_role access
-- ============================================

-- Secrets table (only accessible via service_role key)
CREATE TABLE IF NOT EXISTS salon_secrets (
  salon_id uuid PRIMARY KEY REFERENCES salons(id) ON DELETE CASCADE,
  mollie_api_key text,
  mollie_access_token text,
  mollie_refresh_token text,
  mollie_connected_at timestamptz,
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE salon_secrets ENABLE ROW LEVEL SECURITY;
-- NO policies = only service_role can read/write

-- Migrate existing tokens
INSERT INTO salon_secrets (salon_id, mollie_access_token, mollie_refresh_token, mollie_connected_at)
SELECT id, mollie_access_token, mollie_refresh_token, mollie_connected_at
FROM salons
WHERE mollie_access_token IS NOT NULL
ON CONFLICT (salon_id) DO NOTHING;

-- Remove sensitive columns from salons
ALTER TABLE salons DROP COLUMN IF EXISTS mollie_access_token;
ALTER TABLE salons DROP COLUMN IF EXISTS mollie_refresh_token;
ALTER TABLE salons DROP COLUMN IF EXISTS mollie_api_key;

-- Keep mollie_connected_at on salons as non-sensitive display field
-- (re-add if it was dropped)
ALTER TABLE salons ADD COLUMN IF NOT EXISTS mollie_connected_at timestamptz;

-- Sync connected_at from secrets
UPDATE salons SET mollie_connected_at = ss.mollie_connected_at
FROM salon_secrets ss WHERE salons.id = ss.salon_id AND ss.mollie_connected_at IS NOT NULL;
