-- 005: Multi-service bookings + Staff-service assignments

-- Junction table: which services are included in a booking
CREATE TABLE IF NOT EXISTS booking_services (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  booking_id uuid NOT NULL REFERENCES bookings(id) ON DELETE CASCADE,
  service_id uuid NOT NULL REFERENCES services(id),
  price_cents integer NOT NULL DEFAULT 0,
  duration_min integer NOT NULL DEFAULT 0,
  sort_order integer NOT NULL DEFAULT 0,
  created_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_booking_services_booking ON booking_services(booking_id);

-- Enable RLS
ALTER TABLE booking_services ENABLE ROW LEVEL SECURITY;

-- RLS policies (same access as bookings)
CREATE POLICY booking_services_select ON booking_services FOR SELECT USING (true);
CREATE POLICY booking_services_insert ON booking_services FOR INSERT WITH CHECK (true);

-- Junction table: which services a staff member can perform
CREATE TABLE IF NOT EXISTS staff_services (
  staff_id uuid NOT NULL REFERENCES staff(id) ON DELETE CASCADE,
  service_id uuid NOT NULL REFERENCES services(id) ON DELETE CASCADE,
  PRIMARY KEY (staff_id, service_id)
);

ALTER TABLE staff_services ENABLE ROW LEVEL SECURITY;
CREATE POLICY staff_services_select ON staff_services FOR SELECT USING (true);
CREATE POLICY staff_services_all ON staff_services FOR ALL USING (true) WITH CHECK (true);

-- Add all_services flag to staff (default true for backward compatibility)
ALTER TABLE staff ADD COLUMN IF NOT EXISTS all_services boolean NOT NULL DEFAULT true;

-- Add amount tracking to bookings
ALTER TABLE bookings
  ADD COLUMN IF NOT EXISTS amount_total_cents integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS amount_paid_cents integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS amount_due_cents integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS cancel_token text,
  ADD COLUMN IF NOT EXISTS cancelled_at timestamptz,
  ADD COLUMN IF NOT EXISTS reminder_24h_sent_at timestamptz,
  ADD COLUMN IF NOT EXISTS reminder_1h_sent_at timestamptz,
  ADD COLUMN IF NOT EXISTS review_request_sent_at timestamptz;
