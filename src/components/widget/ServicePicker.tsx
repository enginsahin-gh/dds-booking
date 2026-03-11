import { useState, useMemo } from 'react';
import type { Service, ServiceAddon, ServiceCategory } from '../../lib/types';

interface ServicePickerProps {
  services: Service[];
  categories: ServiceCategory[];
  addons: ServiceAddon[];
  selectedAddonIds: string[];
  selectedIds: string[];
  onSelect: (services: Service[]) => void;
  onToggleAddon: (addonId: string) => void;
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
      className={`bellure-service-card ${selected ? 'bellure-service-card--selected' : ''}`}
      onClick={onToggle}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => e.key === 'Enter' && onToggle()}
    >
      <div style={{ flex: 1 }}>
        <div className="bellure-service-title-row">
          <div className="bellure-service-name">{service.name}</div>
          {service.tags && service.tags.length > 0 && (
            <div className="bellure-service-tags">
              {service.tags.map(tag => (
                <span key={tag} className="bellure-service-tag">{tag}</span>
              ))}
            </div>
          )}
        </div>
        <div className="bellure-service-meta">
          <span><ClockIcon />{service.duration_min} min</span>
        </div>
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
        <div className="bellure-service-price">{formatPrice(service.price_cents)}</div>
        <div className={`bellure-service-check ${selected ? 'bellure-service-check--active' : ''}`}>
          {selected && <CheckIcon />}
        </div>
      </div>
    </div>
  );
}

function AddonCard({ addon, serviceName, selected, onToggle }: { addon: ServiceAddon; serviceName?: string; selected: boolean; onToggle: () => void }) {
  return (
    <button type="button" className={`bellure-addon-card ${selected ? 'bellure-addon-card--selected' : ''}`} onClick={onToggle}>
      <div className="bellure-addon-body">
        <div className="bellure-addon-name">{addon.name}</div>
        <div className="bellure-addon-meta">
          {serviceName && <span>{serviceName}</span>}
          <span>{addon.duration_min || 0} min</span>
        </div>
      </div>
      <div className="bellure-addon-price">{formatPrice(addon.price_cents)}</div>
      <div className={`bellure-addon-check ${selected ? 'bellure-addon-check--active' : ''}`}>
        {selected && <CheckIcon />}
      </div>
    </button>
  );
}

export function ServicePicker({ services, categories, addons, selectedAddonIds, selectedIds, onSelect, onToggleAddon, onContinue }: ServicePickerProps) {
  const hasCategories = categories.length > 0;
  const [openCats, setOpenCats] = useState<Set<string>>(() => new Set());

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

  const selectedServices = services.filter(s => selectedIds.includes(s.id));
  const serviceIds = new Set(selectedServices.map(s => s.id));
  const serviceMap = new Map(services.map(s => [s.id, s]));

  const addonsByService = useMemo(() => {
    const map = new Map<string, ServiceAddon[]>();
    for (const addon of addons) {
      if (!map.has(addon.service_id)) map.set(addon.service_id, []);
      map.get(addon.service_id)!.push(addon);
    }
    return map;
  }, [addons]);

  const selectedByCategory = useMemo(() => {
    const map = new Map<string, number>();
    for (const service of services) {
      if (!selectedIds.includes(service.id)) continue;
      const key = service.category_id || 'uncategorized';
      map.set(key, (map.get(key) || 0) + 1);
    }
    return map;
  }, [services, selectedIds]);

  const availableAddons = useMemo(() => {
    if (serviceIds.size === 0) return [];
    return addons.filter(a => serviceIds.has(a.service_id));
  }, [addons, serviceIds]);

  const selectedAddons = addons.filter(a => selectedAddonIds.includes(a.id));

  const totalMinutes = selectedServices.reduce((sum, s) => sum + s.duration_min, 0)
    + selectedAddons.reduce((sum, a) => sum + (a.duration_min || 0), 0);
  const totalCents = selectedServices.reduce((sum, s) => sum + s.price_cents, 0)
    + selectedAddons.reduce((sum, a) => sum + a.price_cents, 0);

  const renderServices = (serviceList: Service[]) =>
    serviceList.map(s => {
      const selected = selectedIds.includes(s.id);
      const inlineAddons = addonsByService.get(s.id) || [];
      return (
        <div key={s.id} className="bellure-service-block">
          <ServiceCard
            service={s}
            selected={selected}
            onToggle={() => toggleService(s)}
          />
          {selected && inlineAddons.length > 0 && (
            <div className="bellure-addons-inline">
              <div className="bellure-addons-inline-title">Extra's bij {s.name}</div>
              <div className="bellure-addons-inline-list">
                {inlineAddons.map(addon => (
                  <button
                    key={addon.id}
                    type="button"
                    className={`bellure-addon-inline ${selectedAddonIds.includes(addon.id) ? 'bellure-addon-inline--selected' : ''}`}
                    onClick={() => onToggleAddon(addon.id)}
                  >
                    <div className="bellure-addon-inline-body">
                      <div className="bellure-addon-inline-name">{addon.name}</div>
                      <div className="bellure-addon-inline-meta">{addon.duration_min || 0} min</div>
                    </div>
                    <div className="bellure-addon-inline-price">{formatPrice(addon.price_cents)}</div>
                    <div className={`bellure-addon-inline-check ${selectedAddonIds.includes(addon.id) ? 'bellure-addon-inline-check--active' : ''}`}>
                      {selectedAddonIds.includes(addon.id) && <CheckIcon />}
                    </div>
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>
      );
    });

  return (
    <div className="bellure-animate-in">
      <h2 className="bellure-step-title">Kies je behandeling(en)</h2>
      <p className="bellure-step-subtitle">Je kunt meerdere behandelingen combineren</p>

      {!hasCategories ? (
        <div className="bellure-services-grid">
          {renderServices(services)}
        </div>
      ) : (
        <div className="bellure-categories">
          {categories.map(cat => {
            const catServices = grouped!.map.get(cat.id) || [];
            if (catServices.length === 0) return null;
            const isOpen = openCats.has(cat.id);
            const selectedCount = selectedByCategory.get(cat.id) || 0;

            return (
              <div key={cat.id} className={`bellure-category ${selectedCount > 0 ? 'bellure-category--selected' : ''}`}>
                <button
                  className={`bellure-category-header ${isOpen ? 'bellure-category-header--open' : ''} ${selectedCount > 0 ? 'bellure-category-header--selected' : ''}`}
                  onClick={() => toggleCat(cat.id)}
                  type="button"
                >
                  <span className="bellure-category-name">{cat.name}</span>
                  {selectedCount > 0 && (
                    <span className="bellure-category-selected">{selectedCount} gekozen</span>
                  )}
                  <span className="bellure-category-count">{catServices.length}</span>
                  <ChevronIcon open={isOpen} />
                </button>
                {isOpen && (
                  <div className="bellure-category-services">
                    {renderServices(catServices)}
                  </div>
                )}
              </div>
            );
          })}

          {grouped!.uncategorized.length > 0 && (
            <div className={`bellure-category ${(selectedByCategory.get('uncategorized') || 0) > 0 ? 'bellure-category--selected' : ''}`}>
              <div className={`bellure-category-header bellure-category-header--static ${(selectedByCategory.get('uncategorized') || 0) > 0 ? 'bellure-category-header--selected' : ''}`}>
                <span className="bellure-category-name">Overig</span>
                {(selectedByCategory.get('uncategorized') || 0) > 0 && (
                  <span className="bellure-category-selected">{selectedByCategory.get('uncategorized')} gekozen</span>
                )}
                <span className="bellure-category-count">{grouped!.uncategorized.length}</span>
              </div>
              <div className="bellure-category-services">
                {renderServices(grouped!.uncategorized)}
              </div>
            </div>
          )}
        </div>
      )}


      {selectedIds.length > 0 && (
        <div className="bellure-selection-footer">
          <div className="bellure-selection-summary">
            <span className="bellure-selection-count">{selectedIds.length} behandeling{selectedIds.length > 1 ? 'en' : ''}</span>
            <span className="bellure-selection-detail">{totalMinutes} min &middot; {formatPrice(totalCents)}</span>
          </div>
          <button className="bellure-btn bellure-btn-primary" onClick={onContinue}>
            Verder <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{verticalAlign: "-3px"}}><polyline points="5 12 19 12"/><polyline points="12 5 19 12 12 19"/></svg>
          </button>
        </div>
      )}
    </div>
  );
}
