import { useMemo, useState, useEffect } from 'react';
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
const SLOT_HEIGHT = 48;
const TIME_COL_W = 44;
const DAY_MIN_W = 100;

// Staff-based colors for bookings
const STAFF_COLORS = [
  { bg: 'rgba(139,92,246,0.15)', border: '#8B5CF6', text: '#5B21B6' },
  { bg: 'rgba(59,130,246,0.15)', border: '#3B82F6', text: '#1E40AF' },
  { bg: 'rgba(16,185,129,0.15)', border: '#10B981', text: '#065F46' },
  { bg: 'rgba(245,158,11,0.15)', border: '#F59E0B', text: '#92400E' },
  { bg: 'rgba(239,68,68,0.15)', border: '#EF4444', text: '#991B1B' },
  { bg: 'rgba(236,72,153,0.15)', border: '#EC4899', text: '#9D174D' },
];

export function WeekAgendaView({
  date, bookings, services, staff: allStaff, timezone, slotStepMinutes = 15,
  onSelectBooking, onSlotClick,
}: Props) {
  const stepMinutes = slotStepMinutes;
  const { getReadableStaffIds } = useAuth();
  const [filterStaffId, setFilterStaffId] = useState<string | 'all'>('all');
  const activeStaff = useMemo(() => {
    const active = allStaff.filter(s => s.is_active);
    const readableIds = getReadableStaffIds();
    if (readableIds === null) return active;
    return active.filter(s => readableIds.includes(s.id));
  }, [allStaff, getReadableStaffIds]);

  const hours = useMemo(() => Array.from({ length: HOUR_END - HOUR_START }, (_, i) => HOUR_START + i), []);
  const gridHeight = hours.length * SLOT_HEIGHT;
  const totalMinutes = (HOUR_END - HOUR_START) * 60;

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
            topPx: (startMin / 60) * SLOT_HEIGHT,
            heightPx: Math.max((durationMin / 60) * SLOT_HEIGHT, 20),
            timeLabel: `${format(start, 'HH:mm')} - ${format(end, 'HH:mm')}`,
            serviceName: svc?.name || '',
            customerName: b.customer_name,
            staffName: stf?.name || '',
            color: staffColorMap.get(b.staff_id) || STAFF_COLORS[0],
          };
        })
        .filter(b => b.topPx >= 0 && b.topPx < (totalMinutes / 60) * SLOT_HEIGHT);
      map.set(key, dayBookings);
    }
    return map;
  }, [weekDays, filteredBookings, services, activeStaff, timezone, staffColorMap, totalMinutes]);

  // Current time line
  const [now, setNow] = useState(new Date());
  useEffect(() => { const i = setInterval(() => setNow(new Date()), 60000); return () => clearInterval(i); }, []);
  const nowLocal = toZonedTime(now, timezone);
  const nowMin = nowLocal.getHours() * 60 + nowLocal.getMinutes() - HOUR_START * 60;

  const totalGridWidth = TIME_COL_W + 7 * DAY_MIN_W;

  return (
    <div>
      {/* Staff filter */}
      <div className="flex items-center gap-2 mb-3 overflow-x-auto pb-1">
        <button
          onClick={() => setFilterStaffId('all')}
          className={`px-3 py-1.5 text-xs font-medium rounded-full whitespace-nowrap transition-all ${
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
              className={`px-3 py-1.5 text-xs font-medium rounded-full whitespace-nowrap transition-all ${
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
        className="bg-white rounded-xl border border-gray-200 overflow-auto overscroll-none"
        style={{ maxHeight: 'calc(100dvh - 300px)' }}
      >
        <div style={{ minWidth: totalGridWidth }}>
          {/* Sticky header: day names */}
          <div className="flex border-b border-gray-200 bg-white sticky top-0 z-20">
            <div className="border-r border-gray-100 flex-shrink-0" style={{ width: TIME_COL_W }} />
            {weekDays.map(day => {
              const isToday = isSameDay(day, toZonedTime(now, timezone));
              const dayBookings = positionedByDay.get(format(day, 'yyyy-MM-dd')) || [];
              return (
                <div
                  key={day.toISOString()}
                  className={`flex-1 px-1 py-2 text-center border-r border-gray-100 last:border-r-0 min-w-0 ${
                    isToday ? 'bg-violet-50/50' : ''
                  }`}
                  style={{ minWidth: DAY_MIN_W }}
                >
                  <p className="text-[10px] text-gray-400 uppercase">{format(day, 'EEE', { locale: nl })}</p>
                  <p className={`text-sm font-semibold ${
                    isToday
                      ? 'bg-violet-600 text-white w-7 h-7 rounded-full flex items-center justify-center mx-auto'
                      : 'text-gray-900'
                  }`}>
                    {format(day, 'd')}
                  </p>
                  <p className="text-[9px] text-gray-400 mt-0.5">{dayBookings.length} afspraken</p>
                </div>
              );
            })}
          </div>

          {/* Grid body */}
          <div className="flex relative" style={{ height: gridHeight }}>
            {/* Time column */}
            <div className="flex-shrink-0 border-r border-gray-100" style={{ width: TIME_COL_W }}>
              {hours.map(h => (
                <div key={h} className="border-b border-gray-50 text-[10px] text-gray-400 pr-1 text-right" style={{ height: SLOT_HEIGHT }}>
                  <span className="relative -top-1.5">{`${String(h).padStart(2, '0')}:00`}</span>
                </div>
              ))}
            </div>

            {/* Day columns */}
            {weekDays.map(day => {
              const key = format(day, 'yyyy-MM-dd');
              const dayItems = positionedByDay.get(key) || [];
              const isToday = isSameDay(day, toZonedTime(now, timezone));

              return (
                <div
                  key={key}
                  className={`relative flex-1 border-r border-gray-100 last:border-r-0 cursor-pointer ${
                    isToday ? 'bg-violet-50/20' : ''
                  }`}
                  style={{ height: gridHeight, minWidth: DAY_MIN_W }}
                  onClick={(e) => {
                    if ((e.target as HTMLElement).closest('[data-booking]')) return;
                    // Calculate time from click position
                    const rect = e.currentTarget.getBoundingClientRect();
                    const y = e.clientY - rect.top;
                    const snappedMin = Math.round(((y / SLOT_HEIGHT) * 60) / stepMinutes) * stepMinutes;
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
                  {hours.map(h => (
                    <div key={h} className="absolute w-full border-b border-gray-50" style={{ top: (h - HOUR_START) * SLOT_HEIGHT, height: SLOT_HEIGHT }}>
                      <div className="absolute w-full border-b border-gray-50/50" style={{ top: SLOT_HEIGHT / 2 }} />
                    </div>
                  ))}

                  {/* Bookings */}
                  {dayItems.map(({ booking, topPx, heightPx, timeLabel, serviceName, customerName, staffName, color }) => (
                    <div
                      key={booking.id}
                      data-booking="true"
                      onClick={(e) => { e.stopPropagation(); onSelectBooking(booking); }}
                      className="absolute left-0.5 right-0.5 rounded-md border-l-[3px] px-1 py-0.5 cursor-pointer overflow-hidden transition-shadow hover:shadow-md z-10"
                      style={{
                        top: topPx,
                        height: heightPx,
                        backgroundColor: color.bg,
                        borderColor: color.border,
                        color: color.text,
                      }}
                      title={`${customerName}\n${serviceName}\n${staffName}\n${timeLabel}`}
                    >
                      <p className="text-[9px] font-semibold truncate leading-tight">{customerName}</p>
                      {heightPx > 28 && <p className="text-[8px] opacity-75 truncate">{serviceName}</p>}
                      {heightPx > 42 && <p className="text-[8px] opacity-60">{timeLabel}</p>}
                      {heightPx > 56 && filterStaffId === 'all' && (
                        <p className="text-[8px] opacity-50 truncate">{staffName}</p>
                      )}
                    </div>
                  ))}

                  {/* Current time line */}
                  {isToday && nowMin >= 0 && nowMin < totalMinutes && (
                    <div
                      className="absolute left-0 right-0 h-0.5 bg-rose-500 z-[15] pointer-events-none"
                      style={{ top: (nowMin / 60) * SLOT_HEIGHT }}
                    >
                      <div className="absolute -left-1 -top-1 w-2.5 h-2.5 rounded-full bg-rose-500" />
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}
