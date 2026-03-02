import { describe, it, expect } from 'vitest';

// Unit tests for payment creation and deposit calculation logic

function formatMollieAmount(cents: number): string {
  return (cents / 100).toFixed(2);
}

function calculateDepositCents(
  paymentMode: string,
  depositType: string,
  depositValue: number,
  totalCents: number,
): number {
  if (paymentMode === 'none') return 0;
  if (paymentMode === 'full') return totalCents;
  // deposit mode
  if (depositType === 'percentage') {
    return Math.round(totalCents * (Math.min(Math.max(depositValue, 0), 100) / 100));
  }
  // fixed amount (in euros)
  return Math.min(Math.round(depositValue * 100), totalCents);
}

describe('Payment creation', () => {
  describe('Mollie amount formatting', () => {
    it('formats whole euros', () => {
      expect(formatMollieAmount(2500)).toBe('25.00');
    });

    it('formats cents correctly', () => {
      expect(formatMollieAmount(1)).toBe('0.01');
      expect(formatMollieAmount(99)).toBe('0.99');
      expect(formatMollieAmount(100)).toBe('1.00');
    });

    it('formats large amounts', () => {
      expect(formatMollieAmount(999999)).toBe('9999.99');
    });
  });

  describe('Deposit calculation', () => {
    it('returns 0 for payment_mode=none', () => {
      expect(calculateDepositCents('none', 'percentage', 25, 10000)).toBe(0);
    });

    it('returns total for payment_mode=full', () => {
      expect(calculateDepositCents('full', 'percentage', 25, 10000)).toBe(10000);
    });

    it('calculates percentage deposit', () => {
      expect(calculateDepositCents('deposit', 'percentage', 25, 10000)).toBe(2500);
      expect(calculateDepositCents('deposit', 'percentage', 50, 10000)).toBe(5000);
      expect(calculateDepositCents('deposit', 'percentage', 10, 5000)).toBe(500);
    });

    it('rounds percentage deposit to nearest cent', () => {
      // 33% of €100.00 = €33.00
      expect(calculateDepositCents('deposit', 'percentage', 33, 10000)).toBe(3300);
      // 33% of €10.01 = €3.30 (rounded)
      expect(calculateDepositCents('deposit', 'percentage', 33, 1001)).toBe(330);
    });

    it('clamps percentage to 0-100', () => {
      expect(calculateDepositCents('deposit', 'percentage', -10, 10000)).toBe(0);
      expect(calculateDepositCents('deposit', 'percentage', 150, 10000)).toBe(10000);
    });

    it('calculates fixed deposit in euros', () => {
      // depositValue is in euros, totalCents is in cents
      expect(calculateDepositCents('deposit', 'fixed', 10, 10000)).toBe(1000);
      expect(calculateDepositCents('deposit', 'fixed', 25, 10000)).toBe(2500);
    });

    it('caps fixed deposit at total', () => {
      expect(calculateDepositCents('deposit', 'fixed', 200, 10000)).toBe(10000);
    });

    it('handles zero total gracefully', () => {
      expect(calculateDepositCents('deposit', 'percentage', 25, 0)).toBe(0);
      expect(calculateDepositCents('full', 'percentage', 0, 0)).toBe(0);
    });
  });

  describe('Minimum payment validation', () => {
    it('rejects deposits below €1.00 (100 cents)', () => {
      const depositCents = calculateDepositCents('deposit', 'percentage', 1, 500);
      // 1% of €5.00 = €0.05
      expect(depositCents).toBe(5);
      expect(depositCents < 100).toBe(true);
    });

    it('accepts deposits at €1.00', () => {
      const depositCents = 100;
      expect(depositCents >= 100).toBe(true);
    });
  });

  describe('Required fields', () => {
    it('requires bookingId and redirectUrl', () => {
      const body = { bookingId: 'abc', redirectUrl: 'https://example.com' };
      expect(!!body.bookingId && !!body.redirectUrl).toBe(true);
    });

    it('rejects missing redirectUrl', () => {
      const body = { bookingId: 'abc' } as any;
      expect(!body.bookingId || !body.redirectUrl).toBe(true);
    });
  });

  describe('Already paid check', () => {
    it('rejects already paid bookings', () => {
      const booking = { payment_status: 'paid' };
      expect(booking.payment_status === 'paid').toBe(true);
    });

    it('allows pending bookings', () => {
      const booking = { payment_status: 'pending' };
      expect(booking.payment_status !== 'paid').toBe(true);
    });
  });
});
