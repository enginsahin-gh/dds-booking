-- =============================================
-- Migration 022: Supabase Lint Fixes (Views + RLS)
-- =============================================

BEGIN;

-- 1) Public bookings cache table (replace security definer view)
CREATE TABLE IF NOT EXISTS public_bookings_cache (
  booking_id UUID PRIMARY KEY REFERENCES bookings(id) ON DELETE CASCADE,
  staff_id UUID NOT NULL,
  start_at TIMESTAMPTZ NOT NULL,
  end_at TIMESTAMPTZ NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_public_bookings_cache_staff ON public_bookings_cache(staff_id, start_at);

ALTER TABLE public_bookings_cache ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "anon_read_public_bookings_cache" ON public_bookings_cache;
CREATE POLICY "anon_read_public_bookings_cache" ON public_bookings_cache
  FOR SELECT TO anon
  USING (true);

DROP POLICY IF EXISTS "auth_read_public_bookings_cache" ON public_bookings_cache;
CREATE POLICY "auth_read_public_bookings_cache" ON public_bookings_cache
  FOR SELECT TO authenticated
  USING (true);

GRANT SELECT ON public_bookings_cache TO anon, authenticated;

-- Backfill confirmed bookings
INSERT INTO public_bookings_cache (booking_id, staff_id, start_at, end_at)
SELECT id, staff_id, start_at, end_at
FROM bookings
WHERE status = 'confirmed'
ON CONFLICT (booking_id) DO UPDATE
SET staff_id = EXCLUDED.staff_id,
    start_at = EXCLUDED.start_at,
    end_at = EXCLUDED.end_at;

-- Sync function + triggers
CREATE OR REPLACE FUNCTION sync_public_bookings_cache()
RETURNS TRIGGER AS $$
BEGIN
  IF TG_OP = 'DELETE' THEN
    DELETE FROM public_bookings_cache WHERE booking_id = OLD.id;
    RETURN OLD;
  END IF;

  IF NEW.status = 'confirmed' THEN
    INSERT INTO public_bookings_cache (booking_id, staff_id, start_at, end_at)
    VALUES (NEW.id, NEW.staff_id, NEW.start_at, NEW.end_at)
    ON CONFLICT (booking_id) DO UPDATE
    SET staff_id = EXCLUDED.staff_id,
        start_at = EXCLUDED.start_at,
        end_at = EXCLUDED.end_at;
  ELSE
    DELETE FROM public_bookings_cache WHERE booking_id = NEW.id;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_public_bookings_cache_ins_upd ON bookings;
CREATE TRIGGER trg_public_bookings_cache_ins_upd
  AFTER INSERT OR UPDATE ON bookings
  FOR EACH ROW EXECUTE FUNCTION sync_public_bookings_cache();

DROP TRIGGER IF EXISTS trg_public_bookings_cache_del ON bookings;
CREATE TRIGGER trg_public_bookings_cache_del
  AFTER DELETE ON bookings
  FOR EACH ROW EXECUTE FUNCTION sync_public_bookings_cache();

-- Recreate public_bookings view without SECURITY DEFINER
DROP VIEW IF EXISTS public_bookings;
CREATE VIEW public_bookings AS
  SELECT staff_id, start_at, end_at
  FROM public_bookings_cache;

ALTER VIEW public_bookings SET (security_invoker = true);
GRANT SELECT ON public_bookings TO anon, authenticated;

-- 2) public_salons view (security invoker) + safe columns
DROP VIEW IF EXISTS public_salons;
CREATE VIEW public_salons WITH (security_barrier = true) AS
  SELECT
    id, slug, name, timezone,
    payment_mode, deposit_type, deposit_value,
    buffer_minutes, max_booking_weeks,
    brand_color, brand_color_text,
    brand_gradient_enabled, brand_gradient_from, brand_gradient_to,
    brand_gradient_direction, logo_url,
    address, city, postal_code, phone,
    location_info, cancellation_policy,
    reschedule_enabled, review_enabled, review_after_visit
  FROM salons;

ALTER VIEW public_salons SET (security_invoker = true);
GRANT SELECT ON public_salons TO anon, authenticated;

-- Remove old temporary anon policy now that widget uses public_salons
DROP POLICY IF EXISTS "anon_read_salons_via_view_pending_migration" ON salons;

-- 3) Leads table RLS enable + policy
ALTER TABLE leads ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS leads_insert ON leads;
CREATE POLICY leads_insert ON leads
  FOR INSERT TO anon, authenticated
  WITH CHECK (true);

GRANT INSERT ON leads TO anon, authenticated;

COMMIT;
