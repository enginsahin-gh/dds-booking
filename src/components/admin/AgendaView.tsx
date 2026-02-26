import { useMemo, useRef, useState, useEffect } from 'react';
import { format, parseISO, addMinutes, differenceInMinutes, startOfDay, set, isSameDay } from 'date-fns';
import { toZonedTime, fromZonedTime } from 'date-fns-tz';
import { supabase } from '../../lib/supabase';
import type { Booking, Service, Staff } from '../../lib/types';

interface Props {
  date: Date;
  bookings: Booking[];
  services: Service[];
  staff: Staff[];
  timezone: string;
  onSelectBooking: (b: Booking) => void;
  onSlotClick: (staffId: string, time: string) => void;
  onBookingMoved: () => void;
}

const HOUR_START = 7;
const HOUR_END = 21;
const SLOT_HEIGHT = 48;
const MINUTES_PER_SLOT = 15;
const TIME_COL_W = 48; // px
const COL_MIN_W = 130; // px per staff column

const STATUS_COLORS: Record<string, string> = {
  confirmed: 'bg-violet-100 border-violet-400 text-violet-900',
  pending_payment: 'bg-amber-100 border-amber-400 text-amber-900',
  cancelled: 'bg-gray-100 border-gray-300 text-gray-500 opacity-50',
  no_show: 'bg-red-100 border-red-300 text-red-800',
};

function snapToQuarter(minutes: number): number {
  return Math.round(minutes / MINUTES_PER_SLOT) * MINUTES_PER_SLOT;
}

function getTimeFromY(e: React.DragEvent | React.MouseEvent, el: Element): string {
  const rect = el.getBoundingClientRect();
  const y = e.clientY - rect.top;
  const snapped = snapToQuarter((y / SLOT_HEIGHT) * 60);
  const totalMin = HOUR_START * 60 + snapped;
  const h = Math.floor(totalMin / 60);
  const m = totalMin % 60;
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
}

export function AgendaView({
  date, bookings, services, staff: allStaff, timezone,
  onSelectBooking, onSlotClick, onBookingMoved,
}: Props) {
  const [dragBooking, setDragBooking] = useState<string | null>(null);
  const [dropTarget, setDropTarget] = useState<{ staffId: string; time: string } | null>(null);

  const activeStaff = useMemo(() => allStaff.filter(s => s.is_active), [allStaff]);
  const hours = useMemo(() => Array.from({ length: HOUR_END - HOUR_START }, (_, i) => HOUR_START + i), []);
  const totalMinutes = (HOUR_END - HOUR_START) * 60;
  const gridHeight = hours.length * SLOT_HEIGHT;
  const totalGridWidth = TIME_COL_W + activeStaff.length * COL_MIN_W;

  const positionedBookings = useMemo(() => {
    return bookings
      .filter(b => b.status !== 'cancelled')
      .map(b => {
        const start = toZonedTime(parseISO(b.start_at), timezone);
        const end = toZonedTime(parseISO(b.end_at), timezone);
        const startMin = start.getHours() * 60 + start.getMinutes() - HOUR_START * 60;
        const durationMin = differenceInMinutes(end, start);
        const svc = services.find(s => s.id === b.service_id);
        return {
          booking: b, staffId: b.staff_id,
          topPx: (startMin / 60) * SLOT_HEIGHT,
          heightPx: Math.max((durationMin / 60) * SLOT_HEIGHT, 20),
          timeLabel: `${format(start, 'HH:mm')} - ${format(end, 'HH:mm')}`,
          serviceName: svc?.name || '', customerName: b.customer_name, startMin,
        };
      })
      .filter(b => b.startMin >= 0 && b.startMin < totalMinutes);
  }, [bookings, services, timezone, totalMinutes]);

  const handleDragStart = (e: React.DragEvent, bookingId: string) => {
    e.dataTransfer.effectAllowed = 'move';
    e.dataTransfer.setData('text/plain', bookingId);
    setDragBooking(bookingId);
  };

  const handleDragOver = (e: React.DragEvent, staffId: string) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    setDropTarget({ staffId, time: getTimeFromY(e, e.currentTarget) });
  };

  const handleDrop = async (e: React.DragEvent, staffId: string) => {
    e.preventDefault();
    const bookingId = e.dataTransfer.getData('text/plain');
    if (!bookingId || !dropTarget) return;
    const booking = bookings.find(b => b.id === bookingId);
    const svc = booking ? services.find(s => s.id === booking.service_id) : null;
    if (!booking || !svc) return;

    const [h, m] = dropTarget.time.split(':').map(Number);
    const newStart = fromZonedTime(set(startOfDay(date), { hours: h, minutes: m }), timezone);
    const newEnd = addMinutes(newStart, svc.duration_min);

    const { data: conflicts } = await supabase
      .from('bookings').select('id')
      .eq('staff_id', staffId).neq('status', 'cancelled').neq('id', bookingId)
      .lt('start_at', newEnd.toISOString()).gt('end_at', newStart.toISOString());

    if (conflicts && conflicts.length > 0) { setDragBooking(null); setDropTarget(null); return; }

    await supabase.from('bookings').update({ staff_id: staffId, start_at: newStart.toISOString(), end_at: newEnd.toISOString() }).eq('id', bookingId);
    setDragBooking(null); setDropTarget(null);
    onBookingMoved();
  };

  const handleSlotClick = (e: React.MouseEvent, staffId: string) => {
    if ((e.target as HTMLElement).closest('[data-booking]')) return;
    onSlotClick(staffId, getTimeFromY(e, e.currentTarget));
  };

  // Current time
  const [now, setNow] = useState(new Date());
  useEffect(() => { const i = setInterval(() => setNow(new Date()), 60000); return () => clearInterval(i); }, []);
  const nowLocal = toZonedTime(now, timezone);
  const nowMin = nowLocal.getHours() * 60 + nowLocal.getMinutes() - HOUR_START * 60;
  const showNowLine = isSameDay(date, toZonedTime(now, timezone)) && nowMin >= 0 && nowMin < totalMinutes;

  return (
    <div
      className="bg-white rounded-xl border border-gray-200 overflow-auto overscroll-none"
      style={{ maxHeight: 'calc(100dvh - 260px)' }}
    >
      {/*
        Single scroll container for both header and grid.
        Header uses position:sticky so it stays visible while scrolling vertically,
        but scrolls horizontally together with the grid.
      */}
      <div style={{ minWidth: totalGridWidth }}>
        {/* Sticky header row */}
        <div className="flex border-b border-gray-200 bg-white sticky top-0 z-20">
          <div className="border-r border-gray-100 flex-shrink-0" style={{ width: TIME_COL_W }} />
          {activeStaff.map(s => (
            <div
              key={s.id}
              className="px-2 py-2.5 text-center border-r border-gray-100 last:border-r-0 flex-shrink-0"
              style={{ width: COL_MIN_W }}
            >
              {s.photo_url ? (
                <img src={s.photo_url} alt="" className="w-7 h-7 rounded-full mx-auto mb-1 object-cover" />
              ) : (
                <div className="w-7 h-7 rounded-full mx-auto mb-1 bg-violet-100 text-violet-600 flex items-center justify-center text-xs font-bold">
                  {s.name.charAt(0)}
                </div>
              )}
              <p className="text-[11px] font-medium text-gray-900 truncate">{s.name}</p>
            </div>
          ))}
        </div>

        {/* Grid body */}
        <div className="flex relative" style={{ height: gridHeight }}>
          {/* Time column */}
          <div className="flex-shrink-0 border-r border-gray-100" style={{ width: TIME_COL_W }}>
            {hours.map(h => (
              <div key={h} className="border-b border-gray-50 text-[10px] text-gray-400 pr-1.5 text-right" style={{ height: SLOT_HEIGHT }}>
                <span className="relative -top-1.5">{`${String(h).padStart(2, '0')}:00`}</span>
              </div>
            ))}
          </div>

          {/* Staff columns */}
          {activeStaff.map(staffMember => {
            const staffBookings = positionedBookings.filter(b => b.staffId === staffMember.id);
            return (
              <div
                key={staffMember.id}
                className="relative border-r border-gray-100 last:border-r-0 cursor-pointer flex-shrink-0"
                style={{ height: gridHeight, width: COL_MIN_W }}
                onClick={e => handleSlotClick(e, staffMember.id)}
                onDragOver={e => handleDragOver(e, staffMember.id)}
                onDragLeave={() => setDropTarget(null)}
                onDrop={e => handleDrop(e, staffMember.id)}
              >
                {hours.map(h => (
                  <div key={h} className="absolute w-full border-b border-gray-50" style={{ top: (h - HOUR_START) * SLOT_HEIGHT, height: SLOT_HEIGHT }}>
                    <div className="absolute w-full border-b border-gray-50/50" style={{ top: SLOT_HEIGHT / 2 }} />
                  </div>
                ))}

                {dropTarget && dropTarget.staffId === staffMember.id && dragBooking && (
                  <div
                    className="absolute left-1 right-1 bg-violet-200/50 border-2 border-dashed border-violet-400 rounded z-10 pointer-events-none"
                    style={{
                      top: (() => { const [h, m] = dropTarget.time.split(':').map(Number); return ((h * 60 + m - HOUR_START * 60) / 60) * SLOT_HEIGHT; })(),
                      height: (() => { const b = bookings.find(x => x.id === dragBooking); const svc = b ? services.find(s => s.id === b.service_id) : null; return ((svc?.duration_min || 30) / 60) * SLOT_HEIGHT; })(),
                    }}
                  />
                )}

                {staffBookings.map(({ booking, topPx, heightPx, timeLabel, serviceName, customerName }) => (
                  <div
                    key={booking.id}
                    data-booking="true"
                    draggable
                    onDragStart={e => handleDragStart(e, booking.id)}
                    onDragEnd={() => { setDragBooking(null); setDropTarget(null); }}
                    onClick={e => { e.stopPropagation(); onSelectBooking(booking); }}
                    className={`absolute left-0.5 right-0.5 rounded-md border-l-[3px] px-1.5 py-0.5 cursor-grab active:cursor-grabbing overflow-hidden transition-shadow hover:shadow-md z-10 ${
                      STATUS_COLORS[booking.status] || STATUS_COLORS.confirmed
                    } ${dragBooking === booking.id ? 'opacity-40' : ''}`}
                    style={{ top: topPx, height: heightPx }}
                    title={`${customerName}\n${serviceName}\n${timeLabel}`}
                  >
                    <p className="text-[10px] font-medium truncate leading-tight">{customerName}</p>
                    {heightPx > 28 && <p className="text-[9px] opacity-75 truncate">{serviceName}</p>}
                    {heightPx > 42 && <p className="text-[9px] opacity-60">{timeLabel}</p>}
                  </div>
                ))}
              </div>
            );
          })}

          {showNowLine && (
            <div className="absolute right-0 h-0.5 bg-rose-500 z-[15] pointer-events-none" style={{ top: (nowMin / 60) * SLOT_HEIGHT, left: TIME_COL_W }}>
              <div className="absolute -left-1 -top-1 w-2.5 h-2.5 rounded-full bg-rose-500" />
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
