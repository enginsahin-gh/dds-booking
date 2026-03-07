-- =============================================
-- Migration 023: Public salons cache (anon-safe)
-- =============================================

BEGIN;

-- 1) Cache table with safe columns only
CREATE TABLE IF NOT EXISTS public_salons_cache (
  id UUID PRIMARY KEY,
  slug TEXT UNIQUE NOT NULL,
  name TEXT,
  timezone TEXT,
  payment_mode TEXT,
  deposit_type TEXT,
  deposit_value NUMERIC,
  buffer_minutes INTEGER,
  max_booking_weeks INTEGER,
  brand_color TEXT,
  brand_color_text TEXT,
  brand_gradient_enabled BOOLEAN,
  brand_gradient_from TEXT,
  brand_gradient_to TEXT,
  brand_gradient_direction TEXT,
  logo_url TEXT,
  address TEXT,
  city TEXT,
  postal_code TEXT,
  phone TEXT,
  location_info TEXT,
  cancellation_policy TEXT,
  reschedule_enabled BOOLEAN,
  review_enabled BOOLEAN,
  review_after_visit INTEGER
);

CREATE INDEX IF NOT EXISTS idx_public_salons_cache_slug ON public_salons_cache(slug);

ALTER TABLE public_salons_cache ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "anon_read_public_salons_cache" ON public_salons_cache;
CREATE POLICY "anon_read_public_salons_cache" ON public_salons_cache
  FOR SELECT TO anon
  USING (true);

DROP POLICY IF EXISTS "auth_read_public_salons_cache" ON public_salons_cache;
CREATE POLICY "auth_read_public_salons_cache" ON public_salons_cache
  FOR SELECT TO authenticated
  USING (true);

GRANT SELECT ON public_salons_cache TO anon, authenticated;

-- 2) Backfill from salons
INSERT INTO public_salons_cache (
  id, slug, name, timezone,
  payment_mode, deposit_type, deposit_value,
  buffer_minutes, max_booking_weeks,
  brand_color, brand_color_text,
  brand_gradient_enabled, brand_gradient_from, brand_gradient_to, brand_gradient_direction,
  logo_url, address, city, postal_code, phone,
  location_info, cancellation_policy,
  reschedule_enabled, review_enabled, review_after_visit
)
SELECT
  id, slug, name, timezone,
  payment_mode, deposit_type, deposit_value,
  buffer_minutes, max_booking_weeks,
  brand_color, brand_color_text,
  brand_gradient_enabled, brand_gradient_from, brand_gradient_to, brand_gradient_direction,
  logo_url, address, city, postal_code, phone,
  location_info, cancellation_policy,
  reschedule_enabled, review_enabled, review_after_visit
FROM salons
ON CONFLICT (id) DO UPDATE
SET
  slug = EXCLUDED.slug,
  name = EXCLUDED.name,
  timezone = EXCLUDED.timezone,
  payment_mode = EXCLUDED.payment_mode,
  deposit_type = EXCLUDED.deposit_type,
  deposit_value = EXCLUDED.deposit_value,
  buffer_minutes = EXCLUDED.buffer_minutes,
  max_booking_weeks = EXCLUDED.max_booking_weeks,
  brand_color = EXCLUDED.brand_color,
  brand_color_text = EXCLUDED.brand_color_text,
  brand_gradient_enabled = EXCLUDED.brand_gradient_enabled,
  brand_gradient_from = EXCLUDED.brand_gradient_from,
  brand_gradient_to = EXCLUDED.brand_gradient_to,
  brand_gradient_direction = EXCLUDED.brand_gradient_direction,
  logo_url = EXCLUDED.logo_url,
  address = EXCLUDED.address,
  city = EXCLUDED.city,
  postal_code = EXCLUDED.postal_code,
  phone = EXCLUDED.phone,
  location_info = EXCLUDED.location_info,
  cancellation_policy = EXCLUDED.cancellation_policy,
  reschedule_enabled = EXCLUDED.reschedule_enabled,
  review_enabled = EXCLUDED.review_enabled,
  review_after_visit = EXCLUDED.review_after_visit;

-- 3) Sync trigger
CREATE OR REPLACE FUNCTION sync_public_salons_cache()
RETURNS TRIGGER AS $$
BEGIN
  IF TG_OP = 'DELETE' THEN
    DELETE FROM public_salons_cache WHERE id = OLD.id;
    RETURN OLD;
  END IF;

  INSERT INTO public_salons_cache (
    id, slug, name, timezone,
    payment_mode, deposit_type, deposit_value,
    buffer_minutes, max_booking_weeks,
    brand_color, brand_color_text,
    brand_gradient_enabled, brand_gradient_from, brand_gradient_to, brand_gradient_direction,
    logo_url, address, city, postal_code, phone,
    location_info, cancellation_policy,
    reschedule_enabled, review_enabled, review_after_visit
  ) VALUES (
    NEW.id, NEW.slug, NEW.name, NEW.timezone,
    NEW.payment_mode, NEW.deposit_type, NEW.deposit_value,
    NEW.buffer_minutes, NEW.max_booking_weeks,
    NEW.brand_color, NEW.brand_color_text,
    NEW.brand_gradient_enabled, NEW.brand_gradient_from, NEW.brand_gradient_to, NEW.brand_gradient_direction,
    NEW.logo_url, NEW.address, NEW.city, NEW.postal_code, NEW.phone,
    NEW.location_info, NEW.cancellation_policy,
    NEW.reschedule_enabled, NEW.review_enabled, NEW.review_after_visit
  )
  ON CONFLICT (id) DO UPDATE
  SET
    slug = EXCLUDED.slug,
    name = EXCLUDED.name,
    timezone = EXCLUDED.timezone,
    payment_mode = EXCLUDED.payment_mode,
    deposit_type = EXCLUDED.deposit_type,
    deposit_value = EXCLUDED.deposit_value,
    buffer_minutes = EXCLUDED.buffer_minutes,
    max_booking_weeks = EXCLUDED.max_booking_weeks,
    brand_color = EXCLUDED.brand_color,
    brand_color_text = EXCLUDED.brand_color_text,
    brand_gradient_enabled = EXCLUDED.brand_gradient_enabled,
    brand_gradient_from = EXCLUDED.brand_gradient_from,
    brand_gradient_to = EXCLUDED.brand_gradient_to,
    brand_gradient_direction = EXCLUDED.brand_gradient_direction,
    logo_url = EXCLUDED.logo_url,
    address = EXCLUDED.address,
    city = EXCLUDED.city,
    postal_code = EXCLUDED.postal_code,
    phone = EXCLUDED.phone,
    location_info = EXCLUDED.location_info,
    cancellation_policy = EXCLUDED.cancellation_policy,
    reschedule_enabled = EXCLUDED.reschedule_enabled,
    review_enabled = EXCLUDED.review_enabled,
    review_after_visit = EXCLUDED.review_after_visit;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_public_salons_cache_ins_upd ON salons;
CREATE TRIGGER trg_public_salons_cache_ins_upd
  AFTER INSERT OR UPDATE ON salons
  FOR EACH ROW EXECUTE FUNCTION sync_public_salons_cache();

DROP TRIGGER IF EXISTS trg_public_salons_cache_del ON salons;
CREATE TRIGGER trg_public_salons_cache_del
  AFTER DELETE ON salons
  FOR EACH ROW EXECUTE FUNCTION sync_public_salons_cache();

-- 4) Public view from cache (lint-clean)
DROP VIEW IF EXISTS public_salons;
CREATE VIEW public_salons AS
  SELECT *
  FROM public_salons_cache;

ALTER VIEW public_salons SET (security_invoker = true);
GRANT SELECT ON public_salons TO anon, authenticated;

COMMIT;
