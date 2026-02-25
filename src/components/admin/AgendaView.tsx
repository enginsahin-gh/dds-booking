import { useMemo, useRef, useCallback, useState, useEffect } from 'react';
import { format, parseISO, addMinutes, differenceInMinutes, startOfDay, set, isSameDay } from 'date-fns';
import { nl } from 'date-fns/locale';
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
const SLOT_HEIGHT = 48; // px per hour
const MINUTES_PER_SLOT = 15;

const STATUS_COLORS: Record<string, string> = {
  confirmed: 'bg-violet-100 border-violet-400 text-violet-900',
  pending_payment: 'bg-amber-100 border-amber-400 text-amber-900',
  cancelled: 'bg-gray-100 border-gray-300 text-gray-500 opacity-50',
  no_show: 'bg-red-100 border-red-300 text-red-800',
};

function snapToQuarter(minutes: number): number {
  return Math.round(minutes / MINUTES_PER_SLOT) * MINUTES_PER_SLOT;
}

export function AgendaView({
  date,
  bookings,
  services,
  staff: allStaff,
  timezone,
  onSelectBooking,
  onSlotClick,
  onBookingMoved,
}: Props) {
  const gridRef = useRef<HTMLDivElement>(null);
  const [dragBooking, setDragBooking] = useState<string | null>(null);
  const [dropTarget, setDropTarget] = useState<{ staffId: string; time: string } | null>(null);

  const activeStaff = useMemo(() => allStaff.filter(s => s.is_active), [allStaff]);
  const hours = useMemo(() => Array.from({ length: HOUR_END - HOUR_START }, (_, i) => HOUR_START + i), []);
  const totalMinutes = (HOUR_END - HOUR_START) * 60;

  // Convert booking times to local timezone positions
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
          booking: b,
          staffId: b.staff_id,
          topPx: (startMin / 60) * SLOT_HEIGHT,
          heightPx: Math.max((durationMin / 60) * SLOT_HEIGHT, 20),
          timeLabel: `${format(start, 'HH:mm')} - ${format(end, 'HH:mm')}`,
          serviceName: svc?.name || '',
          customerName: b.customer_name,
          startMin,
          durationMin,
        };
      })
      .filter(b => b.startMin >= 0 && b.startMin < totalMinutes);
  }, [bookings, services, timezone, totalMinutes]);

  // Drag and drop handlers
  const handleDragStart = (e: React.DragEvent, bookingId: string) => {
    e.dataTransfer.effectAllowed = 'move';
    e.dataTransfer.setData('text/plain', bookingId);
    setDragBooking(bookingId);
  };

  const handleDragOver = (e: React.DragEvent, staffId: string) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';

    const grid = gridRef.current;
    if (!grid) return;

    const rect = e.currentTarget.getBoundingClientRect();
    const y = e.clientY - rect.top;
    const minuteOffset = (y / SLOT_HEIGHT) * 60;
    const snapped = snapToQuarter(minuteOffset);
    const totalMin = HOUR_START * 60 + snapped;
    const h = Math.floor(totalMin / 60);
    const m = totalMin % 60;
    const timeStr = `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;

    setDropTarget({ staffId, time: timeStr });
  };

  const handleDragLeave = () => {
    setDropTarget(null);
  };

  const handleDrop = async (e: React.DragEvent, staffId: string) => {
    e.preventDefault();
    const bookingId = e.dataTransfer.getData('text/plain');
    if (!bookingId || !dropTarget) return;

    const booking = bookings.find(b => b.id === bookingId);
    if (!booking) return;

    const svc = services.find(s => s.id === booking.service_id);
    if (!svc) return;

    const [hours, minutes] = dropTarget.time.split(':').map(Number);
    const localDate = set(startOfDay(date), { hours, minutes });
    const newStart = fromZonedTime(localDate, timezone);
    const newEnd = addMinutes(newStart, svc.duration_min);

    // Check conflicts (exclude self)
    const { data: conflicts } = await supabase
      .from('bookings')
      .select('id')
      .eq('staff_id', staffId)
      .neq('status', 'cancelled')
      .neq('id', bookingId)
      .lt('start_at', newEnd.toISOString())
      .gt('end_at', newStart.toISOString());

    if (conflicts && conflicts.length > 0) {
      setDragBooking(null);
      setDropTarget(null);
      return; // Silently reject — conflict
    }

    await supabase
      .from('bookings')
      .update({
        staff_id: staffId,
        start_at: newStart.toISOString(),
        end_at: newEnd.toISOString(),
      })
      .eq('id', bookingId);

    setDragBooking(null);
    setDropTarget(null);
    onBookingMoved();
  };

  const handleDragEnd = () => {
    setDragBooking(null);
    setDropTarget(null);
  };

  // Click on empty slot
  const handleSlotClick = (e: React.MouseEvent, staffId: string) => {
    // Only handle clicks on the column itself, not on booking blocks
    if ((e.target as HTMLElement).closest('[data-booking]')) return;

    const rect = e.currentTarget.getBoundingClientRect();
    const y = e.clientY - rect.top;
    const minuteOffset = (y / SLOT_HEIGHT) * 60;
    const snapped = snapToQuarter(minuteOffset);
    const totalMin = HOUR_START * 60 + snapped;
    const h = Math.floor(totalMin / 60);
    const m = totalMin % 60;
    const timeStr = `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;

    onSlotClick(staffId, timeStr);
  };

  // Current time indicator
  const [now, setNow] = useState(new Date());
  useEffect(() => {
    const interval = setInterval(() => setNow(new Date()), 60000);
    return () => clearInterval(interval);
  }, []);

  const nowLocal = toZonedTime(now, timezone);
  const nowMin = nowLocal.getHours() * 60 + nowLocal.getMinutes() - HOUR_START * 60;
  const showNowLine = isSameDay(date, toZonedTime(now, timezone)) && nowMin >= 0 && nowMin < totalMinutes;

  return (
    <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
      {/* Header: staff names */}
      <div className="flex border-b border-gray-200 sticky top-0 bg-white z-20">
        <div className="w-14 flex-shrink-0 border-r border-gray-100" />
        {activeStaff.map(s => (
          <div
            key={s.id}
            className="flex-1 min-w-[140px] px-3 py-2 text-center border-r border-gray-100 last:border-r-0"
          >
            <p className="text-sm font-medium text-gray-900 truncate">{s.name}</p>
          </div>
        ))}
      </div>

      {/* Grid */}
      <div className="flex overflow-x-auto" ref={gridRef}>
        {/* Time column */}
        <div className="w-14 flex-shrink-0 border-r border-gray-100">
          {hours.map(h => (
            <div
              key={h}
              className="border-b border-gray-50 text-xs text-gray-400 pr-2 text-right"
              style={{ height: SLOT_HEIGHT }}
            >
              <span className="relative -top-2">{`${String(h).padStart(2, '0')}:00`}</span>
            </div>
          ))}
        </div>

        {/* Staff columns */}
        {activeStaff.map(staffMember => {
          const staffBookings = positionedBookings.filter(b => b.staffId === staffMember.id);

          return (
            <div
              key={staffMember.id}
              className="flex-1 min-w-[140px] relative border-r border-gray-100 last:border-r-0 cursor-pointer"
              style={{ height: hours.length * SLOT_HEIGHT }}
              onClick={e => handleSlotClick(e, staffMember.id)}
              onDragOver={e => handleDragOver(e, staffMember.id)}
              onDragLeave={handleDragLeave}
              onDrop={e => handleDrop(e, staffMember.id)}
            >
              {/* Hour lines */}
              {hours.map(h => (
                <div
                  key={h}
                  className="absolute w-full border-b border-gray-50"
                  style={{ top: (h - HOUR_START) * SLOT_HEIGHT, height: SLOT_HEIGHT }}
                />
              ))}

              {/* Half-hour lines */}
              {hours.map(h => (
                <div
                  key={`${h}-half`}
                  className="absolute w-full border-b border-gray-50/50"
                  style={{ top: (h - HOUR_START) * SLOT_HEIGHT + SLOT_HEIGHT / 2 }}
                />
              ))}

              {/* Drop target indicator */}
              {dropTarget && dropTarget.staffId === staffMember.id && dragBooking && (
                <div
                  className="absolute left-1 right-1 bg-violet-200/50 border-2 border-dashed border-violet-400 rounded z-10 pointer-events-none"
                  style={{
                    top: (() => {
                      const [h, m] = dropTarget.time.split(':').map(Number);
                      return ((h * 60 + m - HOUR_START * 60) / 60) * SLOT_HEIGHT;
                    })(),
                    height: (() => {
                      const b = bookings.find(x => x.id === dragBooking);
                      const svc = b ? services.find(s => s.id === b.service_id) : null;
                      return ((svc?.duration_min || 30) / 60) * SLOT_HEIGHT;
                    })(),
                  }}
                />
              )}

              {/* Booking blocks */}
              {staffBookings.map(({ booking, topPx, heightPx, timeLabel, serviceName, customerName }) => (
                <div
                  key={booking.id}
                  data-booking="true"
                  draggable
                  onDragStart={e => handleDragStart(e, booking.id)}
                  onDragEnd={handleDragEnd}
                  onClick={e => {
                    e.stopPropagation();
                    onSelectBooking(booking);
                  }}
                  className={`absolute left-1 right-1 rounded-md border-l-[3px] px-2 py-1 cursor-grab active:cursor-grabbing overflow-hidden transition-shadow hover:shadow-md z-10 ${
                    STATUS_COLORS[booking.status] || STATUS_COLORS.confirmed
                  } ${dragBooking === booking.id ? 'opacity-40' : ''}`}
                  style={{ top: topPx, height: heightPx }}
                  title={`${customerName}\n${serviceName}\n${timeLabel}`}
                >
                  <p className="text-xs font-medium truncate leading-tight">{customerName}</p>
                  {heightPx > 30 && (
                    <p className="text-[10px] opacity-75 truncate">{serviceName}</p>
                  )}
                  {heightPx > 44 && (
                    <p className="text-[10px] opacity-60">{timeLabel}</p>
                  )}
                </div>
              ))}
            </div>
          );
        })}

        {/* Current time line */}
        {showNowLine && (
          <div
            className="absolute left-14 right-0 h-0.5 bg-red-500 z-30 pointer-events-none"
            style={{ top: (nowMin / 60) * SLOT_HEIGHT }}
          >
            <div className="absolute -left-1 -top-1 w-2.5 h-2.5 rounded-full bg-red-500" />
          </div>
        )}
      </div>
    </div>
  );
}
