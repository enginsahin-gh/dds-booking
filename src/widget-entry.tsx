import { createRoot } from 'react-dom/client';
import { BookingWidget } from './components/widget/BookingWidget';
import './styles/widget.css';

// Apply theme from data attributes (data-color-primary, data-color-bg, data-color-text, data-font)
function applyTheme(el: HTMLElement) {
  const map: Record<string, string> = {
    'color-primary': '--dds-color-primary',
    'color-bg': '--dds-color-bg',
    'color-bg-secondary': '--dds-color-bg-secondary',
    'color-text': '--dds-color-text',
    'font': '--dds-font',
    'radius': '--dds-radius',
  };
  for (const [attr, prop] of Object.entries(map)) {
    const val = el.dataset[attr.replace(/-([a-z])/g, (_, c) => c.toUpperCase())];
    if (val) el.style.setProperty(prop, val);
  }
}

// Support multiple widgets on a single page (BUG-007)
const containers = document.querySelectorAll<HTMLElement>('[id^="dds-booking-widget"]');

containers.forEach((container) => {
  const salon = container.dataset.salon
    || container.previousElementSibling?.getAttribute?.('data-salon')
    || '';

  // Also check the script tag that loaded this widget
  if (!salon) {
    const script = document.querySelector(
      `script[data-container="${container.id}"]`
    ) as HTMLScriptElement | null;
    const salonSlug = script?.dataset.salon || '';
    if (salonSlug && container) {
      const root = createRoot(container);
      root.render(<BookingWidget salonSlug={salonSlug} />);
    }
    return;
  }

  if (container && salon) {
    applyTheme(container);
    const root = createRoot(container);
    root.render(<BookingWidget salonSlug={salon} />);
  }
});

// Fallback: single-widget legacy mode
if (containers.length === 0) {
  const script = document.querySelector('script[data-container]') as HTMLScriptElement | null;
  const containerId = script?.dataset.container || 'dds-booking-widget';
  const container = document.getElementById(containerId);
  const salon = script?.dataset.salon || container?.dataset.salon || '';
  if (container && salon) {
    applyTheme(container);
    const root = createRoot(container);
    root.render(<BookingWidget salonSlug={salon} />);
  }
}
