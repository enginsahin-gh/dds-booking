-- Migration 014: Subscription billing support
-- Adds subscription tracking columns and payment history table

-- Add subscription tracking columns to salons
ALTER TABLE salons
  ADD COLUMN IF NOT EXISTS subscription_activated_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS subscription_past_due_at TIMESTAMPTZ;

-- Subscription payment history
CREATE TABLE IF NOT EXISTS subscription_payments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  salon_id UUID NOT NULL REFERENCES salons(id) ON DELETE CASCADE,
  mollie_payment_id TEXT NOT NULL,
  amount_cents INTEGER NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending',
  plan_type TEXT NOT NULL,
  period_start TIMESTAMPTZ,
  period_end TIMESTAMPTZ,
  failed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Index for quick lookups
CREATE INDEX IF NOT EXISTS idx_subscription_payments_salon_id ON subscription_payments(salon_id);
CREATE INDEX IF NOT EXISTS idx_subscription_payments_mollie_id ON subscription_payments(mollie_payment_id);

-- Enable RLS
ALTER TABLE subscription_payments ENABLE ROW LEVEL SECURITY;

-- RLS policy: salon owners can read their own payment history
CREATE POLICY "Salon owners can view their payments"
  ON subscription_payments
  FOR SELECT
  USING (
    salon_id IN (
      SELECT salon_id FROM salon_users
      WHERE user_id = auth.uid() AND role = 'owner'
    )
  );

-- Service role can do everything (for webhook inserts)
CREATE POLICY "Service role full access on subscription_payments"
  ON subscription_payments
  FOR ALL
  USING (auth.role() = 'service_role');
