-- =============================================
-- Migration 024: Email log read/handled + Customer meta
-- =============================================

BEGIN;

-- Email logs: read/handled states
ALTER TABLE email_logs
  ADD COLUMN IF NOT EXISTS is_read BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS handled_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS handled_by UUID;

CREATE INDEX IF NOT EXISTS idx_email_logs_is_read ON email_logs(is_read);
CREATE INDEX IF NOT EXISTS idx_email_logs_handled_at ON email_logs(handled_at);

-- Allow authenticated updates for read/handled flags
DROP POLICY IF EXISTS "auth_update_email_logs" ON email_logs;
CREATE POLICY "auth_update_email_logs" ON email_logs
  FOR UPDATE TO authenticated
  USING (salon_id = get_user_salon_id())
  WITH CHECK (salon_id = get_user_salon_id());

-- Column-level update grants (only these fields)
GRANT UPDATE (is_read, handled_at, handled_by) ON email_logs TO authenticated;

-- Customer meta table for tags/notes
CREATE TABLE IF NOT EXISTS customer_meta (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  salon_id UUID REFERENCES salons(id) ON DELETE CASCADE,
  email TEXT NOT NULL,
  tags TEXT[] NOT NULL DEFAULT '{}',
  note TEXT,
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_customer_meta_unique ON customer_meta(salon_id, email);
CREATE INDEX IF NOT EXISTS idx_customer_meta_salon ON customer_meta(salon_id);

ALTER TABLE customer_meta ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "auth_read_customer_meta" ON customer_meta;
CREATE POLICY "auth_read_customer_meta" ON customer_meta
  FOR SELECT TO authenticated
  USING (salon_id = get_user_salon_id());

DROP POLICY IF EXISTS "auth_upsert_customer_meta" ON customer_meta;
CREATE POLICY "auth_upsert_customer_meta" ON customer_meta
  FOR INSERT TO authenticated
  WITH CHECK (salon_id = get_user_salon_id());

DROP POLICY IF EXISTS "auth_update_customer_meta" ON customer_meta;
CREATE POLICY "auth_update_customer_meta" ON customer_meta
  FOR UPDATE TO authenticated
  USING (salon_id = get_user_salon_id())
  WITH CHECK (salon_id = get_user_salon_id());

GRANT SELECT, INSERT, UPDATE ON customer_meta TO authenticated;

-- Trigger: update updated_at
CREATE OR REPLACE FUNCTION set_customer_meta_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_customer_meta_updated ON customer_meta;
CREATE TRIGGER trg_customer_meta_updated
  BEFORE UPDATE ON customer_meta
  FOR EACH ROW EXECUTE FUNCTION set_customer_meta_updated_at();

COMMIT;
