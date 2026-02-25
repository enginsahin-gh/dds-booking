-- Enable RLS on all tables
ALTER TABLE salons ENABLE ROW LEVEL SECURITY;
ALTER TABLE staff ENABLE ROW LEVEL SECURITY;
ALTER TABLE staff_schedules ENABLE ROW LEVEL SECURITY;
ALTER TABLE staff_blocks ENABLE ROW LEVEL SECURITY;
ALTER TABLE services ENABLE ROW LEVEL SECURITY;
ALTER TABLE bookings ENABLE ROW LEVEL SECURITY;

-- SALONS
CREATE POLICY "salons_select_public" ON salons FOR SELECT USING (true);
CREATE POLICY "salons_update_owner" ON salons FOR UPDATE USING (auth.uid() = owner_id);

-- SERVICES
CREATE POLICY "services_select_public" ON services FOR SELECT USING (is_active = true);
CREATE POLICY "services_all_owner" ON services FOR ALL USING (
  salon_id IN (SELECT id FROM salons WHERE owner_id = auth.uid())
);

-- STAFF
CREATE POLICY "staff_select_public" ON staff FOR SELECT USING (is_active = true);
CREATE POLICY "staff_all_owner" ON staff FOR ALL USING (
  salon_id IN (SELECT id FROM salons WHERE owner_id = auth.uid())
);

-- STAFF SCHEDULES
CREATE POLICY "schedules_select_public" ON staff_schedules FOR SELECT USING (true);
CREATE POLICY "schedules_all_owner" ON staff_schedules FOR ALL USING (
  staff_id IN (
    SELECT s.id FROM staff s JOIN salons sa ON sa.id = s.salon_id WHERE sa.owner_id = auth.uid()
  )
);

-- STAFF BLOCKS
CREATE POLICY "blocks_select_public" ON staff_blocks FOR SELECT USING (true);
CREATE POLICY "blocks_all_owner" ON staff_blocks FOR ALL USING (
  staff_id IN (
    SELECT s.id FROM staff s JOIN salons sa ON sa.id = s.salon_id WHERE sa.owner_id = auth.uid()
  )
);

-- BOOKINGS
-- No public SELECT on bookings table — use public_bookings view instead (SEC-002)
CREATE POLICY "bookings_select_public" ON bookings FOR SELECT USING (false);
CREATE POLICY "bookings_insert_public" ON bookings FOR INSERT WITH CHECK (true);
CREATE POLICY "bookings_all_owner" ON bookings FOR ALL USING (
  salon_id IN (SELECT id FROM salons WHERE owner_id = auth.uid())
);
