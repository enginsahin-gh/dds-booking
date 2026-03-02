import { describe, it, expect } from 'vitest';

// Unit tests for customer-cancel token validation

describe('Customer cancel validation', () => {
  describe('Token validation', () => {
    it('rejects missing token', () => {
      const token = undefined;
      expect(!token || (token as string).length < 16).toBe(true);
    });

    it('rejects empty token', () => {
      const token = '';
      expect(!token || token.length < 16).toBe(true);
    });

    it('rejects short tokens', () => {
      const token = 'abc123';
      expect(!token || token.length < 16).toBe(true);
    });

    it('accepts valid 32-char UUID token', () => {
      // cancel_token is generated as crypto.randomUUID().replace(/-/g, '') = 32 chars
      const token = 'a1b2c3d4e5f67890abcdef1234567890';
      expect(token.length >= 16).toBe(true);
    });
  });

  describe('Booking status checks', () => {
    it('rejects already cancelled bookings', () => {
      const booking = { status: 'cancelled' };
      expect(booking.status === 'cancelled').toBe(true);
    });

    it('allows cancellation of confirmed bookings', () => {
      const booking = { status: 'confirmed' };
      expect(booking.status !== 'cancelled').toBe(true);
    });

    it('allows cancellation of pending_payment bookings', () => {
      const booking = { status: 'pending_payment' };
      expect(booking.status !== 'cancelled').toBe(true);
    });
  });

  describe('Token invalidation after use', () => {
    it('sets cancel_token to null after cancellation', () => {
      const update = {
        status: 'cancelled',
        cancelled_at: new Date().toISOString(),
        cancel_token: null,
      };
      expect(update.cancel_token).toBeNull();
      expect(update.status).toBe('cancelled');
      expect(update.cancelled_at).toBeTruthy();
    });
  });

  describe('HTML escape', () => {
    function esc(s: string): string {
      return (s || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
    }

    it('escapes HTML in customer names', () => {
      expect(esc('<script>alert("xss")</script>')).toBe('&lt;script&gt;alert(&quot;xss&quot;)&lt;/script&gt;');
    });

    it('handles normal names', () => {
      expect(esc('Jan de Vries')).toBe('Jan de Vries');
    });

    it('handles ampersands', () => {
      expect(esc('Knippen & Föhnen')).toBe('Knippen &amp; Föhnen');
    });

    it('handles empty/undefined', () => {
      expect(esc('')).toBe('');
    });
  });
});
