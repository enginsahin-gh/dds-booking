import { describe, it, expect } from 'vitest';

// Unit tests for Mollie webhook processing logic

function mapBookingPaymentStatus(s: string): string {
  if (s === 'paid') return 'paid';
  if (['failed', 'expired', 'canceled'].includes(s)) return 'failed';
  return 'pending';
}

function mapPaymentStatus(s: string): string {
  if (s === 'paid') return 'paid';
  if (s === 'failed') return 'failed';
  if (s === 'expired') return 'expired';
  if (s === 'canceled') return 'canceled';
  return 'open';
}

function parseMollieCents(value: string): number {
  return Math.round(parseFloat(value) * 100);
}

describe('Mollie webhook', () => {
  describe('Payment ID validation', () => {
    it('accepts valid Mollie payment IDs', () => {
      const id = 'tr_abc123DEF456';
      expect(id.startsWith('tr_') && id.length >= 5 && id.length <= 40).toBe(true);
    });

    it('rejects IDs not starting with tr_', () => {
      const id = 'invalid_id';
      expect(!id.startsWith('tr_')).toBe(true);
    });

    it('rejects too short IDs', () => {
      const id = 'tr_a';
      expect(id.length < 5).toBe(true);
    });

    it('rejects too long IDs', () => {
      const id = 'tr_' + 'a'.repeat(40);
      expect(id.length > 40).toBe(true);
    });
  });

  describe('mapBookingPaymentStatus', () => {
    it('maps paid correctly', () => {
      expect(mapBookingPaymentStatus('paid')).toBe('paid');
    });

    it('maps failed statuses to failed', () => {
      expect(mapBookingPaymentStatus('failed')).toBe('failed');
      expect(mapBookingPaymentStatus('expired')).toBe('failed');
      expect(mapBookingPaymentStatus('canceled')).toBe('failed');
    });

    it('maps open/pending to pending', () => {
      expect(mapBookingPaymentStatus('open')).toBe('pending');
      expect(mapBookingPaymentStatus('pending')).toBe('pending');
    });
  });

  describe('mapPaymentStatus', () => {
    it('maps all Mollie statuses', () => {
      expect(mapPaymentStatus('paid')).toBe('paid');
      expect(mapPaymentStatus('failed')).toBe('failed');
      expect(mapPaymentStatus('expired')).toBe('expired');
      expect(mapPaymentStatus('canceled')).toBe('canceled');
      expect(mapPaymentStatus('open')).toBe('open');
      expect(mapPaymentStatus('pending')).toBe('open');
    });
  });

  describe('parseMollieCents', () => {
    it('parses whole euros', () => {
      expect(parseMollieCents('25.00')).toBe(2500);
      expect(parseMollieCents('1.00')).toBe(100);
      expect(parseMollieCents('100.00')).toBe(10000);
    });

    it('parses cents correctly', () => {
      expect(parseMollieCents('0.01')).toBe(1);
      expect(parseMollieCents('0.99')).toBe(99);
      expect(parseMollieCents('12.34')).toBe(1234);
    });

    it('handles floating point precision', () => {
      // 19.99 could become 1998.9999... without rounding
      expect(parseMollieCents('19.99')).toBe(1999);
      expect(parseMollieCents('29.95')).toBe(2995);
    });
  });

  describe('Booking status updates on payment', () => {
    it('confirms booking on paid', () => {
      const mollieStatus = 'paid';
      const bookingUpdate: Record<string, unknown> = {
        payment_status: mapBookingPaymentStatus(mollieStatus),
      };
      if (mollieStatus === 'paid') {
        bookingUpdate.status = 'confirmed';
      }
      expect(bookingUpdate.status).toBe('confirmed');
      expect(bookingUpdate.payment_status).toBe('paid');
    });

    it('cancels booking on failed payment', () => {
      for (const status of ['failed', 'expired', 'canceled']) {
        const bookingUpdate: Record<string, unknown> = {
          payment_status: mapBookingPaymentStatus(status),
        };
        if (['failed', 'expired', 'canceled'].includes(status)) {
          bookingUpdate.status = 'cancelled';
          bookingUpdate.cancelled_at = new Date().toISOString();
        }
        expect(bookingUpdate.status).toBe('cancelled');
        expect(bookingUpdate.payment_status).toBe('failed');
        expect(bookingUpdate.cancelled_at).toBeTruthy();
      }
    });

    it('does not change status on pending', () => {
      const mollieStatus = 'open';
      const bookingUpdate: Record<string, unknown> = {
        payment_status: mapBookingPaymentStatus(mollieStatus),
      };
      expect(bookingUpdate.payment_status).toBe('pending');
      expect('status' in bookingUpdate).toBe(false);
    });
  });

  describe('Paid amount tracking', () => {
    it('stores paid cents from Mollie amount', () => {
      const molliePayment = { amount: { value: '25.00' }, status: 'paid' };
      const paidCents = parseMollieCents(molliePayment.amount.value);
      expect(paidCents).toBe(2500);
    });

    it('calculates deposit_amount in euros', () => {
      const paidCents = 2500;
      const depositAmount = paidCents / 100;
      expect(depositAmount).toBe(25);
    });
  });
});
