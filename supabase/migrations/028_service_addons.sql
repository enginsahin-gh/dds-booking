-- =============================================
-- Migration 028: Service tags + add-ons
-- =============================================

BEGIN;

ALTER TABLE services
  ADD COLUMN IF NOT EXISTS tags TEXT[] DEFAULT '{}';

CREATE TABLE IF NOT EXISTS service_addons (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  salon_id UUID NOT NULL REFERENCES salons(id) ON DELETE CASCADE,
  service_id UUID NOT NULL REFERENCES services(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  price_cents INTEGER NOT NULL DEFAULT 0,
  duration_min INTEGER NOT NULL DEFAULT 0,
  is_active BOOLEAN NOT NULL DEFAULT true,
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_service_addons_service_id ON service_addons(service_id);

ALTER TABLE service_addons ENABLE ROW LEVEL SECURITY;

-- Public read for active add-ons (widget)
DROP POLICY IF EXISTS "service_addons_select_public" ON service_addons;
CREATE POLICY "service_addons_select_public" ON service_addons
  FOR SELECT TO anon, authenticated
  USING (is_active = true);

-- Owner full access
DROP POLICY IF EXISTS "service_addons_all_owner" ON service_addons;
CREATE POLICY "service_addons_all_owner" ON service_addons
  FOR ALL TO authenticated
  USING (salon_id IN (SELECT id FROM salons WHERE owner_id = auth.uid()::text))
  WITH CHECK (salon_id IN (SELECT id FROM salons WHERE owner_id = auth.uid()::text));

COMMIT;
