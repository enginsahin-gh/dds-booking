-- =============================================
-- Customer login (optional) + customer profiles
-- Phase 1: DB tables + salon settings
-- =============================================

BEGIN;

-- 1) Salon settings for customer login
ALTER TABLE salons
  ADD COLUMN IF NOT EXISTS customer_login_enabled BOOLEAN DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS customer_login_methods TEXT[] DEFAULT ARRAY['password','otp'],
  ADD COLUMN IF NOT EXISTS guest_booking_allowed BOOLEAN DEFAULT TRUE;

-- 2) Customers (per salon)
CREATE TABLE IF NOT EXISTS customers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  salon_id UUID NOT NULL REFERENCES salons(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  email TEXT NOT NULL,
  phone TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS customers_unique_email
  ON customers (salon_id, lower(email));

CREATE INDEX IF NOT EXISTS customers_salon_idx
  ON customers (salon_id);

-- 3) Link customers to auth users (for future login flow)
CREATE TABLE IF NOT EXISTS customer_users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_id UUID NOT NULL REFERENCES customers(id) ON DELETE CASCADE,
  auth_user_id UUID NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS customer_users_unique
  ON customer_users (customer_id, auth_user_id);

CREATE UNIQUE INDEX IF NOT EXISTS customer_users_auth_unique
  ON customer_users (auth_user_id);

-- 4) RLS
ALTER TABLE customers ENABLE ROW LEVEL SECURITY;
ALTER TABLE customer_users ENABLE ROW LEVEL SECURITY;

-- Customers: salon-scoped access for authenticated staff/owners
CREATE POLICY "auth_select_customers" ON customers
  FOR SELECT TO authenticated
  USING (salon_id = get_user_salon_id());

CREATE POLICY "auth_insert_customers" ON customers
  FOR INSERT TO authenticated
  WITH CHECK (salon_id = get_user_salon_id());

CREATE POLICY "auth_update_customers" ON customers
  FOR UPDATE TO authenticated
  USING (salon_id = get_user_salon_id())
  WITH CHECK (salon_id = get_user_salon_id());

CREATE POLICY "auth_delete_customers" ON customers
  FOR DELETE TO authenticated
  USING (salon_id = get_user_salon_id());

-- Customer_users: authenticated read for own salon (future use)
CREATE POLICY "auth_select_customer_users" ON customer_users
  FOR SELECT TO authenticated
  USING (
    customer_id IN (
      SELECT id FROM customers WHERE salon_id = get_user_salon_id()
    )
  );

COMMIT;
