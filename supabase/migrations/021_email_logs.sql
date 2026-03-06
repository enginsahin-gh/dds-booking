-- =============================================
-- Migration 021: Email Logs (Customer Communication Inbox)
-- =============================================

BEGIN;

CREATE TABLE IF NOT EXISTS email_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  salon_id UUID REFERENCES salons(id) ON DELETE CASCADE,
  booking_id UUID REFERENCES bookings(id) ON DELETE SET NULL,
  waitlist_id UUID REFERENCES waitlist(id) ON DELETE SET NULL,
  type TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'queued',
  provider TEXT DEFAULT 'resend',
  provider_id TEXT,
  to_email TEXT NOT NULL,
  customer_name TEXT,
  subject TEXT,
  body_preview TEXT,
  body_html TEXT,
  error_message TEXT,
  meta JSONB,
  created_at TIMESTAMPTZ DEFAULT now(),
  sent_at TIMESTAMPTZ
);

-- Constraints (loose enough for future types)
ALTER TABLE email_logs
  ADD CONSTRAINT email_logs_status_check
  CHECK (status IN ('queued', 'sent', 'failed', 'skipped'));

-- Indexes
CREATE INDEX IF NOT EXISTS idx_email_logs_salon_created ON email_logs(salon_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_email_logs_booking ON email_logs(booking_id);
CREATE INDEX IF NOT EXISTS idx_email_logs_type ON email_logs(type);
CREATE INDEX IF NOT EXISTS idx_email_logs_status ON email_logs(status);

ALTER TABLE email_logs ENABLE ROW LEVEL SECURITY;

-- Authenticated users can read logs for their own salon
DROP POLICY IF EXISTS "auth_read_email_logs" ON email_logs;
CREATE POLICY "auth_read_email_logs" ON email_logs
  FOR SELECT TO authenticated
  USING (salon_id = get_user_salon_id());

-- Inserts/updates happen via service_role in Workers (RLS bypass)

COMMIT;
