import { useMemo, useRef, useState, useEffect } from 'react';
import { format, parseISO, addMinutes, differenceInMinutes, startOfDay, set, isSameDay } from 'date-fns';
import { toZonedTime, fromZonedTime } from 'date-fns-tz';
import { supabase } from '../../lib/supabase';
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
  onBookingMoved: () => void;
}

const HOUR_START = 7;
const HOUR_END = 21;
const SLOT_HEIGHT = 48;
const TIME_COL_W = 48; // px
const COL_MIN_W = 130; // px per staff column

const STATUS_COLORS: Record<string, string> = {
  confirmed: 'bg-violet-50 border-violet-500 text-violet-900',
  pending_payment: 'bg-amber-50 border-amber-500 text-amber-900',
  cancelled: 'bg-gray-50 border-gray-300 text-gray-500 opacity-60',
  no_show: 'bg-rose-50 border-rose-500 text-rose-900',
  completed: 'bg-emerald-50 border-emerald-500 text-emerald-900',
};

function snapToStep(minutes: number, step: number): number {
  return Math.round(minutes / step) * step;
}

function getTimeFromY(e: React.DragEvent | React.MouseEvent, el: Element, step: number): string {
  const rect = el.getBoundingClientRect();
  const y = e.clientY - rect.top;
  const snapped = snapToStep((y / SLOT_HEIGHT) * 60, step);
  const totalMin = HOUR_START * 60 + snapped;
  const h = Math.floor(totalMin / 60);
  const m = totalMin % 60;
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
}

export function AgendaView({
  date, bookings, services, staff: allStaff, timezone, slotStepMinutes = 15,
  onSelectBooking, onSlotClick, onBookingMoved,
}: Props) {
  const stepMinutes = slotStepMinutes;
  const { getReadableStaffIds, canEditStaff } = useAuth();
  const [dragBooking, setDragBooking] = useState<string | null>(null);
  const [dropTarget, setDropTarget] = useState<{ staffId: string; time: string } | null>(null);

  const activeStaff = useMemo(() => {
    const active = allStaff.filter(s => s.is_active);
    const readableIds = getReadableStaffIds();
    if (readableIds === null) return active; // all visible
    return active.filter(s => readableIds.includes(s.id));
  }, [allStaff, getReadableStaffIds]);
  const hours = useMemo(() => Array.from({ length: HOUR_END - HOUR_START }, (_, i) => HOUR_START + i), []);
  const totalMinutes = (HOUR_END - HOUR_START) * 60;
  const gridHeight = hours.length * SLOT_HEIGHT;
  const totalGridWidth = TIME_COL_W + activeStaff.length * COL_MIN_W;
  const segmentsPerHour = Math.max(1, Math.round(60 / stepMinutes));
  const segmentHeight = SLOT_HEIGHT / segmentsPerHour;
  const totalSegments = hours.length * segmentsPerHour;

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
    setDropTarget({ staffId, time: getTimeFromY(e, e.currentTarget, stepMinutes) });
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
    onSlotClick(staffId, getTimeFromY(e, e.currentTarget, stepMinutes));
  };

  // Current time
  const [now, setNow] = useState(new Date());
  useEffect(() => { const i = setInterval(() => setNow(new Date()), 60000); return () => clearInterval(i); }, []);
  const nowLocal = toZonedTime(now, timezone);
  const nowMin = nowLocal.getHours() * 60 + nowLocal.getMinutes() - HOUR_START * 60;
  const showNowLine = isSameDay(date, toZonedTime(now, timezone)) && nowMin >= 0 && nowMin < totalMinutes;

  return (
    <div
      className="bg-white rounded-2xl border border-gray-200/70 overflow-auto overscroll-none shadow-[0_12px_32px_rgba(15,23,42,0.06)]"
      style={{ maxHeight: 'calc(100dvh - 260px)' }}
    >
      {/*
        Single scroll container for both header and grid.
        Header uses position:sticky so it stays visible while scrolling vertically,
        but scrolls horizontally together with the grid.
      */}
      <div style={{ minWidth: totalGridWidth }}>
        {/* Sticky header row */}
        <div className="flex border-b border-gray-200/70 bg-white sticky top-0 z-20">
          <div className="border-r border-gray-100 flex-shrink-0" style={{ width: TIME_COL_W }} />
          {activeStaff.map(s => (
            <div
              key={s.id}
              className="px-2.5 py-3 text-center border-r border-gray-200/70 last:border-r-0 flex-shrink-0"
              style={{ width: COL_MIN_W }}
            >
              {s.photo_url ? (
                <img src={s.photo_url} alt="" className="w-8 h-8 rounded-full mx-auto mb-1 object-cover" />
              ) : (
                <div className="w-8 h-8 rounded-full mx-auto mb-1 bg-violet-100/80 text-violet-700 flex items-center justify-center text-[11px] font-bold">
                  {s.name.charAt(0)}
                </div>
              )}
              <p className="text-[12px] font-semibold text-gray-900 truncate">{s.name}</p>
            </div>
          ))}
        </div>

        {/* Grid body */}
        <div className="flex relative" style={{ height: gridHeight }}>
          {/* Time column */}
          <div className="flex-shrink-0 border-r border-gray-200/70" style={{ width: TIME_COL_W }}>
            {hours.map(h => (
              <div key={h} className="border-b border-gray-200/60 text-[11px] font-medium text-gray-500 pr-1.5 text-right" style={{ height: SLOT_HEIGHT }}>
                <span className={`relative ${h === HOUR_START ? 'top-0' : '-top-1.5'}`}>{`${String(h).padStart(2, '0')}:00`}</span>
              </div>
            ))}
          </div>

          {/* Staff columns */}
          {activeStaff.map(staffMember => {
            const staffBookings = positionedBookings.filter(b => b.staffId === staffMember.id);
            return (
              <div
                key={staffMember.id}
                className="relative border-r border-gray-200/70 last:border-r-0 cursor-pointer flex-shrink-0"
                style={{ height: gridHeight, width: COL_MIN_W }}
                onClick={e => handleSlotClick(e, staffMember.id)}
                onDragOver={e => handleDragOver(e, staffMember.id)}
                onDragLeave={() => setDropTarget(null)}
                onDrop={e => handleDrop(e, staffMember.id)}
              >
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
                    draggable={canEditStaff(booking.staff_id)}
                    onDragStart={e => canEditStaff(booking.staff_id) && handleDragStart(e, booking.id)}
                    onDragEnd={() => { setDragBooking(null); setDropTarget(null); }}
                    onClick={e => { e.stopPropagation(); onSelectBooking(booking); }}
                    className={`absolute left-0.5 right-0.5 rounded-lg border border-black/5 border-l-[4px] px-1.5 py-0.5 cursor-grab active:cursor-grabbing overflow-hidden transition-shadow shadow-[0_6px_16px_rgba(15,23,42,0.08)] hover:shadow-[0_10px_22px_rgba(15,23,42,0.12)] z-10 ${
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
