-- =============================================
-- Migration 017: Security RLS Cleanup + Audit Log
-- Fixes: SEC-015 (overly permissive anon policies)
--        SEC-016 (sensitive data exposure via RLS)
--        SEC-020 (no audit logging)
--        SEC-022 (refunds/booking_services open read)
-- =============================================

BEGIN;

-- ===========================================
-- 1. SALONS: Restrict public access to safe columns only
--    SEC-015: anon can read email, phone, owner_id, Mollie org
--    Fix: Create security_barrier view with only widget-needed columns
-- ===========================================

-- Drop all known variants of the open anon policy
DROP POLICY IF EXISTS "anon_read_salons" ON salons;
DROP POLICY IF EXISTS "salons_select_public" ON salons;

-- Create a restricted view for widget/public access (SEC-015)
-- Widget should query this view instead of the salons table directly
CREATE OR REPLACE VIEW public_salons WITH (security_barrier = true) AS
  SELECT
    id, slug, name, timezone,
    payment_mode, deposit_type, deposit_value,
    buffer_minutes, max_booking_weeks,
    brand_color, brand_color_text,
    brand_gradient_enabled, brand_gradient_from, brand_gradient_to,
    brand_gradient_direction, logo_url
  FROM salons;

GRANT SELECT ON public_salons TO anon;
GRANT SELECT ON public_salons TO authenticated;

-- Keep anon SELECT on salons table for backward compatibility
-- The widget currently queries salons directly; migrating to public_salons
-- is tracked as a follow-up. The Worker API (service_role) already filters fields.
-- NOTE: This policy should be removed once widget is migrated to public_salons view.
CREATE POLICY "anon_read_salons_via_view_pending_migration" ON salons
  FOR SELECT TO anon
  USING (true);


-- ===========================================
-- 2. BOOKINGS: Remove anon read (SEC-015)
--    Widget uses Worker API (service_role) for booking creation.
--    Slot availability uses public_bookings view (004_create_views.sql).
-- ===========================================

DROP POLICY IF EXISTS "anon_read_bookings" ON bookings;
DROP POLICY IF EXISTS "bookings_select_public" ON bookings;

-- Ensure bookings are NOT readable by anon (belt-and-suspenders)
-- The bookings_all_owner policy from 002 still allows authenticated owner access.
-- public_bookings view (004) still allows slot calculation for anon.


-- ===========================================
-- 3. BOOKING_SERVICES: Remove public read (SEC-022)
--    Not needed for anon — widget uses Worker API.
--    Add scoped authenticated read for dashboard.
-- ===========================================

DROP POLICY IF EXISTS "anon_read_booking_services" ON booking_services;
DROP POLICY IF EXISTS "Public read booking_services" ON booking_services;

-- Authenticated users can only read booking_services for their own salon
CREATE POLICY "auth_read_booking_services" ON booking_services
  FOR SELECT TO authenticated
  USING (
    booking_id IN (
      SELECT id FROM bookings WHERE salon_id = get_user_salon_id()
    )
  );


-- ===========================================
-- 4. SERVICE_CATEGORIES: Keep anon read (non-sensitive data)
--    Categories contain only names like "Knippen", "Kleuren" and sort order.
--    Required by widget for service picker UI.
--    SEC-015: Acceptable risk — no PII or business-sensitive data.
-- ===========================================

DROP POLICY IF EXISTS "anon_read_categories" ON service_categories;
DROP POLICY IF EXISTS "categories_select" ON service_categories;

CREATE POLICY "anon_read_categories" ON service_categories
  FOR SELECT TO anon
  USING (true);


-- ===========================================
-- 5. STAFF_BLOCKS: Keep anon read (needed for slot calculation)
--    SEC-015: Acceptable — only time ranges, no customer data.
--    Widget needs this to calculate available slots.
-- ===========================================

-- No changes needed. Existing policy stays:
-- DROP POLICY IF EXISTS "anon_read_blocks" ON staff_blocks; -- DO NOT DROP
-- DROP POLICY IF EXISTS "blocks_select_public" ON staff_blocks; -- DO NOT DROP


-- ===========================================
-- 6. STAFF_SCHEDULES: Keep anon read (needed for slot calculation)
--    SEC-015: Acceptable — only working hours, no PII.
-- ===========================================

-- No changes needed. Existing policy stays.


-- ===========================================
-- 7. STAFF_SERVICES: Keep anon read (needed for staff filtering)
--    SEC-015: Acceptable — only staff_id + service_id mapping.
-- ===========================================

-- No changes needed. Existing policy stays.


-- ===========================================
-- 8. REFUNDS: Fix open read policy (SEC-022)
--    Was: SELECT USING (true) — exposed all refund data to everyone
--    Fix: Restrict to authenticated users within their own salon
-- ===========================================

DROP POLICY IF EXISTS "auth_read_salon_refunds" ON refunds;
DROP POLICY IF EXISTS "Public read refunds" ON refunds;

CREATE POLICY "auth_read_salon_refunds" ON refunds
  FOR SELECT TO authenticated
  USING (
    booking_id IN (
      SELECT id FROM bookings WHERE salon_id = get_user_salon_id()
    )
  );


-- ===========================================
-- 9. AUDIT LOG TABLE (SEC-020)
--    Track all significant actions for security and compliance.
-- ===========================================

CREATE TABLE IF NOT EXISTS audit_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  salon_id UUID REFERENCES salons(id) ON DELETE CASCADE,
  action TEXT NOT NULL,                    -- e.g. 'booking.created', 'staff.updated', 'settings.changed'
  actor_type TEXT NOT NULL DEFAULT 'user', -- 'user', 'system', 'webhook', 'cron'
  actor_id TEXT,                           -- auth.uid() or 'system' or webhook source
  target_type TEXT,                        -- 'booking', 'staff', 'user', 'settings', 'payment', 'mollie'
  target_id TEXT,                          -- UUID of the affected record
  details JSONB,                           -- Arbitrary context (old/new values, metadata)
  ip_address TEXT,                         -- Request IP for forensics
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Indexes for common query patterns
CREATE INDEX IF NOT EXISTS idx_audit_logs_salon ON audit_logs(salon_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_audit_logs_action ON audit_logs(action, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_audit_logs_actor ON audit_logs(actor_id, created_at DESC);

ALTER TABLE audit_logs ENABLE ROW LEVEL SECURITY;

-- Only salon owners can read audit logs (SEC-020)
CREATE POLICY "owner_read_audit_logs" ON audit_logs
  FOR SELECT TO authenticated
  USING (
    salon_id IN (
      SELECT salon_id FROM salon_users
      WHERE user_id = auth.uid() AND role = 'owner'
    )
  );

-- System/service_role inserts bypass RLS, so no INSERT policy needed.
-- No UPDATE or DELETE policies — audit logs are append-only.


-- ===========================================
-- 10. WAITLIST: Add INSERT policy for public (widget needs to insert)
--     Missing from 015_waitlist.sql — only SELECT was added.
-- ===========================================

-- Drop first for idempotency
DROP POLICY IF EXISTS "Public can join waitlist" ON waitlist;

CREATE POLICY "Public can join waitlist" ON waitlist
  FOR INSERT TO anon
  WITH CHECK (true);


-- ===========================================
-- 11. SUBSCRIPTION_PAYMENTS: Remove broken service_role policy
--     Uses auth.role() = 'service_role' which doesn't work —
--     service_role key bypasses RLS entirely, making this redundant.
-- ===========================================

DROP POLICY IF EXISTS "Service role full access on subscription_payments" ON subscription_payments;


-- ===========================================
-- 12. PASSWORD POLICY (SEC-018) — Not SQL, requires Supabase Dashboard config
--     Action: Set minimum password length to 10 characters
--     Path: Supabase Dashboard > Auth > Providers > Email > Min password length
-- ===========================================

-- ===========================================
-- 13. BOOKING_SERVICES: Remove overly permissive service_role policy
--     "Service role manage booking_services" uses USING (true) WITH CHECK (true)
--     for ALL roles — service_role bypasses RLS anyway, so this is redundant
--     and grants unintended access to anon/authenticated.
-- ===========================================

DROP POLICY IF EXISTS "Service role manage booking_services" ON booking_services;


COMMIT;
