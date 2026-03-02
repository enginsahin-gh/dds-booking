-- 008: RBAC — salon_users table + RLS policies + helper functions

-- User-salon membership with role-based access control
CREATE TABLE IF NOT EXISTS salon_users (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  salon_id uuid NOT NULL REFERENCES salons(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  staff_id uuid REFERENCES staff(id) ON DELETE SET NULL,
  role text NOT NULL DEFAULT 'staff' CHECK (role IN ('owner', 'staff')),
  display_name text,
  can_see_revenue boolean NOT NULL DEFAULT false,
  created_at timestamptz DEFAULT now(),
  UNIQUE(salon_id, user_id)
);

ALTER TABLE salon_users ENABLE ROW LEVEL SECURITY;

-- Helper functions for RLS
CREATE OR REPLACE FUNCTION get_user_salon_id()
RETURNS uuid LANGUAGE sql STABLE SECURITY DEFINER AS $$
  SELECT salon_id FROM salon_users WHERE user_id = auth.uid() LIMIT 1
$$;

CREATE OR REPLACE FUNCTION get_user_role()
RETURNS text LANGUAGE sql STABLE SECURITY DEFINER AS $$
  SELECT role FROM salon_users WHERE user_id = auth.uid() LIMIT 1
$$;

CREATE OR REPLACE FUNCTION is_salon_owner()
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER AS $$
  SELECT EXISTS(SELECT 1 FROM salon_users WHERE user_id = auth.uid() AND role = 'owner')
$$;

CREATE OR REPLACE FUNCTION get_user_staff_id()
RETURNS uuid LANGUAGE sql STABLE SECURITY DEFINER AS $$
  SELECT staff_id FROM salon_users WHERE user_id = auth.uid() LIMIT 1
$$;

-- salon_users policies
CREATE POLICY su_select ON salon_users FOR SELECT
  USING (salon_id = get_user_salon_id());
CREATE POLICY su_insert ON salon_users FOR INSERT
  WITH CHECK (is_salon_owner() AND salon_id = get_user_salon_id());
CREATE POLICY su_update ON salon_users FOR UPDATE
  USING (is_salon_owner() AND salon_id = get_user_salon_id());
CREATE POLICY su_delete ON salon_users FOR DELETE
  USING (is_salon_owner() AND salon_id = get_user_salon_id());

-- Salon-scoped RLS policies for all major tables
-- salons
CREATE POLICY salon_select ON salons FOR SELECT USING (id = get_user_salon_id());
CREATE POLICY salon_update ON salons FOR UPDATE USING (id = get_user_salon_id() AND is_salon_owner());

-- staff
CREATE POLICY staff_select ON staff FOR SELECT USING (salon_id = get_user_salon_id());
CREATE POLICY staff_insert ON staff FOR INSERT WITH CHECK (salon_id = get_user_salon_id() AND is_salon_owner());
CREATE POLICY staff_update ON staff FOR UPDATE USING (salon_id = get_user_salon_id() AND is_salon_owner());
CREATE POLICY staff_delete ON staff FOR DELETE USING (salon_id = get_user_salon_id() AND is_salon_owner());

-- services
CREATE POLICY svc_select ON services FOR SELECT USING (salon_id = get_user_salon_id());
CREATE POLICY svc_insert ON services FOR INSERT WITH CHECK (salon_id = get_user_salon_id() AND is_salon_owner());
CREATE POLICY svc_update ON services FOR UPDATE USING (salon_id = get_user_salon_id() AND is_salon_owner());
CREATE POLICY svc_delete ON services FOR DELETE USING (salon_id = get_user_salon_id() AND is_salon_owner());

-- bookings
CREATE POLICY bk_select ON bookings FOR SELECT USING (salon_id = get_user_salon_id());
CREATE POLICY bk_update ON bookings FOR UPDATE USING (salon_id = get_user_salon_id());

-- staff_schedules
CREATE POLICY ss_select ON staff_schedules FOR SELECT
  USING (staff_id IN (SELECT id FROM staff WHERE salon_id = get_user_salon_id()));
CREATE POLICY ss_all ON staff_schedules FOR ALL
  USING (staff_id IN (SELECT id FROM staff WHERE salon_id = get_user_salon_id()))
  WITH CHECK (staff_id IN (SELECT id FROM staff WHERE salon_id = get_user_salon_id()));

-- staff_blocks
CREATE POLICY sb_select ON staff_blocks FOR SELECT
  USING (staff_id IN (SELECT id FROM staff WHERE salon_id = get_user_salon_id()));
CREATE POLICY sb_all ON staff_blocks FOR ALL
  USING (staff_id IN (SELECT id FROM staff WHERE salon_id = get_user_salon_id()))
  WITH CHECK (staff_id IN (SELECT id FROM staff WHERE salon_id = get_user_salon_id()));
