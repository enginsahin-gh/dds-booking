import { useRef, useState, useEffect, useCallback } from 'react';

interface Tab {
  id: string;
  label: string;
  icon?: React.ReactNode;
}

interface TabsProps {
  tabs: Tab[];
  activeTab: string;
  onChange: (id: string) => void;
}

export function Tabs({ tabs, activeTab, onChange }: TabsProps) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const [canScrollLeft, setCanScrollLeft] = useState(false);
  const [canScrollRight, setCanScrollRight] = useState(false);

  const checkScroll = useCallback(() => {
    const el = scrollRef.current;
    if (!el) return;
    setCanScrollLeft(el.scrollLeft > 4);
    setCanScrollRight(el.scrollLeft < el.scrollWidth - el.clientWidth - 4);
  }, []);

  useEffect(() => {
    checkScroll();
    const el = scrollRef.current;
    if (!el) return;
    el.addEventListener('scroll', checkScroll, { passive: true });
    const ro = new ResizeObserver(checkScroll);
    ro.observe(el);
    return () => { el.removeEventListener('scroll', checkScroll); ro.disconnect(); };
  }, [checkScroll]);

  // Scroll active tab into view on mount / tab change
  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    const active = el.querySelector('[data-active="true"]') as HTMLElement;
    if (active) {
      const left = active.offsetLeft - el.offsetLeft - 8;
      el.scrollTo({ left, behavior: 'smooth' });
    }
  }, [activeTab]);

  return (
    <div className="relative">
      {/* Left fade */}
      {canScrollLeft && (
        <div className="absolute left-0 top-0 bottom-0 w-8 bg-gradient-to-r from-gray-100/90 to-transparent z-10 rounded-l-xl pointer-events-none" />
      )}
      {/* Right fade */}
      {canScrollRight && (
        <div className="absolute right-0 top-0 bottom-0 w-8 bg-gradient-to-l from-gray-100/90 to-transparent z-10 rounded-r-xl pointer-events-none" />
      )}

      <div
        ref={scrollRef}
        className="flex gap-0.5 p-1 bg-gray-100/80 rounded-xl overflow-x-auto no-scrollbar scroll-smooth"
      >
        {tabs.map(tab => (
          <button
            key={tab.id}
            data-active={activeTab === tab.id}
            onClick={() => onChange(tab.id)}
            className={`
              flex items-center gap-1.5 px-3 py-2 rounded-[10px] text-[12px] sm:text-[13px] font-medium whitespace-nowrap
              transition-all duration-200 ease-out flex-shrink-0
              ${activeTab === tab.id
                ? 'bg-white text-gray-900 shadow-sm'
                : 'text-gray-500 hover:text-gray-700 hover:bg-white/50'
              }
            `}
          >
            {tab.icon && <span className="flex-shrink-0 hidden sm:inline-flex">{tab.icon}</span>}
            {tab.label}
          </button>
        ))}
      </div>
    </div>
  );
}

interface TabPanelProps {
  active: boolean;
  children: React.ReactNode;
}

export function TabPanel({ active, children }: TabPanelProps) {
  if (!active) return null;
  return <div className="animate-in fade-in duration-200">{children}</div>;
}
