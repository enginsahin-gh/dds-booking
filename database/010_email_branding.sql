-- Migration 010: Email branding per salon
-- Adds branding fields so transactional emails match each salon's identity

ALTER TABLE salons ADD COLUMN IF NOT EXISTS brand_color TEXT DEFAULT '#8B5CF6';
ALTER TABLE salons ADD COLUMN IF NOT EXISTS brand_color_text TEXT DEFAULT '#FFFFFF';
ALTER TABLE salons ADD COLUMN IF NOT EXISTS logo_url TEXT;
ALTER TABLE salons ADD COLUMN IF NOT EXISTS email_footer_text TEXT;

-- brand_color: primary accent color for email header/buttons (hex)
-- brand_color_text: text color on brand_color background (hex)
-- logo_url: URL to salon logo (stored in Supabase Storage or external)
-- email_footer_text: optional custom footer line (e.g. "Tot snel bij Salon Amara!")

COMMENT ON COLUMN salons.brand_color IS 'Primary brand color for emails (hex, e.g. #8B5CF6)';
COMMENT ON COLUMN salons.logo_url IS 'URL to salon logo for email header';
COMMENT ON COLUMN salons.email_footer_text IS 'Custom footer text for transactional emails';
