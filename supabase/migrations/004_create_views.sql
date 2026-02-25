-- Public bookings view: only expose what's needed for slot calculation
-- No booking id, no customer data — SECURITY DEFINER bypasses RLS (SEC-002)
CREATE VIEW public_bookings WITH (security_barrier = true) AS
  SELECT staff_id, start_at, end_at
  FROM bookings
  WHERE status = 'confirmed';

GRANT SELECT ON public_bookings TO anon;
GRANT SELECT ON public_bookings TO authenticated;
