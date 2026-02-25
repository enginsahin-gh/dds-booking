import type { Salon } from './types';

/**
 * Calculate the deposit amount in cents based on salon configuration.
 */
export function calculateDepositCents(salon: Salon, totalCents: number): number {
  if (salon.payment_mode === 'none') return 0;
  if (salon.payment_mode === 'full') return totalCents;

  // deposit mode
  if (salon.deposit_type === 'percentage') {
    const pct = Math.min(Math.max(salon.deposit_value, 0), 100);
    return Math.round(totalCents * (pct / 100));
  }

  // fixed amount in euros → convert to cents
  const fixedCents = Math.round(salon.deposit_value * 100);
  // Never charge more than the total
  return Math.min(fixedCents, totalCents);
}

/**
 * Format cents to display string (e.g., 1050 → "€10,50")
 */
export function formatCents(cents: number): string {
  return `\u20AC${(cents / 100).toFixed(2).replace('.', ',')}`;
}

/**
 * Check if salon requires online payment.
 */
export function requiresPayment(salon: Salon): boolean {
  return salon.payment_mode !== 'none';
}
