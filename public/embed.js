(function() {
  var script = document.currentScript;
  var salon = script.getAttribute('data-salon');
  if (!salon) { console.error('DDS Widget: data-salon attribute is required'); return; }

  // Use existing container if data-container is specified, otherwise create one (BUG-007)
  var containerId = script.getAttribute('data-container');
  var container;
  if (containerId) {
    container = document.getElementById(containerId);
    if (!container) { console.error('DDS Widget: container #' + containerId + ' not found'); return; }
  } else {
    var widgetIndex = document.querySelectorAll('[id^="dds-booking-widget"]').length;
    container = document.createElement('div');
    container.id = widgetIndex === 0 ? 'dds-booking-widget' : 'dds-booking-widget-' + widgetIndex;
    script.parentNode.insertBefore(container, script.nextSibling);
  }
  container.dataset.salon = salon;

  // Apply custom CSS properties from data attributes
  var props = {
    '--dds-color-primary': script.getAttribute('data-color-primary') || '#8B5CF6',
    '--dds-color-bg':      script.getAttribute('data-color-bg')      || '#FFFFFF',
    '--dds-color-text':    script.getAttribute('data-color-text')    || '#1F2937',
    '--dds-font':          script.getAttribute('data-font')          || "'Inter', system-ui, sans-serif",
    '--dds-radius':        (script.getAttribute('data-radius') || '12') + 'px',
  };
  for (var key in props) {
    container.style.setProperty(key, props[key]);
  }

  // Load widget CSS
  var link = document.createElement('link');
  link.rel = 'stylesheet';
  link.href = 'https://dds-booking.netlify.app/widget.css';
  document.head.appendChild(link);

  // Load widget JS
  var widgetScript = document.createElement('script');
  widgetScript.src = 'https://dds-booking.netlify.app/widget.js';
  widgetScript.dataset.salon = salon;
  widgetScript.dataset.container = container.id;
  document.head.appendChild(widgetScript);
})();
