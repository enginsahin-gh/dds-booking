-- Migration 011: In-app notifications
-- Real-time notifications for salon owners/staff about bookings

CREATE TABLE IF NOT EXISTS notifications (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  salon_id UUID NOT NULL REFERENCES salons(id) ON DELETE CASCADE,
  type TEXT NOT NULL,           -- 'new_booking', 'cancellation', 'payment', 'no_show'
  title TEXT NOT NULL,
  message TEXT,
  booking_id UUID REFERENCES bookings(id) ON DELETE SET NULL,
  read BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_notifications_salon ON notifications(salon_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_notifications_unread ON notifications(salon_id, read) WHERE read = false;

ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;

-- Users can read notifications for their salon
CREATE POLICY "Users can read own salon notifications"
  ON notifications FOR SELECT
  USING (salon_id IN (SELECT salon_id FROM salon_users WHERE user_id = auth.uid()));

-- Users can mark notifications as read
CREATE POLICY "Users can update own salon notifications"
  ON notifications FOR UPDATE
  USING (salon_id IN (SELECT salon_id FROM salon_users WHERE user_id = auth.uid()));

-- Enable Supabase Realtime for notifications table
ALTER PUBLICATION supabase_realtime ADD TABLE notifications;
