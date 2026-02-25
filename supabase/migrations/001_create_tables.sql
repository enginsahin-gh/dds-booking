-- Salons
CREATE TABLE salons (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  slug text UNIQUE NOT NULL,
  name text NOT NULL,
  email text NOT NULL,
  phone text,
  owner_id uuid NOT NULL REFERENCES auth.users(id),
  timezone text NOT NULL DEFAULT 'Europe/Amsterdam',
  created_at timestamptz DEFAULT now()
);

CREATE INDEX idx_salons_slug ON salons(slug);
CREATE INDEX idx_salons_owner ON salons(owner_id);

-- Staff
CREATE TABLE staff (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  salon_id uuid NOT NULL REFERENCES salons(id) ON DELETE CASCADE,
  name text NOT NULL,
  photo_url text,
  is_active boolean DEFAULT true,
  sort_order integer DEFAULT 0,
  created_at timestamptz DEFAULT now()
);

CREATE INDEX idx_staff_salon ON staff(salon_id);

-- Staff schedules
CREATE TABLE staff_schedules (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  staff_id uuid NOT NULL REFERENCES staff(id) ON DELETE CASCADE,
  day_of_week smallint NOT NULL CHECK (day_of_week BETWEEN 0 AND 6),
  start_time time NOT NULL,
  end_time time NOT NULL,
  is_working boolean DEFAULT true,
  UNIQUE(staff_id, day_of_week)
);

CREATE INDEX idx_schedule_staff ON staff_schedules(staff_id);

-- Staff blocks
CREATE TABLE staff_blocks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  staff_id uuid NOT NULL REFERENCES staff(id) ON DELETE CASCADE,
  start_at timestamptz NOT NULL,
  end_at timestamptz NOT NULL,
  reason text,
  created_at timestamptz DEFAULT now()
);

CREATE INDEX idx_blocks_staff_time ON staff_blocks(staff_id, start_at, end_at);

-- Services
CREATE TABLE services (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  salon_id uuid NOT NULL REFERENCES salons(id) ON DELETE CASCADE,
  name text NOT NULL,
  duration_min integer NOT NULL CHECK (duration_min > 0),
  price_cents integer NOT NULL CHECK (price_cents >= 0),
  is_active boolean DEFAULT true,
  sort_order integer DEFAULT 0,
  created_at timestamptz DEFAULT now()
);

CREATE INDEX idx_services_salon ON services(salon_id);

-- Bookings
CREATE TABLE bookings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  salon_id uuid NOT NULL REFERENCES salons(id),
  service_id uuid NOT NULL REFERENCES services(id),
  staff_id uuid NOT NULL REFERENCES staff(id),
  start_at timestamptz NOT NULL,
  end_at timestamptz NOT NULL,
  customer_name text NOT NULL,
  customer_email text NOT NULL,
  customer_phone text NOT NULL,
  status text NOT NULL DEFAULT 'confirmed' CHECK (status IN ('confirmed', 'cancelled')),
  cancelled_at timestamptz,
  created_at timestamptz DEFAULT now()
);

CREATE INDEX idx_bookings_salon_date ON bookings(salon_id, start_at);
CREATE INDEX idx_bookings_staff_date ON bookings(staff_id, start_at, end_at) WHERE status = 'confirmed';
CREATE INDEX idx_bookings_customer_email ON bookings(salon_id, customer_email);
