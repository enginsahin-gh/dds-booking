-- ============================================
-- Seed Data: Salon Amara (demo salon)
-- ============================================

-- 1. Salon
INSERT INTO salons (id, slug, name, email, phone, timezone)
VALUES (
  'a1b2c3d4-e5f6-7890-abcd-ef1234567890',
  'salon-amara',
  'Salon Amara',
  'info@salonamara.nl',
  '071 - 234 5678',
  'Europe/Amsterdam'
);

-- 2. Staff
INSERT INTO staff (id, salon_id, name, is_active, sort_order) VALUES
('11111111-1111-1111-1111-111111111111', 'a1b2c3d4-e5f6-7890-abcd-ef1234567890', 'Amara Yilmaz', true, 1),
('22222222-2222-2222-2222-222222222222', 'a1b2c3d4-e5f6-7890-abcd-ef1234567890', 'Sophie de Vries', true, 2),
('33333333-3333-3333-3333-333333333333', 'a1b2c3d4-e5f6-7890-abcd-ef1234567890', 'Yusuf Kaya', true, 3),
('44444444-4444-4444-4444-444444444444', 'a1b2c3d4-e5f6-7890-abcd-ef1234567890', 'Lisa Jansen', true, 4);

-- 3. Staff Schedules (di-za werken, ma+zo vrij)
-- Amara: di-za 09:00-18:00, do tot 21:00
INSERT INTO staff_schedules (staff_id, day_of_week, start_time, end_time, is_working) VALUES
('11111111-1111-1111-1111-111111111111', 0, '09:00', '18:00', false),
('11111111-1111-1111-1111-111111111111', 1, '09:00', '18:00', true),
('11111111-1111-1111-1111-111111111111', 2, '09:00', '18:00', true),
('11111111-1111-1111-1111-111111111111', 3, '09:00', '21:00', true),
('11111111-1111-1111-1111-111111111111', 4, '09:00', '18:00', true),
('11111111-1111-1111-1111-111111111111', 5, '09:00', '17:00', true),
('11111111-1111-1111-1111-111111111111', 6, '09:00', '17:00', false);

-- Sophie: di-vr 09:00-17:30, za 09:00-15:00
INSERT INTO staff_schedules (staff_id, day_of_week, start_time, end_time, is_working) VALUES
('22222222-2222-2222-2222-222222222222', 0, '09:00', '17:30', false),
('22222222-2222-2222-2222-222222222222', 1, '09:00', '17:30', true),
('22222222-2222-2222-2222-222222222222', 2, '09:00', '17:30', true),
('22222222-2222-2222-2222-222222222222', 3, '09:00', '17:30', true),
('22222222-2222-2222-2222-222222222222', 4, '09:00', '17:30', true),
('22222222-2222-2222-2222-222222222222', 5, '09:00', '15:00', true),
('22222222-2222-2222-2222-222222222222', 6, '09:00', '15:00', false);

-- Yusuf: di-za 10:00-19:00
INSERT INTO staff_schedules (staff_id, day_of_week, start_time, end_time, is_working) VALUES
('33333333-3333-3333-3333-333333333333', 0, '10:00', '19:00', false),
('33333333-3333-3333-3333-333333333333', 1, '10:00', '19:00', true),
('33333333-3333-3333-3333-333333333333', 2, '10:00', '19:00', true),
('33333333-3333-3333-3333-333333333333', 3, '10:00', '21:00', true),
('33333333-3333-3333-3333-333333333333', 4, '10:00', '19:00', true),
('33333333-3333-3333-3333-333333333333', 5, '10:00', '17:00', true),
('33333333-3333-3333-3333-333333333333', 6, '10:00', '17:00', false);

-- Lisa: wo-za 09:00-17:00
INSERT INTO staff_schedules (staff_id, day_of_week, start_time, end_time, is_working) VALUES
('44444444-4444-4444-4444-444444444444', 0, '09:00', '17:00', false),
('44444444-4444-4444-4444-444444444444', 1, '09:00', '17:00', false),
('44444444-4444-4444-4444-444444444444', 2, '09:00', '17:00', true),
('44444444-4444-4444-4444-444444444444', 3, '09:00', '17:00', true),
('44444444-4444-4444-4444-444444444444', 4, '09:00', '17:00', true),
('44444444-4444-4444-4444-444444444444', 5, '09:00', '15:00', true),
('44444444-4444-4444-4444-444444444444', 6, '09:00', '15:00', false);

-- 4. Services (price_cents = prijs in centen)
INSERT INTO services (salon_id, name, category, duration_min, price_cents, is_active, sort_order) VALUES
('a1b2c3d4-e5f6-7890-abcd-ef1234567890', 'Knippen + fohnen', 'Dames', 60, 4950, true, 1),
('a1b2c3d4-e5f6-7890-abcd-ef1234567890', 'Knippen', 'Dames', 45, 3950, true, 2),
('a1b2c3d4-e5f6-7890-abcd-ef1234567890', 'Fohnen / stylen', 'Dames', 30, 2950, true, 3),
('a1b2c3d4-e5f6-7890-abcd-ef1234567890', 'Kleuring volledig', 'Dames', 90, 6950, true, 4),
('a1b2c3d4-e5f6-7890-abcd-ef1234567890', 'Highlights heel hoofd', 'Dames', 120, 8950, true, 5),
('a1b2c3d4-e5f6-7890-abcd-ef1234567890', 'Balayage / ombre', 'Dames', 150, 11950, true, 6),
('a1b2c3d4-e5f6-7890-abcd-ef1234567890', 'Keratine behandeling', 'Dames', 120, 14950, true, 7),
('a1b2c3d4-e5f6-7890-abcd-ef1234567890', 'Bruidskapsels', 'Dames', 90, 8950, true, 8),
('a1b2c3d4-e5f6-7890-abcd-ef1234567890', 'Knippen + wassen + stylen', 'Heren', 30, 2950, true, 10),
('a1b2c3d4-e5f6-7890-abcd-ef1234567890', 'Knippen', 'Heren', 20, 2450, true, 11),
('a1b2c3d4-e5f6-7890-abcd-ef1234567890', 'Baard trimmen', 'Heren', 15, 1450, true, 12),
('a1b2c3d4-e5f6-7890-abcd-ef1234567890', 'Knippen + baard', 'Heren', 35, 3450, true, 13),
('a1b2c3d4-e5f6-7890-abcd-ef1234567890', 'Knippen (0-5 jaar)', 'Kinderen', 15, 1450, true, 20),
('a1b2c3d4-e5f6-7890-abcd-ef1234567890', 'Knippen (6-11 jaar)', 'Kinderen', 20, 1950, true, 21),
('a1b2c3d4-e5f6-7890-abcd-ef1234567890', 'Tieners (12-17)', 'Kinderen', 25, 2450, true, 22),
('a1b2c3d4-e5f6-7890-abcd-ef1234567890', 'Gellak', 'Beauty', 45, 3450, true, 30),
('a1b2c3d4-e5f6-7890-abcd-ef1234567890', 'Manicure', 'Beauty', 30, 2950, true, 31),
('a1b2c3d4-e5f6-7890-abcd-ef1234567890', 'Gezichtsbehandeling', 'Beauty', 60, 5950, true, 32);
