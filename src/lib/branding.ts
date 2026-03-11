/**
 * Bellure Branding System
 *
 * Centraal branding model dat herbruikt wordt door:
 * - Email templates (header, knoppen, kleuren)
 * - Widget defaults (als salon geen custom CSS heeft)
 * - Admin UI (preview, settings)
 * - Toekomstig: facturen, QR codes, social cards
 */

export interface SalonBranding {
  // Core colors
  brandColor: string;          // Primary brand color (hex)
  brandColorText: string;      // Text on brand color (hex)

  // Gradient
  gradientEnabled: boolean;
  gradientFrom: string;        // Start color
  gradientTo: string;          // End color
  gradientDirection: string;   // CSS angle (e.g. "135deg", "to right")

  // Assets
  logoUrl: string | null;

  // Text
  salonName: string;
  footerText: string | null;
}

export interface EmailPreferences {
  confirmation: boolean;
  notification: boolean;
  cancellation: boolean;
  cancellation_notification: boolean;
  reminder_24h: boolean;
  reminder_1h: boolean;
  review_request: boolean;
}

export const DEFAULT_BRANDING: Omit<SalonBranding, 'salonName'> = {
  brandColor: '#3B4E6C',
  brandColorText: '#FFFFFF',
  gradientEnabled: false,
  gradientFrom: '#3B4E6C',
  gradientTo: '#4F607A',
  gradientDirection: '135deg',
  logoUrl: null,
  footerText: null,
};

export const DEFAULT_EMAIL_PREFERENCES: EmailPreferences = {
  confirmation: true,
  notification: true,
  cancellation: true,
  cancellation_notification: true,
  reminder_24h: true,
  reminder_1h: true,
  review_request: false,
};

/** All email types with human-readable labels */
export const EMAIL_TYPES: { key: keyof EmailPreferences; label: string; description: string; recipient: 'klant' | 'salon' }[] = [
  { key: 'confirmation', label: 'Bevestiging', description: 'Bevestiging van de afspraak met alle details, agenda-link en annuleringslink.', recipient: 'klant' },
  { key: 'notification', label: 'Nieuwe boeking melding', description: 'Melding aan de salon bij elke nieuwe boeking met klantgegevens.', recipient: 'salon' },
  { key: 'cancellation', label: 'Annulering', description: 'Bevestiging van de annulering met eventuele terugbetalingsinfo.', recipient: 'klant' },
  { key: 'cancellation_notification', label: 'Annulering melding', description: 'Melding aan de salon wanneer een klant annuleert.', recipient: 'salon' },
  { key: 'reminder_24h', label: 'Herinnering (24 uur)', description: 'Herinnering een dag voor de afspraak met annuleringsoptie.', recipient: 'klant' },
  { key: 'reminder_1h', label: 'Herinnering (1 uur)', description: 'Korte herinnering een uur voor de afspraak.', recipient: 'klant' },
  { key: 'review_request', label: 'Review verzoek', description: 'Vraag om een Google review na het bezoek.', recipient: 'klant' },
];

/** Get CSS background value from branding */
export function getBrandBackground(b: SalonBranding): string {
  if (b.gradientEnabled && b.gradientFrom && b.gradientTo) {
    return `linear-gradient(${b.gradientDirection}, ${b.gradientFrom}, ${b.gradientTo})`;
  }
  return b.brandColor;
}

/** Preset gradient combos that look great */
export const GRADIENT_PRESETS: { name: string; from: string; to: string; direction: string }[] = [
  { name: 'Violet Dream', from: '#8B5CF6', to: '#6366F1', direction: '135deg' },
  { name: 'Sunset', from: '#F97316', to: '#EC4899', direction: '135deg' },
  { name: 'Ocean', from: '#06B6D4', to: '#3B82F6', direction: '135deg' },
  { name: 'Forest', from: '#10B981', to: '#059669', direction: '135deg' },
  { name: 'Rose Gold', from: '#F43F5E', to: '#FB923C', direction: '135deg' },
  { name: 'Midnight', from: '#1E293B', to: '#475569', direction: '135deg' },
  { name: 'Lavender', from: '#A78BFA', to: '#C084FC', direction: '135deg' },
  { name: 'Warm Sand', from: '#D4A574', to: '#C2956B', direction: '135deg' },
];

/**
 * Generate color suggestions based on a primary color.
 * Uses HSL manipulation for complementary, analogous, and triadic colors.
 */
export function suggestColors(hex: string): { label: string; color: string }[] {
  const hsl = hexToHsl(hex);
  if (!hsl) return [];

  const [h, s, l] = hsl;
  const suggestions: { label: string; color: string }[] = [];

  // Complementary (opposite on color wheel)
  suggestions.push({ label: 'Complementair', color: hslToHex([(h + 180) % 360, s, l]) });

  // Analogous (neighbors on color wheel)
  suggestions.push({ label: 'Analoog warm', color: hslToHex([(h + 30) % 360, s, l]) });
  suggestions.push({ label: 'Analoog koel', color: hslToHex([(h + 330) % 360, s, l]) });

  // Triadic
  suggestions.push({ label: 'Triadisch', color: hslToHex([(h + 120) % 360, s, l]) });

  // Lighter variant
  suggestions.push({ label: 'Lichter', color: hslToHex([h, Math.max(s - 10, 0), Math.min(l + 15, 95)]) });

  // Darker variant
  suggestions.push({ label: 'Donkerder', color: hslToHex([h, Math.min(s + 10, 100), Math.max(l - 15, 10)]) });

  return suggestions;
}

/** Suggest text color (white or dark) based on background luminance */
export function suggestTextColor(bgHex: string): string {
  const rgb = hexToRgb(bgHex);
  if (!rgb) return '#FFFFFF';
  // Relative luminance (WCAG formula)
  const luminance = (0.299 * rgb[0] + 0.587 * rgb[1] + 0.114 * rgb[2]) / 255;
  return luminance > 0.5 ? '#1E293B' : '#FFFFFF';
}

// --- Color conversion utilities ---

function hexToRgb(hex: string): [number, number, number] | null {
  const m = hex.replace('#', '').match(/^([0-9a-f]{2})([0-9a-f]{2})([0-9a-f]{2})$/i);
  if (!m) return null;
  return [parseInt(m[1], 16), parseInt(m[2], 16), parseInt(m[3], 16)];
}

function hexToHsl(hex: string): [number, number, number] | null {
  const rgb = hexToRgb(hex);
  if (!rgb) return null;
  const [r, g, b] = rgb.map(v => v / 255);
  const max = Math.max(r, g, b), min = Math.min(r, g, b);
  const l = (max + min) / 2;
  if (max === min) return [0, 0, l * 100];
  const d = max - min;
  const s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
  let h = 0;
  if (max === r) h = ((g - b) / d + (g < b ? 6 : 0)) / 6;
  else if (max === g) h = ((b - r) / d + 2) / 6;
  else h = ((r - g) / d + 4) / 6;
  return [Math.round(h * 360), Math.round(s * 100), Math.round(l * 100)];
}

function hslToHex(hsl: [number, number, number]): string {
  const [h, s, l] = [hsl[0], hsl[1] / 100, hsl[2] / 100];
  const a = s * Math.min(l, 1 - l);
  const f = (n: number) => {
    const k = (n + h / 30) % 12;
    const color = l - a * Math.max(Math.min(k - 3, 9 - k, 1), -1);
    return Math.round(255 * color).toString(16).padStart(2, '0');
  };
  return `#${f(0)}${f(8)}${f(4)}`;
}
