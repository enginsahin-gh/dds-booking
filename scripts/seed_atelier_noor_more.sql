BEGIN;

-- Target salon
-- atelier-noor-demo

-- Extra categories (idempotent)
INSERT INTO service_categories (salon_id, name, sort_order)
SELECT '05659213-05b8-41e4-89ea-7c7f8430deef', 'Extensions', 4
WHERE NOT EXISTS (
  SELECT 1 FROM service_categories
  WHERE salon_id='05659213-05b8-41e4-89ea-7c7f8430deef' AND name='Extensions'
);

INSERT INTO service_categories (salon_id, name, sort_order)
SELECT '05659213-05b8-41e4-89ea-7c7f8430deef', 'Bruidsstyling', 5
WHERE NOT EXISTS (
  SELECT 1 FROM service_categories
  WHERE salon_id='05659213-05b8-41e4-89ea-7c7f8430deef' AND name='Bruidsstyling'
);

-- Extra services (idempotent)
INSERT INTO services (salon_id, category_id, name, duration_min, price_cents, sort_order)
SELECT '05659213-05b8-41e4-89ea-7c7f8430deef', c.id, s.name, s.duration_min, s.price_cents, s.sort_order
FROM (
  VALUES
    ('Extensions','Tape-in extensions consult',30,2500,0),
    ('Extensions','Tape-in extensions plaatsen',120,18500,1),
    ('Bruidsstyling','Bruidsproef kapsel',90,9500,0),
    ('Bruidsstyling','Bruidskapsel (trouwdag)',120,14500,1)
) AS s(category_name, name, duration_min, price_cents, sort_order)
JOIN service_categories c ON c.salon_id='05659213-05b8-41e4-89ea-7c7f8430deef' AND c.name=s.category_name
WHERE NOT EXISTS (
  SELECT 1 FROM services sv
  WHERE sv.salon_id='05659213-05b8-41e4-89ea-7c7f8430deef' AND sv.name = s.name
);

-- Customers
INSERT INTO customers (salon_id, name, email, phone)
VALUES
  ('05659213-05b8-41e4-89ea-7c7f8430deef','Lotte de Vries','lotte@demo.nl','0612345678'),
  ('05659213-05b8-41e4-89ea-7c7f8430deef','Esra Kaya','esra@demo.nl','0623456789'),
  ('05659213-05b8-41e4-89ea-7c7f8430deef','Milan Peters','milan@demo.nl','0634567890'),
  ('05659213-05b8-41e4-89ea-7c7f8430deef','Sofia Janssen','sofia@demo.nl','0645678901'),
  ('05659213-05b8-41e4-89ea-7c7f8430deef','Rayan El Idrissi','rayan@demo.nl','0656789012'),
  ('05659213-05b8-41e4-89ea-7c7f8430deef','Jill van Leeuwen','jill@demo.nl','0667890123'),
  ('05659213-05b8-41e4-89ea-7c7f8430deef','Nina van Dalen','nina@demo.nl','0611122233'),
  ('05659213-05b8-41e4-89ea-7c7f8430deef','Eva Meijer','eva@demo.nl','0622233344'),
  ('05659213-05b8-41e4-89ea-7c7f8430deef','Amber Smit','amber@demo.nl','0633344455'),
  ('05659213-05b8-41e4-89ea-7c7f8430deef','Thijs Vermeer','thijs@demo.nl','0644455566'),
  ('05659213-05b8-41e4-89ea-7c7f8430deef','Sara de Groot','sarag@demo.nl','0655566677'),
  ('05659213-05b8-41e4-89ea-7c7f8430deef','Eline Bakker','eline@demo.nl','0666677788'),
  ('05659213-05b8-41e4-89ea-7c7f8430deef','Koen de Wit','koen@demo.nl','0677788899'),
  ('05659213-05b8-41e4-89ea-7c7f8430deef','Floor Jansen','floor@demo.nl','0688899900'),
  ('05659213-05b8-41e4-89ea-7c7f8430deef','Myra Vos','myra@demo.nl','0610101010');

-- Bookings (realistic spread past + upcoming)
WITH base AS (
  SELECT date_trunc('day', now() AT TIME ZONE 'Europe/Amsterdam') AS base_day
),
rows(day_offset, start_time, service_name, staff_name, customer_name, customer_email, customer_phone, status, payment_status, payment_type, deposit_amount, notes) AS (
  VALUES
    (0, '09:30'::time, 'Dames knippen', 'Noor El Amrani', 'Lotte de Vries', 'lotte@demo.nl', '0612345678', 'confirmed', 'paid', 'full', NULL, 'Eerste keer bij ons.'),
    (0, '11:00'::time, 'Uitgroei kleuren', 'Sara van Dijk', 'Esra Kaya', 'esra@demo.nl', '0623456789', 'pending_payment', 'pending', 'deposit', 25.00, 'Liever koele tint.'),
    (0, '13:30'::time, 'Heren knippen', 'Yassin Badr', 'Milan Peters', 'milan@demo.nl', '0634567890', 'confirmed', 'paid', 'full', NULL, NULL),
    (1, '10:00'::time, 'Balayage + toner', 'Sara van Dijk', 'Sofia Janssen', 'sofia@demo.nl', '0645678901', 'confirmed', 'pending', 'deposit', 25.00, 'Subtiele balayage.'),
    (1, '12:30'::time, 'Heren knippen + baard', 'Yassin Badr', 'Rayan El Idrissi', 'rayan@demo.nl', '0656789012', 'no_show', 'none', 'none', NULL, 'No-show vorige maand.'),
    (1, '15:00'::time, 'Dames knippen + föhnen', 'Noor El Amrani', 'Jill van Leeuwen', 'jill@demo.nl', '0667890123', 'confirmed', 'paid', 'full', NULL, NULL),
    (2, '09:00'::time, 'Föhn & styling', 'Noor El Amrani', 'Nina van Dalen', 'nina@demo.nl', '0611122233', 'confirmed', 'paid', 'full', NULL, NULL),
    (2, '10:30'::time, 'Highlights half head', 'Sara van Dijk', 'Eva Meijer', 'eva@demo.nl', '0622233344', 'confirmed', 'paid', 'full', NULL, NULL),
    (2, '14:00'::time, 'Keratine behandeling', 'Noor El Amrani', 'Amber Smit', 'amber@demo.nl', '0633344455', 'pending_payment', 'pending', 'deposit', 25.00, 'Gevoelige hoofdhuid.'),
    (2, '16:30'::time, 'Heren knippen', 'Yassin Badr', 'Thijs Vermeer', 'thijs@demo.nl', '0644455566', 'cancelled', 'none', 'none', NULL, 'Geannuleerd via telefoon.'),
    (3, '11:00'::time, 'Dames knippen', 'Noor El Amrani', 'Sara de Groot', 'sarag@demo.nl', '0655566677', 'confirmed', 'paid', 'full', NULL, NULL),
    (3, '13:00'::time, 'Olaplex treatment', 'Sara van Dijk', 'Eline Bakker', 'eline@demo.nl', '0666677788', 'confirmed', 'paid', 'full', NULL, NULL),
    (3, '17:00'::time, 'Heren knippen', 'Yassin Badr', 'Koen de Wit', 'koen@demo.nl', '0677788899', 'confirmed', 'paid', 'full', NULL, NULL),
    (-1, '10:00'::time, 'Dames knippen', 'Noor El Amrani', 'Floor Jansen', 'floor@demo.nl', '0688899900', 'confirmed', 'paid', 'full', NULL, NULL),
    (-1, '14:00'::time, 'Uitgroei kleuren', 'Sara van Dijk', 'Myra Vos', 'myra@demo.nl', '0610101010', 'confirmed', 'paid', 'full', NULL, NULL)
)
INSERT INTO bookings (
  salon_id, service_id, staff_id,
  start_at, end_at,
  customer_name, customer_email, customer_phone,
  status, payment_status, payment_type,
  amount_total_cents, amount_paid_cents, amount_due_cents,
  deposit_amount, cancelled_at, notes
)
SELECT
  '05659213-05b8-41e4-89ea-7c7f8430deef',
  sv.id,
  st.id,
  ((base.base_day + (r.day_offset || ' days')::interval + r.start_time) AT TIME ZONE 'Europe/Amsterdam') AS start_at,
  (((base.base_day + (r.day_offset || ' days')::interval + r.start_time) AT TIME ZONE 'Europe/Amsterdam') + (sv.duration_min || ' minutes')::interval) AS end_at,
  r.customer_name,
  r.customer_email,
  r.customer_phone,
  r.status,
  r.payment_status,
  r.payment_type,
  sv.price_cents,
  CASE WHEN r.payment_status = 'paid' THEN sv.price_cents ELSE 0 END,
  CASE WHEN r.payment_status = 'paid' THEN 0 ELSE sv.price_cents END,
  r.deposit_amount,
  CASE WHEN r.status = 'cancelled' THEN now() - interval '1 day' ELSE NULL END,
  r.notes
FROM rows r
JOIN base ON true
JOIN services sv ON sv.salon_id='05659213-05b8-41e4-89ea-7c7f8430deef' AND sv.name = r.service_name
JOIN staff st ON st.salon_id='05659213-05b8-41e4-89ea-7c7f8430deef' AND st.name = r.staff_name;

COMMIT;
