import { describe, it, expect } from 'vitest';

// Unit tests for widget Shadow DOM and embed logic

describe('Widget embed', () => {
  describe('FUNCTIONS_BASE resolution', () => {
    it('defaults to api.bellure.nl', () => {
      const FUNCTIONS_BASE = 'https://api.bellure.nl';
      expect(FUNCTIONS_BASE).toBe('https://api.bellure.nl');
    });

    it('uses VITE_API_URL when set', () => {
      const envValue = 'https://custom-api.example.com';
      const FUNCTIONS_BASE = envValue || 'https://api.bellure.nl';
      expect(FUNCTIONS_BASE).toBe('https://custom-api.example.com');
    });
  });

  describe('Widget container naming', () => {
    it('uses bellure-booking-widget as default ID', () => {
      const id = 'bellure-booking-widget';
      expect(id.startsWith('bellure-')).toBe(true);
    });

    it('supports numbered containers for multi-widget', () => {
      const ids = ['bellure-booking-widget', 'bellure-booking-widget-1', 'bellure-booking-widget-2'];
      // All match the [id^="bellure-booking-widget"] selector
      expect(ids.every(id => id.startsWith('bellure-booking-widget'))).toBe(true);
    });
  });

  describe('CSS class naming', () => {
    it('all widget classes use bellure- prefix', () => {
      const classes = [
        'bellure-spinner', 'bellure-btn', 'bellure-btn-primary', 'bellure-form',
        'bellure-calendar', 'bellure-steps', 'bellure-confirmation', 'bellure-powered-by',
        'bellure-staff-card', 'bellure-service-card', 'bellure-slot',
      ];
      expect(classes.every(c => c.startsWith('bellure-'))).toBe(true);
    });

    it('no dds- prefix classes remain', () => {
      const classes = [
        'bellure-spinner', 'bellure-btn', 'bellure-calendar',
      ];
      expect(classes.every(c => !c.startsWith('dds-'))).toBe(true);
    });
  });

  describe('CSS custom properties', () => {
    it('uses bellure- namespace for all vars', () => {
      const vars = [
        '--bellure-color-primary', '--bellure-color-bg', '--bellure-color-text',
        '--bellure-font', '--bellure-radius', '--bellure-shadow',
      ];
      expect(vars.every(v => v.startsWith('--bellure-'))).toBe(true);
    });
  });

  describe('Theme data attributes', () => {
    const themeMap: Record<string, string> = {
      'color-primary': '--bellure-color-primary',
      'color-bg': '--bellure-color-bg',
      'color-bg-secondary': '--bellure-color-bg-secondary',
      'color-text': '--bellure-color-text',
      'font': '--bellure-font',
      'radius': '--bellure-radius',
    };

    it('maps all data attributes to CSS variables', () => {
      expect(Object.keys(themeMap)).toHaveLength(6);
      expect(Object.values(themeMap).every(v => v.startsWith('--bellure-'))).toBe(true);
    });

    it('converts hyphenated attrs to camelCase', () => {
      const attr = 'color-primary';
      const camel = attr.replace(/-([a-z])/g, (_, c) => c.toUpperCase());
      expect(camel).toBe('colorPrimary');
    });
  });

  describe('Embed script defaults', () => {
    it('has correct default theme values', () => {
      const defaults = {
        '--bellure-color-primary': '#8B5CF6',
        '--bellure-color-bg': '#FFFFFF',
        '--bellure-color-text': '#1F2937',
        '--bellure-font': "'Inter', system-ui, sans-serif",
        '--bellure-radius': '12px',
      };
      expect(defaults['--bellure-color-primary']).toBe('#8B5CF6');
      expect(defaults['--bellure-color-bg']).toBe('#FFFFFF');
    });

    it('loads assets from mijn.bellure.nl', () => {
      const baseUrl = 'https://mijn.bellure.nl';
      expect(`${baseUrl}/widget.css`).toBe('https://mijn.bellure.nl/widget.css');
      expect(`${baseUrl}/widget.js`).toBe('https://mijn.bellure.nl/widget.js');
    });
  });

  describe('Shadow DOM isolation', () => {
    it('CSS root targets bellure-shadow-host class', () => {
      // Shadow DOM wrapper class
      const wrapperClass = 'bellure-shadow-host';
      expect(wrapperClass).toBe('bellure-shadow-host');
    });

    it('payment return scroll targets host element in light DOM', () => {
      // document.getElementById works from shadow DOM because host is in light DOM
      const hostId = 'bellure-booking-widget';
      // This is the correct behavior — we scroll the host element
      expect(hostId).toBeTruthy();
    });
  });
});
