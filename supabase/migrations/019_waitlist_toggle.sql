-- =============================================
-- Waitlist toggle per salon
-- =============================================

BEGIN;

ALTER TABLE salons
  ADD COLUMN IF NOT EXISTS waitlist_enabled BOOLEAN DEFAULT TRUE;

COMMIT;
