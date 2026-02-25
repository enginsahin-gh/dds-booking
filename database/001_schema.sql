-- ============================================
-- DDS Booking System — Full Database Schema
-- Project: dds-booking (ipksrcuipodqksdqyekl)
-- ============================================

-- Salons
CREATE TABLE salons (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  slug text UNIQUE NOT NULL,
  name text NOT NULL,
  email text NOT NULL,
  phone text,
  owner_id text,
  timezone text DEFAULT 'Europe/Amsterdam',
  created_at timestamptz DEFAULT now()
);

-- Staff
CREATE TABLE staff (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  salon_id uuid REFERENCES salons(id) ON DELETE CASCADE,
  name text NOT NULL,
  photo_url text,
  is_active boolean DEFAULT true,
  sort_order int DEFAULT 0,
  created_at timestamptz DEFAULT now()
);

-- Staff schedules (weekly recurring)
CREATE TABLE staff_schedules (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  staff_id uuid REFERENCES staff(id) ON DELETE CASCADE,
  day_of_week int NOT NULL CHECK (day_of_week >= 0 AND day_of_week <= 6), -- 0=ma, 6=zo
  start_time time NOT NULL,
  end_time time NOT NULL,
  is_working boolean DEFAULT true
);

-- Staff blocks (vakantie, ziek, etc)
CREATE TABLE staff_blocks (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  staff_id uuid REFERENCES staff(id) ON DELETE CASCADE,
  start_at timestamptz NOT NULL,
  end_at timestamptz NOT NULL,
  reason text,
  created_at timestamptz DEFAULT now()
);

-- Services
CREATE TABLE services (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  salon_id uuid REFERENCES salons(id) ON DELETE CASCADE,
  name text NOT NULL,
  category text,
  duration_min int NOT NULL,
  price_cents int NOT NULL,
  is_active boolean DEFAULT true,
  sort_order int DEFAULT 0,
  created_at timestamptz DEFAULT now()
);

-- Bookings
CREATE TABLE bookings (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  salon_id uuid REFERENCES salons(id) ON DELETE CASCADE,
  service_id uuid REFERENCES services(id),
  staff_id uuid REFERENCES staff(id),
  start_at timestamptz NOT NULL,
  end_at timestamptz NOT NULL,
  customer_name text NOT NULL,
  customer_email text NOT NULL,
  customer_phone text,
  status text DEFAULT 'confirmed' CHECK (status IN ('confirmed', 'cancelled', 'pending_payment')),
  payment_status text DEFAULT 'none' CHECK (payment_status IN ('none', 'pending', 'paid', 'failed')),
  deposit_amount decimal(10,2),
  cancelled_at timestamptz,
  created_at timestamptz DEFAULT now()
);

-- Public bookings view (only staff_id + times, for availability check)
CREATE OR REPLACE VIEW public_bookings AS
SELECT staff_id, start_at, end_at
FROM bookings
WHERE status != 'cancelled';

-- Payments (Mollie)
CREATE TABLE payments (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  booking_id uuid REFERENCES bookings(id) ON DELETE CASCADE,
  mollie_payment_id text UNIQUE NOT NULL,
  amount decimal(10,2) NOT NULL,
  currency text DEFAULT 'EUR',
  status text DEFAULT 'open' CHECK (status IN ('open', 'paid', 'failed', 'expired', 'canceled')),
  method text,
  description text,
  metadata jsonb DEFAULT '{}'::jsonb,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  paid_at timestamptz
);

-- ============================================
-- Row Level Security
-- ============================================
ALTER TABLE salons ENABLE ROW LEVEL SECURITY;
ALTER TABLE staff ENABLE ROW LEVEL SECURITY;
ALTER TABLE staff_schedules ENABLE ROW LEVEL SECURITY;
ALTER TABLE staff_blocks ENABLE ROW LEVEL SECURITY;
ALTER TABLE services ENABLE ROW LEVEL SECURITY;
ALTER TABLE bookings ENABLE ROW LEVEL SECURITY;
ALTER TABLE payments ENABLE ROW LEVEL SECURITY;

-- Public read policies (for booking widget)
CREATE POLICY "Public read salons" ON salons FOR SELECT USING (true);
CREATE POLICY "Public read staff" ON staff FOR SELECT USING (is_active = true);
CREATE POLICY "Public read schedules" ON staff_schedules FOR SELECT USING (true);
CREATE POLICY "Public read blocks" ON staff_blocks FOR SELECT USING (true);
CREATE POLICY "Public read services" ON services FOR SELECT USING (is_active = true);
CREATE POLICY "Public read payments" ON payments FOR SELECT USING (true);

-- Public insert for bookings (customers can book)
CREATE POLICY "Public insert bookings" ON bookings FOR INSERT WITH CHECK (true);
CREATE POLICY "Public read own bookings" ON bookings FOR SELECT USING (true);

-- Service role has full access by default

-- ============================================
-- Indexes
-- ============================================
CREATE INDEX idx_staff_salon ON staff(salon_id, sort_order);
CREATE INDEX idx_schedules_staff ON staff_schedules(staff_id, day_of_week);
CREATE INDEX idx_blocks_staff ON staff_blocks(staff_id, start_at, end_at);
CREATE INDEX idx_services_salon ON services(salon_id, sort_order);
CREATE INDEX idx_bookings_salon ON bookings(salon_id, start_at);
CREATE INDEX idx_bookings_staff ON bookings(staff_id, start_at);
CREATE INDEX idx_payments_booking ON payments(booking_id);
CREATE INDEX idx_payments_mollie ON payments(mollie_payment_id);
CREATE INDEX idx_salons_slug ON salons(slug);
