-- ============================================
-- 016: Google Calendar 2-Way Sync
-- OAuth tokens stored in salon_secrets (RLS locked, service_role only)
-- Sync tracking on bookings and staff_blocks
-- ============================================

-- Google Calendar OAuth tokens per salon
ALTER TABLE salon_secrets ADD COLUMN IF NOT EXISTS google_access_token TEXT;
ALTER TABLE salon_secrets ADD COLUMN IF NOT EXISTS google_refresh_token TEXT;
ALTER TABLE salon_secrets ADD COLUMN IF NOT EXISTS google_token_expires_at TIMESTAMPTZ;
ALTER TABLE salon_secrets ADD COLUMN IF NOT EXISTS google_calendar_id TEXT; -- which calendar to sync with

-- Display fields on salons (non-sensitive, visible to frontend)
ALTER TABLE salons ADD COLUMN IF NOT EXISTS google_calendar_connected_at TIMESTAMPTZ;
ALTER TABLE salons ADD COLUMN IF NOT EXISTS google_calendar_name TEXT;
ALTER TABLE salons ADD COLUMN IF NOT EXISTS google_calendar_sync_enabled BOOLEAN DEFAULT true;
ALTER TABLE salons ADD COLUMN IF NOT EXISTS google_calendar_last_sync_at TIMESTAMPTZ;

-- Sync tracking on bookings
ALTER TABLE bookings ADD COLUMN IF NOT EXISTS google_event_id TEXT;

-- Staff blocks from Google Calendar
ALTER TABLE staff_blocks ADD COLUMN IF NOT EXISTS google_event_id TEXT;
ALTER TABLE staff_blocks ADD COLUMN IF NOT EXISTS source TEXT DEFAULT 'manual'; -- 'manual' | 'google'
