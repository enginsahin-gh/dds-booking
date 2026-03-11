BEGIN;

-- Waitlist entries
INSERT INTO waitlist (
  salon_id, service_id, staff_id, customer_name, customer_email, customer_phone,
  preferred_date, preferred_time_start, preferred_time_end, status
)
SELECT
  '05659213-05b8-41e4-89ea-7c7f8430deef',
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
  (4, '10:00'::time, '12:00'::time, 'waiting', 'Nora Verhoeven', 'nora@demo.nl', '0612341100', 'Dames knippen'),
  (5, '13:00'::time, '16:00'::time, 'waiting', 'Kevin Groot', 'kevin@demo.nl', '0612342200', 'Heren knippen + baard'),
  (7, '09:30'::time, '11:30'::time, 'waiting', 'Mila Bosch', 'mila@demo.nl', '0612343300', 'Balayage + toner'),
  (9, '14:00'::time, '17:00'::time, 'waiting', 'Romy de Boer', 'romy@demo.nl', '0612344400', 'Highlights half head')
) AS w(day_offset, start_time, end_time, status, customer_name, customer_email, customer_phone, service_name)
JOIN services sv ON sv.salon_id='05659213-05b8-41e4-89ea-7c7f8430deef' AND sv.name = w.service_name
JOIN staff st ON st.salon_id='05659213-05b8-41e4-89ea-7c7f8430deef' AND st.name IN ('Noor El Amrani','Sara van Dijk')
LIMIT 4;

-- Email logs based on recent bookings
WITH recent AS (
  SELECT id, customer_email, customer_name, start_at
  FROM bookings
  WHERE salon_id='05659213-05b8-41e4-89ea-7c7f8430deef'
  ORDER BY start_at DESC
  LIMIT 4
),
entries(type, status, subject, preview, age_minutes, is_read, handled_minutes) AS (
  VALUES
    ('confirmation','sent','Bevestiging afspraak','Je afspraak is bevestigd. We zien je graag binnenkort.', 4320, true, 2880),
    ('reminder_24h','sent','Herinnering afspraak','Morgen ben je welkom bij Atelier Noor.', 1440, true, 720),
    ('reminder_1h','sent','Herinnering afspraak','Tot zo! Je afspraak start over 1 uur.', 120, true, NULL),
    ('review_request','queued','Hoe was je bezoek?','We horen graag je feedback over je behandeling.', 60, false, NULL)
)
INSERT INTO email_logs (
  salon_id, booking_id, type, status, to_email, customer_name, subject, body_preview,
  created_at, sent_at, is_read, handled_at
)
SELECT
  '05659213-05b8-41e4-89ea-7c7f8430deef',
  r.id,
  e.type,
  e.status,
  r.customer_email,
  r.customer_name,
  e.subject,
  e.preview,
  now() - (e.age_minutes || ' minutes')::interval,
  CASE WHEN e.status = 'sent' THEN now() - (e.age_minutes || ' minutes')::interval + interval '5 minutes' ELSE NULL END,
  e.is_read,
  CASE WHEN e.handled_minutes IS NOT NULL THEN now() - (e.handled_minutes || ' minutes')::interval ELSE NULL END
FROM recent r
JOIN entries e ON true;

-- Waitlist email logs
WITH wl AS (
  SELECT id, customer_email, customer_name
  FROM waitlist
  WHERE salon_id='05659213-05b8-41e4-89ea-7c7f8430deef'
  ORDER BY created_at DESC
  LIMIT 2
)
INSERT INTO email_logs (
  salon_id, waitlist_id, type, status, to_email, customer_name, subject, body_preview,
  created_at, sent_at, is_read, handled_at
)
SELECT
  '05659213-05b8-41e4-89ea-7c7f8430deef',
  wl.id,
  'waitlist',
  'failed',
  wl.customer_email,
  wl.customer_name,
  'Wachtlijst update',
  'Er kwam een plek vrij, maar we konden je niet bereiken.',
  now() - interval '8 hours',
  NULL,
  false,
  NULL
FROM wl;

COMMIT;
