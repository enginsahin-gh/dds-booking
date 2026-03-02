import { describe, it, expect } from 'vitest';

// Tests for email template helper functions (from send-email.ts)

function formatDate(dateStr: string): string {
  return new Date(dateStr).toLocaleDateString('nl-NL', {
    weekday: 'long', year: 'numeric', month: 'long', day: 'numeric',
    timeZone: 'Europe/Amsterdam',
  });
}

function formatTime(dateStr: string): string {
  return new Date(dateStr).toLocaleTimeString('nl-NL', {
    hour: '2-digit', minute: '2-digit',
    timeZone: 'Europe/Amsterdam',
  });
}

function formatPrice(cents: number): string {
  return `€${(cents / 100).toFixed(2).replace('.', ',')}`;
}

function esc(str: string): string {
  return str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

function googleCalendarUrl(d: { startIso: string; endIso: string; salonName: string; serviceName: string }): string {
  const startDt = d.startIso.replace(/[-:]/g, '').replace('.000Z', 'Z').replace(/\.\d{3}Z/, 'Z');
  const endDt = d.endIso.replace(/[-:]/g, '').replace('.000Z', 'Z').replace(/\.\d{3}Z/, 'Z');
  const params = new URLSearchParams({
    action: 'TEMPLATE',
    text: `${d.serviceName} bij ${d.salonName}`,
    dates: `${startDt}/${endDt}`,
  });
  return `https://calendar.google.com/calendar/render?${params.toString()}`;
}

describe('Email utilities', () => {
  describe('formatDate', () => {
    it('formats date in Dutch', () => {
      const result = formatDate('2026-03-10T10:00:00Z');
      expect(result).toContain('2026');
      expect(result).toContain('maart');
    });
  });

  describe('formatTime', () => {
    it('formats time in HH:mm', () => {
      // 10:00 UTC = 11:00 CET
      const result = formatTime('2026-03-10T10:00:00Z');
      expect(result).toMatch(/\d{2}:\d{2}/);
    });
  });

  describe('formatPrice', () => {
    it('formats cents to euros with comma', () => {
      expect(formatPrice(2500)).toBe('€25,00');
      expect(formatPrice(0)).toBe('€0,00');
      expect(formatPrice(1)).toBe('€0,01');
      expect(formatPrice(9999)).toBe('€99,99');
      expect(formatPrice(100000)).toBe('€1000,00');
    });
  });

  describe('esc (HTML escape)', () => {
    it('escapes special HTML characters', () => {
      expect(esc('<script>')).toBe('&lt;script&gt;');
      expect(esc('a & b')).toBe('a &amp; b');
      expect(esc('"quoted"')).toBe('&quot;quoted&quot;');
    });

    it('leaves plain text unchanged', () => {
      expect(esc('Hello World')).toBe('Hello World');
      expect(esc('Kapsalon Orange')).toBe('Kapsalon Orange');
    });
  });

  describe('Google Calendar URL', () => {
    it('generates valid calendar URL', () => {
      const url = googleCalendarUrl({
        startIso: '2026-03-10T10:00:00.000Z',
        endIso: '2026-03-10T10:30:00.000Z',
        salonName: 'Salon Amara',
        serviceName: 'Knippen',
      });

      expect(url).toContain('calendar.google.com');
      expect(url).toContain('action=TEMPLATE');
      expect(url).toContain('Knippen');
      expect(url).toContain('Salon+Amara');
      // Dates should not have dashes or colons
      expect(url).toContain('20260310T100000Z');
    });
  });
});
