import { useMemo, useState, useEffect, useRef } from 'react';
import { format, parseISO, addMinutes, differenceInMinutes, startOfDay, startOfWeek, addDays, isSameDay, set } from 'date-fns';
import { nl } from 'date-fns/locale';
import { toZonedTime, fromZonedTime } from 'date-fns-tz';
import { useAuth } from '../../hooks/useAuth';
import type { Booking, Service, Staff } from '../../lib/types';

interface Props {
  date: Date;
  bookings: Booking[];
  services: Service[];
  staff: Staff[];
  timezone: string;
  slotStepMinutes?: number;
  onSelectBooking: (b: Booking) => void;
  onSlotClick: (staffId: string, time: string) => void;
}

const HOUR_START = 7;
const HOUR_END = 21;
const BASE_SLOT_HEIGHT = 22;
const TIME_COL_W = 44;
const DAY_MIN_W = 100;

// Staff-based colors for bookings
const STAFF_COLORS = [
  { bg: 'rgba(59,78,108,0.18)', border: '#3B4E6C', text: '#22324A' },
  { bg: 'rgba(59,130,246,0.15)', border: '#3B82F6', text: '#1E40AF' },
  { bg: 'rgba(16,185,129,0.15)', border: '#10B981', text: '#065F46' },
  { bg: 'rgba(245,158,11,0.15)', border: '#F59E0B', text: '#92400E' },
  { bg: 'rgba(239,68,68,0.15)', border: '#EF4444', text: '#991B1B' },
  { bg: 'rgba(236,72,153,0.15)', border: '#EC4899', text: '#9D174D' },
];

const STATUS_LABELS: Record<string, string> = {
  confirmed: 'Bevestigd',
  pending_payment: 'Wacht op betaling',
  cancelled: 'Geannuleerd',
  no_show: 'No-show',
  completed: 'Voltooid',
};

export function WeekAgendaView({
  date, bookings, services, staff: allStaff, timezone, slotStepMinutes = 15,
  onSelectBooking, onSlotClick,
}: Props) {
  const stepMinutes = slotStepMinutes;
  const { getReadableStaffIds } = useAuth();
  const containerRef = useRef<HTMLDivElement>(null);
  const initialScrollDone = useRef(false);
  const [containerWidth, setContainerWidth] = useState(0);
  const [filterStaffId, setFilterStaffId] = useState<string | 'all'>('all');
  const [hoverCard, setHoverCard] = useState<null | {
    customerName: string;
    serviceName: string;
    staffName: string;
    timeLabel: string;
    status: string;
    x: number;
    y: number;
  }>(null);
  const activeStaff = useMemo(() => {
    const active = allStaff.filter(s => s.is_active);
    const readableIds = getReadableStaffIds();
    if (readableIds === null) return active;
    return active.filter(s => readableIds.includes(s.id));
  }, [allStaff, getReadableStaffIds]);

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const update = () => setContainerWidth(el.clientWidth || 0);
    update();
    const ro = new ResizeObserver(update);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const hours = useMemo(() => Array.from({ length: HOUR_END - HOUR_START }, (_, i) => HOUR_START + i), []);
  const totalMinutes = (HOUR_END - HOUR_START) * 60;
  const segmentsPerHour = Math.max(1, Math.round(60 / stepMinutes));
  const hourHeight = BASE_SLOT_HEIGHT * segmentsPerHour;
  const gridHeight = hours.length * hourHeight;
  const segmentHeight = BASE_SLOT_HEIGHT;
  const totalSegments = hours.length * segmentsPerHour;

  const weekStart = useMemo(() => startOfWeek(date, { weekStartsOn: 1 }), [date]);
  const weekDays = useMemo(() => Array.from({ length: 7 }, (_, i) => addDays(weekStart, i)), [weekStart]);

  // Color map per staff
  const staffColorMap = useMemo(() => {
    const map = new Map<string, typeof STAFF_COLORS[0]>();
    activeStaff.forEach((s, i) => map.set(s.id, STAFF_COLORS[i % STAFF_COLORS.length]));
    return map;
  }, [activeStaff]);

  // Filter bookings
  const filteredBookings = useMemo(() => {
    let filtered = bookings.filter(b => b.status !== 'cancelled');
    if (filterStaffId !== 'all') {
      filtered = filtered.filter(b => b.staff_id === filterStaffId);
    }
    return filtered;
  }, [bookings, filterStaffId]);

  // Position bookings per day
  const positionedByDay = useMemo(() => {
    const map = new Map<string, Array<{
      booking: Booking;
      topPx: number;
      heightPx: number;
      timeLabel: string;
      serviceName: string;
      customerName: string;
      staffName: string;
      color: typeof STAFF_COLORS[0];
    }>>();

    for (const day of weekDays) {
      const key = format(day, 'yyyy-MM-dd');
      const dayBookings = filteredBookings
        .filter(b => isSameDay(toZonedTime(parseISO(b.start_at), timezone), day))
        .map(b => {
          const start = toZonedTime(parseISO(b.start_at), timezone);
          const end = toZonedTime(parseISO(b.end_at), timezone);
          const startMin = start.getHours() * 60 + start.getMinutes() - HOUR_START * 60;
          const durationMin = differenceInMinutes(end, start);
          const svc = services.find(s => s.id === b.service_id);
          const stf = activeStaff.find(s => s.id === b.staff_id);
          return {
            booking: b,
            topPx: (startMin / 60) * hourHeight,
            heightPx: Math.max((durationMin / 60) * hourHeight, 22),
            timeLabel: `${format(start, 'HH:mm')} - ${format(end, 'HH:mm')}`,
            serviceName: svc?.name || '',
            customerName: b.customer_name,
            staffName: stf?.name || '',
            color: staffColorMap.get(b.staff_id) || STAFF_COLORS[0],
          };
        })
        .filter(b => b.topPx >= 0 && b.topPx < (totalMinutes / 60) * hourHeight);
      map.set(key, dayBookings);
    }
    return map;
  }, [weekDays, filteredBookings, services, activeStaff, timezone, staffColorMap, totalMinutes]);

  // Current time line
  const [now, setNow] = useState(new Date());
  useEffect(() => { const i = setInterval(() => setNow(new Date()), 60000); return () => clearInterval(i); }, []);
  const nowLocal = toZonedTime(now, timezone);
  const nowMin = nowLocal.getHours() * 60 + nowLocal.getMinutes() - HOUR_START * 60;

  const availableWidth = Math.max(containerWidth - TIME_COL_W, 0);
  const computedDayWidth = weekDays.length > 0 && availableWidth > 0
    ? Math.floor(availableWidth / weekDays.length)
    : DAY_MIN_W;
  const dayColWidth = Math.max(DAY_MIN_W, computedDayWidth);
  const totalGridWidth = TIME_COL_W + weekDays.length * dayColWidth;

  useEffect(() => {
    if (initialScrollDone.current) return;
    const el = containerRef.current;
    if (!el) return;
    const targetHour = 9;
    const target = Math.max(0, (targetHour - HOUR_START) * hourHeight - 24);
    el.scrollTop = target;
    initialScrollDone.current = true;
  }, [hourHeight]);

  return (
    <div>
      {/* Staff filter */}
      <div className="flex items-center gap-2 mb-2.5 overflow-x-auto pb-1">
        <button
          onClick={() => setFilterStaffId('all')}
          className={`px-2.5 py-1 text-[11px] font-semibold rounded-full whitespace-nowrap transition-all ${
            filterStaffId === 'all'
              ? 'bg-gray-900 text-white'
              : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
          }`}
        >
          Iedereen
        </button>
        {activeStaff.map((s, i) => {
          const color = STAFF_COLORS[i % STAFF_COLORS.length];
          const isActive = filterStaffId === s.id;
          return (
            <button
              key={s.id}
              onClick={() => setFilterStaffId(s.id)}
              className={`px-2.5 py-1 text-[11px] font-semibold rounded-full whitespace-nowrap transition-all ${
                isActive ? 'text-white' : 'hover:opacity-80'
              }`}
              style={{
                backgroundColor: isActive ? color.border : color.bg,
                color: isActive ? '#fff' : color.text,
              }}
            >
              {s.name}
            </button>
          );
        })}
      </div>

      {/* Grid */}
      <div
        ref={containerRef}
        onScroll={() => hoverCard && setHoverCard(null)}
        className="bg-white rounded-2xl border border-gray-200/70 overflow-auto overscroll-none shadow-[0_12px_32px_rgba(15,23,42,0.06)]"
        style={{ height: 'calc(100dvh - 170px)' }}
      >
        <div style={{ minWidth: totalGridWidth }}>
          {/* Sticky header: day names */}
          <div className="flex border-b border-gray-200/70 bg-white sticky top-0 z-20">
            <div className="border-r border-gray-100 flex-shrink-0" style={{ width: TIME_COL_W }} />
            {weekDays.map((day, idx) => {
              const isToday = isSameDay(day, toZonedTime(now, timezone));
              const dayBookings = positionedByDay.get(format(day, 'yyyy-MM-dd')) || [];
              return (
                <div
                  key={day.toISOString()}
                  className={`flex-1 px-1.5 py-2 text-center border-r border-gray-200/70 last:border-r-0 min-w-0 ${
                    isToday ? 'bg-[#EEF2F7]/80' : idx % 2 === 1 ? 'bg-gray-50/60' : ''
                  }`}
                  style={{ minWidth: DAY_MIN_W }}
                >
                  <p className="text-[10px] font-semibold text-gray-500 uppercase">{format(day, 'EEE', { locale: nl })}</p>
                  <p className={`text-[13px] font-semibold ${
                    isToday
                      ? 'bg-[#3B4E6C] text-white w-7 h-7 rounded-full flex items-center justify-center mx-auto'
                      : 'text-gray-900'
                  }`}>
                    {format(day, 'd')}
                  </p>
                  <p className="text-[9px] text-gray-400/80 mt-0.5">{dayBookings.length} afspraken</p>
                </div>
              );
            })}
          </div>

          {/* Grid body */}
          <div className="flex relative" style={{ height: gridHeight }}>
            {/* Time column */}
            <div className="flex-shrink-0 border-r border-gray-200/70" style={{ width: TIME_COL_W }}>
              {hours.map(h => (
                <div key={h} className="border-b border-gray-200/60 text-[11px] font-medium text-gray-500 pr-1 text-right" style={{ height: hourHeight }}>
                  <span className={`relative ${h === HOUR_START ? 'top-0' : '-top-1.5'}`}>{`${String(h).padStart(2, '0')}:00`}</span>
                </div>
              ))}
            </div>

            {/* Day columns */}
            {weekDays.map((day, idx) => {
              const key = format(day, 'yyyy-MM-dd');
              const dayItems = positionedByDay.get(key) || [];
              const isToday = isSameDay(day, toZonedTime(now, timezone));

              return (
                <div
                  key={key}
                  className={`relative flex-1 border-r border-gray-200/70 last:border-r-0 cursor-pointer ${
                    isToday ? 'bg-[#EEF2F7]/50' : idx % 2 === 1 ? 'bg-gray-50/40' : ''
                  }`}
                  style={{ height: gridHeight, minWidth: DAY_MIN_W }}
                  onClick={(e) => {
                    if ((e.target as HTMLElement).closest('[data-booking]')) return;
                    // Calculate time from click position
                    const rect = e.currentTarget.getBoundingClientRect();
                    const y = e.clientY - rect.top;
                    const snappedMin = Math.round(((y / hourHeight) * 60) / stepMinutes) * stepMinutes;
                    const totalMin = HOUR_START * 60 + snappedMin;
                    const h = Math.floor(totalMin / 60);
                    const m = totalMin % 60;
                    const time = `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
                    // Use first active staff or filtered staff
                    const staffId = filterStaffId !== 'all' ? filterStaffId : activeStaff[0]?.id;
                    if (staffId) onSlotClick(staffId, time);
                  }}
                >
                  {/* Hour grid lines */}
                  {Array.from({ length: totalSegments }).map((_, idx) => {
                    const isHour = idx % segmentsPerHour === 0;
                    return (
                      <div
                        key={idx}
                        className={`absolute w-full ${isHour ? 'border-b border-gray-200/60' : 'border-b border-gray-100'}`}
                        style={{ top: idx * segmentHeight }}
                      />
                    );
                  })}

                  {/* Bookings */}
                  {dayItems.map(({ booking, topPx, heightPx, timeLabel, serviceName, customerName, staffName, color }) => (
                    <div
                      key={booking.id}
                      data-booking="true"
                      onMouseEnter={(e) => {
                        if (window.matchMedia && window.matchMedia('(hover: none)').matches) return;
                        const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
                        const containerRect = containerRef.current?.getBoundingClientRect();
                        if (!containerRect) return;
                        const x = Math.min(rect.left - containerRect.left + rect.width + 8, containerRect.width - 220);
                        const y = Math.max(8, rect.top - containerRect.top);
                        setHoverCard({
                          customerName,
                          serviceName,
                          staffName,
                          timeLabel,
                          status: booking.status,
                          x,
                          y,
                        });
                      }}
                      onMouseLeave={() => setHoverCard(null)}
                      onClick={(e) => { e.stopPropagation(); onSelectBooking(booking); }}
                      className="absolute left-0.5 right-0.5 rounded-[10px] border border-black/10 border-l-[5px] px-2 py-1 cursor-pointer overflow-hidden transition-shadow shadow-[0_8px_20px_rgba(15,23,42,0.12)] hover:shadow-[0_12px_28px_rgba(15,23,42,0.18)] z-10"
                      style={{
                        top: topPx,
                        height: heightPx,
                        backgroundColor: color.bg,
                        borderColor: color.border,
                        color: color.text,
                      }}
                    >
                      <p className="text-[10px] font-semibold truncate leading-tight">{customerName}</p>
                      {heightPx > 28 && <p className="text-[9px] opacity-80 truncate">{serviceName}</p>}
                      {heightPx > 42 && <p className="text-[9px] opacity-70">{timeLabel}</p>}
                      {heightPx > 56 && filterStaffId === 'all' && (
                        <p className="text-[8px] opacity-55 truncate">{staffName}</p>
                      )}
                    </div>
                  ))}

                  {/* Current time line */}
                  {isToday && nowMin >= 0 && nowMin < totalMinutes && (
                    <div
                      id="admin-now-line"
                      className="absolute left-0 right-0 h-[3px] bg-rose-500 z-[15] pointer-events-none shadow-[0_0_10px_rgba(244,63,94,0.45)]"
                      style={{ top: (nowMin / 60) * hourHeight }}
                    >
                      <div className="absolute -left-1.5 -top-1.5 w-3 h-3 rounded-full bg-rose-500 shadow-[0_0_8px_rgba(244,63,94,0.45)]" />
                    </div>
                  )}
                </div>
              );
            })}

            {hoverCard && (
              <div
                className="absolute z-[40] pointer-events-none"
                style={{ top: hoverCard.y, left: hoverCard.x }}
              >
                <div className="w-[210px] rounded-xl border border-gray-200 bg-white px-3 py-2 shadow-[0_18px_40px_rgba(15,23,42,0.18)]">
                  <p className="text-[12px] font-semibold text-gray-900 truncate">{hoverCard.customerName}</p>
                  <p className="text-[11px] text-gray-500 truncate">{hoverCard.serviceName || '-'}</p>
                  <div className="mt-1 flex items-center gap-2 text-[10px] text-gray-400">
                    <span>{hoverCard.timeLabel}</span>
                    <span>•</span>
                    <span className="truncate">{hoverCard.staffName || '-'}</span>
                  </div>
                  <span className="mt-1 inline-flex items-center px-2 py-0.5 rounded-full bg-gray-100 text-[9px] font-semibold text-gray-600">
                    {STATUS_LABELS[hoverCard.status] || hoverCard.status}
                  </span>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
