-- =============================================
-- Migration 026: Add optional payment mode
-- =============================================

BEGIN;

ALTER TABLE salons DROP CONSTRAINT IF EXISTS salons_payment_mode_check;
ALTER TABLE salons
  ADD CONSTRAINT salons_payment_mode_check
  CHECK (payment_mode = ANY (ARRAY['none'::text, 'optional'::text, 'deposit'::text, 'full'::text]));

COMMIT;
