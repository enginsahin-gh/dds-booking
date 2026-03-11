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
const BASE_SLOT_HEIGHT = 22; // px per step slot
const TIME_COL_W = 48; // px
const COL_MIN_W = 130; // px per staff column

const STATUS_COLORS: Record<string, string> = {
  confirmed: 'bg-[#EEF2F7] border-[#3B4E6C] text-[#22324A]',
  pending_payment: 'bg-amber-50 border-amber-400 text-amber-900',
  cancelled: 'bg-gray-50 border-gray-300 text-gray-500 opacity-60',
  no_show: 'bg-rose-50 border-rose-500 text-rose-900',
  completed: 'bg-emerald-50 border-emerald-500 text-emerald-900',
};

const STATUS_LABELS: Record<string, string> = {
  confirmed: 'Bevestigd',
  pending_payment: 'Wacht op betaling',
  cancelled: 'Geannuleerd',
  no_show: 'No-show',
  completed: 'Voltooid',
};

function snapToStep(minutes: number, step: number): number {
  return Math.round(minutes / step) * step;
}

function getTimeFromY(e: React.DragEvent | React.MouseEvent, el: Element, step: number, hourHeight: number): string {
  const rect = el.getBoundingClientRect();
  const y = e.clientY - rect.top;
  const snapped = snapToStep((y / hourHeight) * 60, step);
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
  const containerRef = useRef<HTMLDivElement>(null);
  const [containerWidth, setContainerWidth] = useState(0);
  const [dragBooking, setDragBooking] = useState<string | null>(null);
  const [dropTarget, setDropTarget] = useState<{ staffId: string; time: string } | null>(null);
  const initialScrollDone = useRef(false);
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
    if (readableIds === null) return active; // all visible
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
  const availableWidth = Math.max(containerWidth - TIME_COL_W, 0);
  const computedStaffWidth = activeStaff.length > 0 && availableWidth > 0
    ? Math.floor(availableWidth / activeStaff.length)
    : COL_MIN_W;
  const staffColWidth = activeStaff.length === 1
    ? Math.max(COL_MIN_W, availableWidth)
    : Math.max(COL_MIN_W, computedStaffWidth);
  const totalGridWidth = TIME_COL_W + activeStaff.length * staffColWidth;
  const segmentHeight = BASE_SLOT_HEIGHT;
  const totalSegments = hours.length * segmentsPerHour;

  useEffect(() => {
    if (initialScrollDone.current) return;
    const el = containerRef.current;
    if (!el) return;
    const targetHour = 9;
    const target = Math.max(0, (targetHour - HOUR_START) * hourHeight - 24);
    el.scrollTop = target;
    initialScrollDone.current = true;
  }, [hourHeight]);

  const positionedBookings = useMemo(() => {
    return bookings
      .filter(b => b.status !== 'cancelled')
      .map(b => {
        const start = toZonedTime(parseISO(b.start_at), timezone);
        const end = toZonedTime(parseISO(b.end_at), timezone);
        const startMin = start.getHours() * 60 + start.getMinutes() - HOUR_START * 60;
        const durationMin = differenceInMinutes(end, start);
        const svc = services.find(s => s.id === b.service_id);
        const stf = allStaff.find(s => s.id === b.staff_id);
        return {
          booking: b, staffId: b.staff_id,
          topPx: (startMin / 60) * hourHeight,
          heightPx: Math.max((durationMin / 60) * hourHeight, 22),
          timeLabel: `${format(start, 'HH:mm')} - ${format(end, 'HH:mm')}`,
          serviceName: svc?.name || '',
          staffName: stf?.name || '',
          customerName: b.customer_name,
          startMin,
        };
      })
      .filter(b => b.startMin >= 0 && b.startMin < totalMinutes);
  }, [bookings, services, allStaff, timezone, totalMinutes]);

  const handleDragStart = (e: React.DragEvent, bookingId: string) => {
    e.dataTransfer.effectAllowed = 'move';
    e.dataTransfer.setData('text/plain', bookingId);
    setDragBooking(bookingId);
  };

  const handleDragOver = (e: React.DragEvent, staffId: string) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    setDropTarget({ staffId, time: getTimeFromY(e, e.currentTarget, stepMinutes, hourHeight) });
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
    onSlotClick(staffId, getTimeFromY(e, e.currentTarget, stepMinutes, hourHeight));
  };

  // Current time
  const [now, setNow] = useState(new Date());
  useEffect(() => { const i = setInterval(() => setNow(new Date()), 60000); return () => clearInterval(i); }, []);
  const nowLocal = toZonedTime(now, timezone);
  const nowMin = nowLocal.getHours() * 60 + nowLocal.getMinutes() - HOUR_START * 60;
  const showNowLine = isSameDay(date, toZonedTime(now, timezone)) && nowMin >= 0 && nowMin < totalMinutes;

  return (
    <div
      ref={containerRef}
      onScroll={() => hoverCard && setHoverCard(null)}
      className="bg-white rounded-2xl border border-gray-200/70 overflow-auto overscroll-none shadow-[0_12px_32px_rgba(15,23,42,0.06)]"
      style={{ height: 'calc(100dvh - 150px)' }}
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
          {activeStaff.map((s, idx) => (
            <div
              key={s.id}
              className={`px-2 py-2 text-center border-r border-gray-200/70 last:border-r-0 flex-shrink-0 ${idx % 2 === 1 ? 'bg-gray-50/60' : ''}`}
              style={{ width: staffColWidth }}
            >
              {s.photo_url ? (
                <img src={s.photo_url} alt="" className="w-7 h-7 rounded-full mx-auto mb-1 object-cover" />
              ) : (
                <div className="w-7 h-7 rounded-full mx-auto mb-1 bg-[#E7EDF5] text-[#22324A] flex items-center justify-center text-[10px] font-bold">
                  {s.name.charAt(0)}
                </div>
              )}
              <p className="text-[11px] font-semibold text-gray-900 truncate">{s.name}</p>
            </div>
          ))}
        </div>

        {/* Grid body */}
        <div className="flex relative" style={{ height: gridHeight }}>
          {/* Time column */}
          <div className="flex-shrink-0 border-r border-gray-200/70" style={{ width: TIME_COL_W }}>
            {hours.map(h => (
              <div key={h} className="border-b border-gray-200/60 text-[11px] font-medium text-gray-500 pr-1.5 text-right" style={{ height: hourHeight }}>
                <span className={`relative ${h === HOUR_START ? 'top-0' : '-top-1.5'}`}>{`${String(h).padStart(2, '0')}:00`}</span>
              </div>
            ))}
          </div>

          {/* Staff columns */}
          {activeStaff.map((staffMember, idx) => {
            const staffBookings = positionedBookings.filter(b => b.staffId === staffMember.id);
            const isAlt = idx % 2 === 1;
            return (
              <div
                key={staffMember.id}
                className={`relative border-r border-gray-200/70 last:border-r-0 cursor-pointer flex-shrink-0 ${isAlt ? 'bg-gray-50/40' : ''}`}
                style={{ height: gridHeight, width: staffColWidth }}
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
                    className="absolute left-1 right-1 bg-[#DDE4EF] border-2 border-dashed border-[#3B4E6C]/50 rounded z-10 pointer-events-none"
                    style={{
                      top: (() => { const [h, m] = dropTarget.time.split(':').map(Number); return ((h * 60 + m - HOUR_START * 60) / 60) * hourHeight; })(),
                      height: (() => { const b = bookings.find(x => x.id === dragBooking); const svc = b ? services.find(s => s.id === b.service_id) : null; return ((svc?.duration_min || 30) / 60) * hourHeight; })(),
                    }}
                  />
                )}

                {staffBookings.map(({ booking, topPx, heightPx, timeLabel, serviceName, staffName, customerName }) => (
                  <div
                    key={booking.id}
                    data-booking="true"
                    draggable={canEditStaff(booking.staff_id)}
                    onDragStart={e => canEditStaff(booking.staff_id) && handleDragStart(e, booking.id)}
                    onDragEnd={() => { setDragBooking(null); setDropTarget(null); }}
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
                    onClick={e => { e.stopPropagation(); onSelectBooking(booking); }}
                    className={`absolute left-0.5 right-0.5 rounded-[10px] border border-black/10 border-l-[5px] px-2 py-1 cursor-grab active:cursor-grabbing overflow-hidden transition-shadow shadow-[0_8px_20px_rgba(15,23,42,0.12)] hover:shadow-[0_12px_28px_rgba(15,23,42,0.18)] z-10 ${
                      STATUS_COLORS[booking.status] || STATUS_COLORS.confirmed
                    } ${dragBooking === booking.id ? 'opacity-40' : ''}`}
                    style={{ top: topPx, height: heightPx }}
                  >
                    <p className="text-[11px] font-semibold truncate leading-tight">{customerName}</p>
                    {heightPx > 28 && <p className="text-[10px] opacity-80 truncate">{serviceName}</p>}
                    {heightPx > 42 && <p className="text-[9px] opacity-70">{timeLabel}</p>}
                  </div>
                ))}
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

          {showNowLine && (
            <div id="admin-now-line" className="absolute right-0 h-[3px] bg-rose-500 z-[15] pointer-events-none shadow-[0_0_10px_rgba(244,63,94,0.45)]" style={{ top: (nowMin / 60) * hourHeight, left: TIME_COL_W }}>
              <div className="absolute -left-1.5 -top-1.5 w-3 h-3 rounded-full bg-rose-500 shadow-[0_0_8px_rgba(244,63,94,0.45)]" />
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
