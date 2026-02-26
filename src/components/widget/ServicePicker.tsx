import { useState, useMemo } from 'react';
import type { Service, ServiceCategory } from '../../lib/types';

interface ServicePickerProps {
  services: Service[];
  categories: ServiceCategory[];
  selectedId: string | null;
  onSelect: (service: Service) => void;
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

function ServiceCard({ service, selected, onSelect }: { service: Service; selected: boolean; onSelect: () => void }) {
  return (
    <div
      className={`dds-service-card ${selected ? 'dds-service-card--selected' : ''}`}
      onClick={onSelect}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => e.key === 'Enter' && onSelect()}
    >
      <div>
        <div className="dds-service-name">{service.name}</div>
        <div className="dds-service-meta">
          <span><ClockIcon />{service.duration_min} min</span>
        </div>
      </div>
      <div className="dds-service-price">{formatPrice(service.price_cents)}</div>
    </div>
  );
}

export function ServicePicker({ services, categories, selectedId, onSelect }: ServicePickerProps) {
  // If no categories, show flat list (backwards compatible)
  const hasCategories = categories.length > 0;

  // Start with all categories open
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

  return (
    <div className="dds-animate-in">
      <h2 className="dds-step-title">Kies een dienst</h2>
      <p className="dds-step-subtitle">Selecteer de behandeling die je wilt boeken</p>

      {!hasCategories ? (
        // Flat list (no categories)
        <div className="dds-services-grid">
          {services.map(s => (
            <ServiceCard key={s.id} service={s} selected={selectedId === s.id} onSelect={() => onSelect(s)} />
          ))}
        </div>
      ) : (
        // Accordion per category
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
                    {catServices.map(s => (
                      <ServiceCard key={s.id} service={s} selected={selectedId === s.id} onSelect={() => onSelect(s)} />
                    ))}
                  </div>
                )}
              </div>
            );
          })}

          {/* Uncategorized services */}
          {grouped!.uncategorized.length > 0 && (
            <div className="dds-category">
              <div className="dds-category-header dds-category-header--static">
                <span className="dds-category-name">Overig</span>
                <span className="dds-category-count">{grouped!.uncategorized.length}</span>
              </div>
              <div className="dds-category-services">
                {grouped!.uncategorized.map(s => (
                  <ServiceCard key={s.id} service={s} selected={selectedId === s.id} onSelect={() => onSelect(s)} />
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
