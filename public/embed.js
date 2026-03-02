(function() {
  var script = document.currentScript;
  var salon = script.getAttribute('data-salon');
  if (!salon) { console.error('Bellure Widget: data-salon attribute is required'); return; }

  // Use existing container if data-container is specified, otherwise create one
  var containerId = script.getAttribute('data-container');
  var container;
  if (containerId) {
    container = document.getElementById(containerId);
    if (!container) { console.error('Bellure Widget: container #' + containerId + ' not found'); return; }
  } else {
    var widgetIndex = document.querySelectorAll('[id^="bellure-booking-widget"]').length;
    container = document.createElement('div');
    container.id = widgetIndex === 0 ? 'bellure-booking-widget' : 'bellure-booking-widget-' + widgetIndex;
    script.parentNode.insertBefore(container, script.nextSibling);
  }
  container.dataset.salon = salon;

  // Apply custom CSS properties from data attributes
  var props = {
    '--bellure-color-primary': script.getAttribute('data-color-primary') || '#8B5CF6',
    '--bellure-color-bg':      script.getAttribute('data-color-bg')      || '#FFFFFF',
    '--bellure-color-text':    script.getAttribute('data-color-text')    || '#1F2937',
    '--bellure-font':          script.getAttribute('data-font')          || "'Inter', system-ui, sans-serif",
    '--bellure-radius':        (script.getAttribute('data-radius') || '12') + 'px',
  };
  for (var key in props) {
    container.style.setProperty(key, props[key]);
  }

  // Load widget CSS + JS from Bellure CDN
  var baseUrl = 'https://mijn.bellure.nl';
  var link = document.createElement('link');
  link.rel = 'stylesheet';
  link.href = baseUrl + '/widget.css';
  document.head.appendChild(link);

  var widgetScript = document.createElement('script');
  widgetScript.src = baseUrl + '/widget.js';
  widgetScript.dataset.salon = salon;
  widgetScript.dataset.container = container.id;
  document.head.appendChild(widgetScript);
})();
