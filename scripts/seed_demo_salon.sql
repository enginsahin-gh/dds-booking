BEGIN;

-- Create salon
WITH new_salon AS (
  INSERT INTO salons (
    slug, name, email, phone, owner_id, timezone,
    address, city, postal_code, location_info, cancellation_policy,
    subscription_status, trial_started_at, trial_ends_at, plan_type,
    brand_color, brand_color_text, brand_gradient_enabled,
    brand_gradient_from, brand_gradient_to, brand_gradient_direction
  ) VALUES (
    'atelier-noor-demo',
    'Atelier Noor — Hair & Color',
    'info@ateliernoor.nl',
    '010-781 4421',
    'd768cc53-461c-4180-a87d-d51f2b44a66f',
    'Europe/Amsterdam',
    'Nieuwe Binnenweg 120',
    'Rotterdam',
    '3015 BG',
    'Tram 4/8, parkeergarage Westblaak op 3 minuten lopen.',
    'Annuleren kan tot 24 uur van tevoren. Bij late annulering rekenen we 50% van de behandeling.',
    'trial',
    now() - interval '10 days',
    now() + interval '20 days',
    'booking_standalone',
    '#C08E6F',
    '#FFFFFF',
    true,
    '#C08E6F',
    '#E6C9B6',
    '135deg'
  )
  RETURNING id
),
owner_staff AS (
  INSERT INTO staff (salon_id, name, sort_order, all_services)
  SELECT id, 'Noor El Amrani', 0, true FROM new_salon
  RETURNING id
),
staff_sara AS (
  INSERT INTO staff (salon_id, name, sort_order, all_services)
  SELECT id, 'Sara van Dijk', 1, false FROM new_salon
  RETURNING id
),
staff_yassin AS (
  INSERT INTO staff (salon_id, name, sort_order, all_services)
  SELECT id, 'Yassin Badr', 2, false FROM new_salon
  RETURNING id
),
salon_user AS (
  INSERT INTO salon_users (salon_id, user_id, role, display_name, can_see_revenue, read_scope, edit_scope)
  SELECT id, 'd768cc53-461c-4180-a87d-d51f2b44a66f'::uuid, 'owner', 'Noor El Amrani', true, 'all', 'all' FROM new_salon
  RETURNING id
),
cat AS (
  INSERT INTO service_categories (salon_id, name, sort_order)
  SELECT id, c.name, c.sort_order FROM new_salon, (VALUES
    ('Knippen',0),
    ('Kleuren',1),
    ('Styling & Care',2),
    ('Heren',3)
  ) AS c(name, sort_order)
  RETURNING id, name
),
services AS (
  INSERT INTO services (salon_id, category_id, name, duration_min, price_cents, sort_order)
  SELECT (select id from new_salon), c.id, s.name, s.duration, s.price, s.sort_order
  FROM (VALUES
    ('Knippen','Dames knippen',45,4200,0),
    ('Knippen','Dames knippen + föhnen',60,5200,1),
    ('Knippen','Pony bijwerken',15,1500,2),
    ('Heren','Heren knippen',30,2800,0),
    ('Heren','Heren knippen + baard',45,3800,1),
    ('Kleuren','Uitgroei kleuren',90,7800,0),
    ('Kleuren','Highlights half head',120,9800,1),
    ('Kleuren','Balayage + toner',150,13500,2),
    ('Styling & Care','Föhn & styling',30,3200,0),
    ('Styling & Care','Keratine behandeling',120,16000,1),
    ('Styling & Care','Olaplex treatment',45,4500,2)
  ) AS s(cat, name, duration, price, sort_order)
  JOIN cat c ON c.name = s.cat
  RETURNING id, name, duration_min, price_cents
),
staff_services AS (
  INSERT INTO staff_services (staff_id, service_id)
  SELECT st.id, sv.id
  FROM services sv
  JOIN staff st ON st.name IN ('Sara van Dijk','Yassin Badr')
  WHERE (
    (st.name='Sara van Dijk' AND sv.name IN ('Uitgroei kleuren','Highlights half head','Balayage + toner','Olaplex treatment','Dames knippen + föhnen','Dames knippen'))
    OR
    (st.name='Yassin Badr' AND sv.name IN ('Heren knippen','Heren knippen + baard'))
  )
  RETURNING staff_id
),
schedules AS (
  INSERT INTO staff_schedules (staff_id, day_of_week, start_time, end_time, is_working)
  SELECT st.id, d.day, d.start_time, d.end_time, d.is_working
  FROM staff st
  JOIN (VALUES
    (0, '09:00'::time, '18:00'::time, true),
    (1, '09:00', '18:00', true),
    (2, '09:00', '18:00', true),
    (3, '10:00', '19:00', true),
    (4, '09:00', '17:00', true),
    (5, '10:00', '16:00', true),
    (6, '00:00', '00:00', false)
  ) AS d(day, start_time, end_time, is_working) ON true
  RETURNING staff_id
),
base AS (
  SELECT date_trunc('day', now() AT TIME ZONE 'Europe/Amsterdam') AS base_day
),
bookings AS (
  INSERT INTO bookings (
    salon_id, service_id, staff_id,
    start_at, end_at,
    customer_name, customer_email, customer_phone,
    status, payment_status, payment_type,
    amount_total_cents, amount_paid_cents, amount_due_cents,
    deposit_amount, cancelled_at, notes
  )
  SELECT
    (select id from new_salon),
    sv.id,
    st.id,
    ((base.base_day + (b.day_offset || ' days')::interval + b.start_time) AT TIME ZONE 'Europe/Amsterdam') AS start_at,
    (((base.base_day + (b.day_offset || ' days')::interval + b.start_time) AT TIME ZONE 'Europe/Amsterdam') + (b.duration_min || ' minutes')::interval) AS end_at,
    b.customer_name,
    b.customer_email,
    b.customer_phone,
    b.status,
    b.payment_status,
    b.payment_type,
    b.amount_total_cents,
    b.amount_paid_cents,
    b.amount_due_cents,
    b.deposit_amount,
    CASE WHEN b.status = 'cancelled' THEN now() - interval '1 day' ELSE NULL END,
    b.notes
  FROM base,
  (VALUES
    (0, '09:30'::time, 45, 'Dames knippen', 'Noor El Amrani', 'Lotte de Vries', 'lotte@demo.nl', '0612345678', 'confirmed', 'paid', 'full', 4200, 4200, 0, NULL, 'Eerste keer bij ons.'),
    (0, '11:00'::time, 90, 'Uitgroei kleuren', 'Sara van Dijk', 'Esra Kaya', 'esra@demo.nl', '0623456789', 'pending_payment', 'pending', 'deposit', 7800, 0, 7800, 25.00, 'Allergie: n.v.t.'),
    (0, '13:30'::time, 30, 'Heren knippen', 'Yassin Badr', 'Milan Peters', 'milan@demo.nl', '0634567890', 'confirmed', 'paid', 'full', 2800, 2800, 0, NULL, NULL),
    (1, '10:00'::time, 150, 'Balayage + toner', 'Sara van Dijk', 'Sofia Janssen', 'sofia@demo.nl', '0645678901', 'confirmed', 'pending', 'deposit', 13500, 0, 13500, 25.00, 'Liever koele tint.'),
    (1, '12:30'::time, 45, 'Heren knippen + baard', 'Yassin Badr', 'Rayan El Idrissi', 'rayan@demo.nl', '0656789012', 'no_show', 'none', 'none', 3800, 0, 3800, NULL, 'No-show vorige maand.'),
    (1, '15:00'::time, 60, 'Dames knippen + föhnen', 'Noor El Amrani', 'Jill van Leeuwen', 'jill@demo.nl', '0667890123', 'confirmed', 'paid', 'full', 5200, 5200, 0, NULL, NULL),
    (2, '09:00'::time, 30, 'Föhn & styling', 'Noor El Amrani', 'Nina van Dalen', 'nina@demo.nl', '0611122233', 'confirmed', 'paid', 'full', 3200, 3200, 0, NULL, NULL),
    (2, '10:30'::time, 120, 'Highlights half head', 'Sara van Dijk', 'Eva Meijer', 'eva@demo.nl', '0622233344', 'confirmed', 'paid', 'full', 9800, 9800, 0, NULL, NULL),
    (2, '14:00'::time, 120, 'Keratine behandeling', 'Noor El Amrani', 'Amber Smit', 'amber@demo.nl', '0633344455', 'pending_payment', 'pending', 'deposit', 16000, 0, 16000, 25.00, 'Gevoelige hoofdhuid.'),
    (2, '16:30'::time, 30, 'Heren knippen', 'Yassin Badr', 'Thijs Vermeer', 'thijs@demo.nl', '0644455566', 'cancelled', 'none', 'none', 2800, 0, 2800, NULL, 'Geannuleerd via telefoon.'),
    (3, '11:00'::time, 45, 'Dames knippen', 'Noor El Amrani', 'Sara de Groot', 'sarag@demo.nl', '0655566677', 'confirmed', 'paid', 'full', 4200, 4200, 0, NULL, NULL),
    (3, '13:00'::time, 45, 'Olaplex treatment', 'Sara van Dijk', 'Eline Bakker', 'eline@demo.nl', '0666677788', 'confirmed', 'paid', 'full', 4500, 4500, 0, NULL, NULL),
    (3, '17:00'::time, 30, 'Heren knippen', 'Yassin Badr', 'Koen de Wit', 'koen@demo.nl', '0677788899', 'confirmed', 'paid', 'full', 2800, 2800, 0, NULL, NULL),
    (-1, '10:00'::time, 45, 'Dames knippen', 'Noor El Amrani', 'Floor Jansen', 'floor@demo.nl', '0688899900', 'confirmed', 'paid', 'full', 4200, 4200, 0, NULL, NULL),
    (-1, '14:00'::time, 90, 'Uitgroei kleuren', 'Sara van Dijk', 'Myra Vos', 'myra@demo.nl', '0610101010', 'confirmed', 'paid', 'full', 7800, 7800, 0, NULL, NULL)
  ) AS b(day_offset, start_time, duration_min, service_name, staff_name, customer_name, customer_email, customer_phone, status, payment_status, payment_type, amount_total_cents, amount_paid_cents, amount_due_cents, deposit_amount, notes)
  JOIN services sv ON sv.name = b.service_name
  JOIN staff st ON st.name = b.staff_name
  RETURNING id, customer_email, customer_name, status, start_at
),
waitlist AS (
  INSERT INTO waitlist (
    salon_id, service_id, staff_id, customer_name, customer_email, customer_phone,
    preferred_date, preferred_time_start, preferred_time_end, status
  )
  SELECT
    (select id from new_salon),
    sv.id,
    st.id,
    w.customer_name,
    w.customer_email,
    w.customer_phone,
    (current_date + (w.day_offset || ' days')::interval)::date,
    w.start_time,
    w.end_time,
    w.status
  FROM (VALUES
    (4, '11:00'::time, '14:00'::time, 'waiting', 'Nora Verhoeven', 'nora@demo.nl', '0612341100', 'Dames knippen'),
    (6, '09:00'::time, '12:00'::time, 'waiting', 'Kevin Groot', 'kevin@demo.nl', '0612342200', 'Heren knippen + baard')
  ) AS w(day_offset, start_time, end_time, status, customer_name, customer_email, customer_phone, service_name)
  JOIN services sv ON sv.name = w.service_name
  LEFT JOIN staff st ON st.name = 'Noor El Amrani'
  RETURNING id
),
email_logs AS (
  INSERT INTO email_logs (
    salon_id, booking_id, waitlist_id, type, status, to_email, customer_name, subject, body_preview,
    created_at, sent_at, is_read, handled_at
  )
  SELECT
    (select id from new_salon),
    b.id,
    NULL,
    e.type,
    e.status,
    b.customer_email,
    b.customer_name,
    e.subject,
    e.preview,
    now() - e.age,
    CASE WHEN e.status = 'sent' THEN now() - e.age + interval '5 minutes' ELSE NULL END,
    e.is_read,
    e.handled_at
  FROM bookings b
  JOIN (VALUES
    ('confirmation','sent','Bevestiging afspraak','Je afspraak is bevestigd. We zien je graag binnenkort.', interval '3 days', true, now() - interval '2 days'),
    ('reminder_24h','sent','Herinnering afspraak','Morgen ben je welkom bij Atelier Noor.', interval '1 day', true, now() - interval '1 day'),
    ('reminder_1h','sent','Herinnering afspraak','Tot zo! Je afspraak start over 1 uur.', interval '6 hours', true, NULL),
    ('cancellation','sent','Afspraak geannuleerd','Je afspraak is geannuleerd. Neem contact op voor een nieuwe tijd.', interval '2 days', true, now() - interval '2 days'),
    ('review_request','queued','Hoe was je bezoek?','We horen graag je feedback over je behandeling.', interval '4 hours', false, NULL),
    ('waitlist','failed','Wachtlijst update','Er kwam een plek vrij, maar we konden je niet bereiken.', interval '8 hours', false, NULL)
  ) AS e(type, status, subject, preview, age, is_read, handled_at) ON true
  WHERE b.id IN (SELECT id FROM bookings ORDER BY start_at DESC LIMIT 2)
  RETURNING id
),
customer_meta AS (
  INSERT INTO customer_meta (salon_id, email, tags, note)
  SELECT (select id from new_salon), m.email, m.tags, m.note
  FROM (VALUES
    ('esra@demo.nl', ARRAY['vip'], 'Altijd koele tonen, voorkeur voor latte brown.'),
    ('rayan@demo.nl', ARRAY['warning'], 'No-show eerder dit jaar. Even bevestigen.')
  ) AS m(email, tags, note)
  RETURNING id
)
SELECT (SELECT id FROM new_salon) AS salon_id;

COMMIT;
