import type { Service } from '../../lib/types';

interface ServicePickerProps {
  services: Service[];
  selectedId: string | null;
  onSelect: (service: Service) => void;
}

function formatPrice(cents: number): string {
  return `€${(cents / 100).toFixed(2).replace('.', ',')}`;
}

export function ServicePicker({ services, selectedId, onSelect }: ServicePickerProps) {
  return (
    <div className="dds-animate-in">
      <h2 className="dds-step-title">Kies een dienst</h2>
      <p className="dds-step-subtitle">Selecteer de behandeling die je wilt boeken</p>
      <div className="dds-services-grid">
        {services.map((service) => (
          <div
            key={service.id}
            className={`dds-service-card ${selectedId === service.id ? 'dds-service-card--selected' : ''}`}
            onClick={() => onSelect(service)}
            role="button"
            tabIndex={0}
            onKeyDown={(e) => e.key === 'Enter' && onSelect(service)}
          >
            <div>
              <div className="dds-service-name">{service.name}</div>
              <div className="dds-service-meta">
                <span><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{verticalAlign: '-2px', marginRight: '4px'}}><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>{service.duration_min} min</span>
              </div>
            </div>
            <div className="dds-service-price">{formatPrice(service.price_cents)}</div>
          </div>
        ))}
      </div>
    </div>
  );
}
