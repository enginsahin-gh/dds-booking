-- ============================================
-- 005: Multi-service bookings (booking_services table)
--      + RPC fix for pending_payment conflict check
-- ============================================

-- Junction table for multi-service bookings
CREATE TABLE IF NOT EXISTS booking_services (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  booking_id uuid NOT NULL REFERENCES bookings(id) ON DELETE CASCADE,
  service_id uuid NOT NULL REFERENCES services(id),
  price_cents int NOT NULL,
  duration_min int NOT NULL,
  sort_order int NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_booking_services_booking ON booking_services(booking_id);
CREATE INDEX IF NOT EXISTS idx_booking_services_service ON booking_services(service_id);

-- RLS
ALTER TABLE booking_services ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Public read booking_services" ON booking_services
  FOR SELECT USING (true);

CREATE POLICY "Service role manage booking_services" ON booking_services
  FOR ALL USING (true) WITH CHECK (true);

-- Ensure notes column exists (used as display cache for multi-service names)
ALTER TABLE bookings ADD COLUMN IF NOT EXISTS notes text;

-- Ensure cancel_token column exists
ALTER TABLE bookings ADD COLUMN IF NOT EXISTS cancel_token text;
CREATE INDEX IF NOT EXISTS idx_bookings_cancel_token ON bookings(cancel_token) WHERE cancel_token IS NOT NULL;

-- Ensure buffer_minutes on salons
ALTER TABLE salons ADD COLUMN IF NOT EXISTS buffer_minutes int NOT NULL DEFAULT 0;

-- Fix create_booking RPC: include pending_payment in conflict check
CREATE OR REPLACE FUNCTION create_booking(
  p_salon_id uuid,
  p_service_id uuid,
  p_staff_id uuid,
  p_start_at timestamptz,
  p_end_at timestamptz,
  p_name text,
  p_email text,
  p_phone text,
  p_hp text DEFAULT ''
) RETURNS uuid AS $$
DECLARE
  v_conflict_count integer;
  v_rate_count integer;
  v_booking_id uuid;
BEGIN
  -- Honeypot
  IF p_hp IS NOT NULL AND p_hp <> '' THEN
    RAISE EXCEPTION 'SPAM_DETECTED';
  END IF;

  -- Input validation
  IF length(trim(p_name)) < 2 OR length(p_name) > 200 THEN
    RAISE EXCEPTION 'INVALID_NAME';
  END IF;
  IF p_email !~* '^[^@\s]+@[^@\s]+\.[^@\s]+$' THEN
    RAISE EXCEPTION 'INVALID_EMAIL';
  END IF;
  IF length(trim(p_phone)) < 7 OR length(p_phone) > 30 THEN
    RAISE EXCEPTION 'INVALID_PHONE';
  END IF;

  -- Lock staff member to prevent concurrent inserts
  PERFORM pg_advisory_xact_lock(hashtext(p_staff_id::text));

  -- Rate limiting: max 5 bookings per email per hour
  SELECT count(*) INTO v_rate_count
  FROM bookings
  WHERE customer_email = p_email
    AND created_at > now() - interval '1 hour';

  IF v_rate_count >= 5 THEN
    RAISE EXCEPTION 'RATE_LIMITED';
  END IF;

  -- Check for slot conflicts (including pending_payment!)
  SELECT count(*) INTO v_conflict_count
  FROM bookings
  WHERE staff_id = p_staff_id
    AND status IN ('confirmed', 'pending_payment')
    AND start_at < p_end_at
    AND end_at > p_start_at;

  IF v_conflict_count > 0 THEN
    RAISE EXCEPTION 'SLOT_TAKEN';
  END IF;

  INSERT INTO bookings (salon_id, service_id, staff_id, start_at, end_at,
    customer_name, customer_email, customer_phone)
  VALUES (p_salon_id, p_service_id, p_staff_id, p_start_at, p_end_at,
    p_name, p_email, p_phone)
  RETURNING id INTO v_booking_id;

  RETURN v_booking_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
