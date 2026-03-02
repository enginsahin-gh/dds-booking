import { useState, useMemo } from 'react';
import type { Service, ServiceCategory } from '../../lib/types';

interface ServicePickerProps {
  services: Service[];
  categories: ServiceCategory[];
  selectedIds: string[];
  onSelect: (services: Service[]) => void;
  onContinue: () => void;
}

function formatPrice(cents: number): string {
  return `€${(cents / 100).toFixed(2).replace('.', ',')}`;
}

function ClockIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{verticalAlign: '-2px', marginRight: '4px'}}>
      <circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/>
    </svg>
  );
}

function CheckIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="20 6 9 17 4 12"/>
    </svg>
  );
}

function ChevronIcon({ open }: { open: boolean }) {
  return (
    <svg
      width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"
      style={{ transition: 'transform 200ms ease', transform: open ? 'rotate(90deg)' : 'rotate(0deg)' }}
    >
      <polyline points="9 18 15 12 9 6"/>
    </svg>
  );
}

function ServiceCard({ service, selected, onToggle }: { service: Service; selected: boolean; onToggle: () => void }) {
  return (
    <div
      className={`dds-service-card ${selected ? 'dds-service-card--selected' : ''}`}
      onClick={onToggle}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => e.key === 'Enter' && onToggle()}
    >
      <div style={{ flex: 1 }}>
        <div className="dds-service-name">{service.name}</div>
        <div className="dds-service-meta">
          <span><ClockIcon />{service.duration_min} min</span>
        </div>
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
        <div className="dds-service-price">{formatPrice(service.price_cents)}</div>
        <div className={`dds-service-check ${selected ? 'dds-service-check--active' : ''}`}>
          {selected && <CheckIcon />}
        </div>
      </div>
    </div>
  );
}

export function ServicePicker({ services, categories, selectedIds, onSelect, onContinue }: ServicePickerProps) {
  const hasCategories = categories.length > 0;
  const [openCats, setOpenCats] = useState<Set<string>>(() => new Set(categories.map(c => c.id)));

  const grouped = useMemo(() => {
    if (!hasCategories) return null;
    const map = new Map<string, Service[]>();
    const uncategorized: Service[] = [];

    for (const s of services) {
      if (s.category_id) {
        if (!map.has(s.category_id)) map.set(s.category_id, []);
        map.get(s.category_id)!.push(s);
      } else {
        uncategorized.push(s);
      }
    }
    return { map, uncategorized };
  }, [services, hasCategories]);

  const toggleCat = (id: string) => {
    setOpenCats(prev => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  };

  const toggleService = (service: Service) => {
    const current = services.filter(s => selectedIds.includes(s.id));
    const isSelected = selectedIds.includes(service.id);
    if (isSelected) {
      onSelect(current.filter(s => s.id !== service.id));
    } else {
      onSelect([...current, service]);
    }
  };

  // Calculate totals for selected services
  const selectedServices = services.filter(s => selectedIds.includes(s.id));
  const totalMinutes = selectedServices.reduce((sum, s) => sum + s.duration_min, 0);
  const totalCents = selectedServices.reduce((sum, s) => sum + s.price_cents, 0);

  const renderServices = (serviceList: Service[]) =>
    serviceList.map(s => (
      <ServiceCard
        key={s.id}
        service={s}
        selected={selectedIds.includes(s.id)}
        onToggle={() => toggleService(s)}
      />
    ));

  return (
    <div className="dds-animate-in">
      <h2 className="dds-step-title">Kies je behandeling(en)</h2>
      <p className="dds-step-subtitle">Je kunt meerdere behandelingen combineren</p>

      {!hasCategories ? (
        <div className="dds-services-grid">
          {renderServices(services)}
        </div>
      ) : (
        <div className="dds-categories">
          {categories.map(cat => {
            const catServices = grouped!.map.get(cat.id) || [];
            if (catServices.length === 0) return null;
            const isOpen = openCats.has(cat.id);

            return (
              <div key={cat.id} className="dds-category">
                <button
                  className="dds-category-header"
                  onClick={() => toggleCat(cat.id)}
                  type="button"
                >
                  <span className="dds-category-name">{cat.name}</span>
                  <span className="dds-category-count">{catServices.length}</span>
                  <ChevronIcon open={isOpen} />
                </button>
                {isOpen && (
                  <div className="dds-category-services">
                    {renderServices(catServices)}
                  </div>
                )}
              </div>
            );
          })}

          {grouped!.uncategorized.length > 0 && (
            <div className="dds-category">
              <div className="dds-category-header dds-category-header--static">
                <span className="dds-category-name">Overig</span>
                <span className="dds-category-count">{grouped!.uncategorized.length}</span>
              </div>
              <div className="dds-category-services">
                {renderServices(grouped!.uncategorized)}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Sticky footer with selection summary */}
      {selectedIds.length > 0 && (
        <div className="dds-selection-footer">
          <div className="dds-selection-summary">
            <span className="dds-selection-count">{selectedIds.length} behandeling{selectedIds.length > 1 ? 'en' : ''}</span>
            <span className="dds-selection-detail">{totalMinutes} min &middot; {formatPrice(totalCents)}</span>
          </div>
          <button className="dds-btn dds-btn-primary" onClick={onContinue}>
            Verder <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{verticalAlign: "-3px"}}><polyline points="5 12 19 12"/><polyline points="12 5 19 12 12 19"/></svg>
          </button>
        </div>
      )}
    </div>
  );
}
