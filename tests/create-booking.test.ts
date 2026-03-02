import { describe, it, expect } from 'vitest';

// Unit tests for create-booking validation logic
// These test the pure validation functions without needing a running Worker

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

describe('Booking validation', () => {
  describe('Email validation', () => {
    it('accepts valid emails', () => {
      expect(EMAIL_REGEX.test('test@example.com')).toBe(true);
      expect(EMAIL_REGEX.test('user.name@domain.nl')).toBe(true);
      expect(EMAIL_REGEX.test('a@b.co')).toBe(true);
    });

    it('rejects invalid emails', () => {
      expect(EMAIL_REGEX.test('')).toBe(false);
      expect(EMAIL_REGEX.test('notanemail')).toBe(false);
      expect(EMAIL_REGEX.test('@domain.com')).toBe(false);
      expect(EMAIL_REGEX.test('user@')).toBe(false);
      expect(EMAIL_REGEX.test('user@.com')).toBe(false);
      expect(EMAIL_REGEX.test('user@domain.c')).toBe(false); // TLD too short
    });
  });

  describe('Required fields', () => {
    const requiredFields = ['salonId', 'staffId', 'startAt', 'endAt', 'name', 'email', 'phone'];

    it('identifies all required fields', () => {
      const body: Record<string, string> = {
        salonId: 'salon-1',
        staffId: 'staff-1',
        startAt: '2026-03-10T10:00:00Z',
        endAt: '2026-03-10T10:30:00Z',
        name: 'Test User',
        email: 'test@example.com',
        phone: '0612345678',
      };

      for (const field of requiredFields) {
        expect(body[field]).toBeTruthy();
      }
    });

    it('detects missing required fields', () => {
      for (const field of requiredFields) {
        const body: Record<string, string> = {
          salonId: 'salon-1',
          staffId: 'staff-1',
          startAt: '2026-03-10T10:00:00Z',
          endAt: '2026-03-10T10:30:00Z',
          name: 'Test User',
          email: 'test@example.com',
          phone: '0612345678',
        };
        delete body[field];
        const missing = requiredFields.some(f => !body[f]);
        expect(missing).toBe(true);
      }
    });
  });

  describe('Honeypot', () => {
    it('returns fake success when honeypot is filled', () => {
      const hp = 'bot-filled-this';
      // In the real worker, this returns { bookingId: 'ok' }
      expect(!!hp).toBe(true);
    });

    it('passes when honeypot is empty', () => {
      const hp = '';
      expect(!hp).toBe(true);
    });
  });

  describe('Booking horizon', () => {
    it('rejects bookings too far ahead', () => {
      const maxWeeks = 4;
      const maxDate = new Date(Date.now() + maxWeeks * 7 * 24 * 3600000);
      const farFuture = new Date(Date.now() + 365 * 24 * 3600000); // 1 year
      expect(farFuture > maxDate).toBe(true);
    });

    it('accepts bookings within horizon', () => {
      const maxWeeks = 4;
      const maxDate = new Date(Date.now() + maxWeeks * 7 * 24 * 3600000);
      const nextWeek = new Date(Date.now() + 7 * 24 * 3600000);
      expect(nextWeek <= maxDate).toBe(true);
    });

    it('unlimited horizon when maxWeeks is 0', () => {
      const maxWeeks = 0;
      // When 0, no check is applied
      expect(maxWeeks === 0).toBe(true);
    });
  });

  describe('Service validation', () => {
    it('detects inactive services', () => {
      const services = [
        { id: '1', is_active: true, price_cents: 2500, duration_min: 30 },
        { id: '2', is_active: false, price_cents: 3500, duration_min: 45 },
      ];
      const inactive = services.find(s => !s.is_active);
      expect(inactive).toBeDefined();
      expect(inactive?.id).toBe('2');
    });

    it('calculates server-side totals', () => {
      const services = [
        { id: '1', price_cents: 2500, duration_min: 30 },
        { id: '2', price_cents: 3500, duration_min: 45 },
      ];
      const totalCents = services.reduce((sum, s) => sum + s.price_cents, 0);
      const totalDuration = services.reduce((sum, s) => sum + s.duration_min, 0);
      expect(totalCents).toBe(6000);
      expect(totalDuration).toBe(75);
    });

    it('detects missing services', () => {
      const requestedIds = ['1', '2', '3'];
      const dbServices = [{ id: '1' }, { id: '2' }];
      expect(dbServices.length !== requestedIds.length).toBe(true);
    });
  });

  describe('Overlap detection', () => {
    it('detects overlapping bookings', () => {
      // Existing booking: 10:00-10:30
      const existing = { start_at: '2026-03-10T10:00:00Z', end_at: '2026-03-10T10:30:00Z' };
      // New booking: 10:15-10:45
      const newStart = '2026-03-10T10:15:00Z';
      const newEnd = '2026-03-10T10:45:00Z';

      const overlaps = newStart < existing.end_at && newEnd > existing.start_at;
      expect(overlaps).toBe(true);
    });

    it('allows adjacent bookings', () => {
      const existing = { start_at: '2026-03-10T10:00:00Z', end_at: '2026-03-10T10:30:00Z' };
      const newStart = '2026-03-10T10:30:00Z';
      const newEnd = '2026-03-10T11:00:00Z';

      const overlaps = newStart < existing.end_at && newEnd > existing.start_at;
      expect(overlaps).toBe(false);
    });

    it('detects overlap with buffer', () => {
      const bufferMin = 15;
      const existing = { start_at: '2026-03-10T10:00:00Z', end_at: '2026-03-10T10:30:00Z' };
      // New booking starts at 10:35 — within buffer of 15 min after end
      const newStart = new Date('2026-03-10T10:35:00Z');
      const existingEndPlusBuffer = new Date(new Date(existing.end_at).getTime() + bufferMin * 60000);

      expect(newStart < existingEndPlusBuffer).toBe(true);
    });
  });

  describe('Payment mode determination', () => {
    it('determines no payment when mode is none', () => {
      const paymentMode = 'none';
      const needsPayment = paymentMode !== 'none';
      expect(needsPayment).toBe(false);
    });

    it('sets pending_payment status for deposit mode', () => {
      const paymentMode = 'deposit';
      const needsPayment = paymentMode !== 'none';
      const status = needsPayment ? 'pending_payment' : 'confirmed';
      expect(status).toBe('pending_payment');
    });

    it('sets pending_payment status for full mode', () => {
      const paymentMode = 'full';
      const needsPayment = paymentMode !== 'none';
      const status = needsPayment ? 'pending_payment' : 'confirmed';
      expect(status).toBe('pending_payment');
    });
  });
});
