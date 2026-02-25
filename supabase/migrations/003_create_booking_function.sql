-- Atomic booking creation with conflict detection, rate limiting, and input validation
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
  -- Server-side honeypot check (SEC: bots fill this field)
  IF p_hp IS NOT NULL AND p_hp <> '' THEN
    RAISE EXCEPTION 'SPAM_DETECTED';
  END IF;

  -- Input validation (SEC-011)
  IF length(trim(p_name)) < 2 THEN
    RAISE EXCEPTION 'INVALID_NAME';
  END IF;
  IF length(p_name) > 200 THEN
    RAISE EXCEPTION 'INVALID_NAME';
  END IF;
  IF p_email !~* '^[^@\s]+@[^@\s]+\.[^@\s]+$' THEN
    RAISE EXCEPTION 'INVALID_EMAIL';
  END IF;
  IF length(trim(p_phone)) < 7 OR length(p_phone) > 30 THEN
    RAISE EXCEPTION 'INVALID_PHONE';
  END IF;

  -- Lock: prevent concurrent inserts for the same staff member
  PERFORM pg_advisory_xact_lock(hashtext(p_staff_id::text));

  -- Rate limiting: max 5 bookings per email per hour
  SELECT count(*) INTO v_rate_count
  FROM bookings
  WHERE customer_email = p_email
    AND created_at > now() - interval '1 hour';

  IF v_rate_count >= 5 THEN
    RAISE EXCEPTION 'RATE_LIMITED';
  END IF;

  -- Check for slot conflicts
  SELECT count(*) INTO v_conflict_count
  FROM bookings
  WHERE staff_id = p_staff_id
    AND status = 'confirmed'
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
