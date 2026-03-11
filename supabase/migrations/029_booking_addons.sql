-- =============================================
-- Migration 029: Booking add-ons
-- =============================================

BEGIN;

CREATE TABLE IF NOT EXISTS booking_addons (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  booking_id UUID NOT NULL REFERENCES bookings(id) ON DELETE CASCADE,
  addon_id UUID REFERENCES service_addons(id) ON DELETE SET NULL,
  name TEXT NOT NULL,
  price_cents INTEGER NOT NULL DEFAULT 0,
  duration_min INTEGER NOT NULL DEFAULT 0,
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_booking_addons_booking_id ON booking_addons(booking_id);

ALTER TABLE booking_addons ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "booking_addons_all_owner" ON booking_addons;
CREATE POLICY "booking_addons_all_owner" ON booking_addons
  FOR SELECT TO authenticated
  USING (
    booking_id IN (SELECT id FROM bookings WHERE salon_id = get_user_salon_id())
  );

DROP POLICY IF EXISTS "booking_addons_service_role" ON booking_addons;
CREATE POLICY "booking_addons_service_role" ON booking_addons
  FOR ALL
  USING (auth.role() = 'service_role')
  WITH CHECK (auth.role() = 'service_role');

COMMIT;
