import { createRoot } from 'react-dom/client';
import { BookingWidget } from './components/widget/BookingWidget';

// Widget CSS is injected inline into Shadow DOM to ensure complete isolation
// Using ?inline to get the CSS as a string (works regardless of host page domain)
import widgetCss from './styles/widget.css?inline';

function applyTheme(el: HTMLElement, shadow: ShadowRoot) {
  const map: Record<string, string> = {
    'color-primary': '--bellure-color-primary',
    'color-bg': '--bellure-color-bg',
    'color-bg-secondary': '--bellure-color-bg-secondary',
    'color-text': '--bellure-color-text',
    'font': '--bellure-font',
    'radius': '--bellure-radius',
  };
  // Read from the host element, apply to shadow host wrapper
  const wrapper = shadow.querySelector('.bellure-shadow-host') as HTMLElement;
  if (!wrapper) return;
  for (const [attr, prop] of Object.entries(map)) {
    const val = el.dataset[attr.replace(/-([a-z])/g, (_, c) => c.toUpperCase())];
    if (val) wrapper.style.setProperty(prop, val);
  }
}

function mountWidget(container: HTMLElement, salonSlug: string) {
  // Create Shadow DOM for CSS isolation
  const shadow = container.attachShadow({ mode: 'open' });

  // Inject CSS inline into shadow DOM (no external <link> = no cross-origin issues)
  const style = document.createElement('style');
  style.textContent = widgetCss;
  shadow.appendChild(style);

  // Create render target inside shadow
  const wrapper = document.createElement('div');
  wrapper.className = 'bellure-shadow-host';
  shadow.appendChild(wrapper);

  // Apply theme vars
  applyTheme(container, shadow);

  // Mount React
  const root = createRoot(wrapper);
  root.render(<BookingWidget salonSlug={salonSlug} />);
}

// Support multiple widgets on a single page (including legacy dds- prefix)
const containers = document.querySelectorAll<HTMLElement>('[id^="bellure-booking-widget"], [id^="dds-booking-widget"]');

containers.forEach((container) => {
  const salon = container.dataset.salon
    || container.previousElementSibling?.getAttribute?.('data-salon')
    || '';

  if (!salon) {
    const script = document.querySelector(
      `script[data-container="${container.id}"]`
    ) as HTMLScriptElement | null;
    const salonSlug = script?.dataset.salon || '';
    if (salonSlug && container) mountWidget(container, salonSlug);
    return;
  }

  if (container && salon) {
    mountWidget(container, salon);
  }
});

// Fallback: single-widget legacy mode
if (containers.length === 0) {
  const script = document.querySelector('script[data-container]') as HTMLScriptElement | null;
  const containerId = script?.dataset.container || 'bellure-booking-widget';
  const container = document.getElementById(containerId) || document.getElementById('dds-booking-widget');
  const salon = script?.dataset.salon || container?.dataset.salon || '';
  if (container && salon) {
    mountWidget(container, salon);
  }
}
