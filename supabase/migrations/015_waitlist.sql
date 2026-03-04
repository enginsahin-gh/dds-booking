-- Waitlist: customers can join when no slots are available
CREATE TABLE waitlist (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  salon_id UUID NOT NULL REFERENCES salons(id) ON DELETE CASCADE,
  service_id UUID NOT NULL REFERENCES services(id),
  staff_id UUID REFERENCES staff(id), -- null = no preference
  customer_name TEXT NOT NULL,
  customer_email TEXT NOT NULL,
  customer_phone TEXT NOT NULL,
  preferred_date DATE NOT NULL, -- desired date
  preferred_time_start TIME, -- optional: preferred start time
  preferred_time_end TIME, -- optional: preferred end time
  status TEXT NOT NULL DEFAULT 'waiting', -- waiting, notified, booked, expired, cancelled
  notified_at TIMESTAMPTZ,
  expires_at TIMESTAMPTZ, -- when the notification expires (24h after notified)
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_waitlist_salon ON waitlist(salon_id, status, preferred_date);
ALTER TABLE waitlist ENABLE ROW LEVEL SECURITY;

-- Salon owners/staff can read their waitlist
CREATE POLICY "Salon users can view waitlist" ON waitlist
  FOR SELECT USING (
    salon_id IN (SELECT salon_id FROM salon_users WHERE user_id = auth.uid())
  );
