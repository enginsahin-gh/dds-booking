import { useMemo, useState } from 'react';
import { startOfDay, startOfMonth, addDays, format, isBefore, isAfter } from 'date-fns';
import { CalendarGrid } from './CalendarGrid';
import { TimeSlotList } from './TimeSlotList';
import { WaitlistForm } from './WaitlistForm';
import type { TimeSlot } from '../../lib/types';

interface DateTimePickerProps {
  selectedDate: Date | null;
  onSelectDate: (date: Date) => void;
  selectedSlot: TimeSlot | null;
  onSelectSlot: (slot: TimeSlot) => void;
  slots: TimeSlot[];
  slotsLoading: boolean;
  timezone: string;
  workingDays?: Set<number>;
  maxDate?: Date | null;
  // Waitlist props
  salonId?: string;
  serviceId?: string;
  staffId?: string | null;
  waitlistEnabled?: boolean;
}

export function DateTimePicker({
  selectedDate,
  onSelectDate,
  selectedSlot,
  onSelectSlot,
  slots,
  slotsLoading,
  timezone,
  workingDays,
  maxDate,
  salonId,
  serviceId,
  staffId,
  waitlistEnabled,
}: DateTimePickerProps) {
  const [currentMonth, setCurrentMonth] = useState(startOfMonth(new Date()));
  const [showWaitlist, setShowWaitlist] = useState(false);
  const [viewMode, setViewMode] = useState<'strip' | 'calendar'>('strip');

  const daysStrip = useMemo(() => {
    const today = startOfDay(new Date());
    const max = maxDate ? startOfDay(maxDate) : null;
    const days: Date[] = [];
    for (let i = 0; i < 14; i++) {
      const d = addDays(today, i);
      if (max && isAfter(d, max)) break;
      days.push(d);
    }
    return days;
  }, [maxDate]);

  const isSelectable = (date: Date) => {
    const today = startOfDay(new Date());
    if (isBefore(date, today)) return false;
    if (maxDate && isAfter(date, maxDate)) return false;
    const jsDay = date.getDay();
    const isWorkDay = !workingDays || workingDays.size === 0 || workingDays.has(jsDay);
    return isWorkDay;
  };
  return (
    <div className="bellure-animate-in">
      <h2 className="bellure-step-title">Kies datum & tijd</h2>
      <p className="bellure-step-subtitle">Wanneer wil je langskomen?</p>

      <div className={`bellure-datetime-layout ${viewMode === 'strip' ? 'strip' : 'calendar'}`}>
        <div className="bellure-datetime-calendar">
          <div className="bellure-datetime-toggle">
            <button className={`bellure-toggle ${viewMode === 'strip' ? 'active' : ''}`} onClick={() => setViewMode('strip')}>Snelle dagen</button>
            <button className={`bellure-toggle ${viewMode === 'calendar' ? 'active' : ''}`} onClick={() => setViewMode('calendar')}>Kalender</button>
          </div>

          {viewMode === 'strip' ? (
            <div className="bellure-day-strip">
              {daysStrip.map((day) => {
                const disabled = !isSelectable(day);
                const selected = selectedDate && day.toDateString() === selectedDate.toDateString();
                return (
                  <button
                    key={day.toISOString()}
                    className={`bellure-day-pill ${selected ? 'active' : ''}`}
                    onClick={() => !disabled && onSelectDate(day)}
                    disabled={disabled}
                  >
                    <div className="bellure-day-name">{format(day, 'EEE')}</div>
                    <div className="bellure-day-num">{format(day, 'd')}</div>
                  </button>
                );
              })}
            </div>
          ) : (
            <CalendarGrid
              selectedDate={selectedDate}
              onSelectDate={onSelectDate}
              currentMonth={currentMonth}
              onChangeMonth={setCurrentMonth}
              workingDays={workingDays}
              maxDate={maxDate}
            />
          )}
        </div>

        <div className="bellure-datetime-slots">
          <TimeSlotList
            slots={slots}
            selectedSlot={selectedSlot}
            onSelect={onSelectSlot}
            loading={slotsLoading}
            timezone={timezone}
            dateSelected={!!selectedDate}
          />
          {/* Show waitlist CTA when no slots available */}
          {selectedDate && !slotsLoading && slots.length === 0 && salonId && serviceId && waitlistEnabled && (
            <div className="bellure-waitlist">
              {!showWaitlist ? (
                <>
                  <div className="bellure-waitlist-text">Geen beschikbare tijden op deze dag.</div>
                  <button className="bellure-btn bellure-btn-secondary" onClick={() => setShowWaitlist(true)}>
                    Zet me op de wachtlijst
                  </button>
                </>
              ) : (
                <WaitlistForm
                  salonId={salonId}
                  serviceId={serviceId}
                  staffId={staffId || null}
                  selectedDate={format(selectedDate, 'yyyy-MM-dd')}
                />
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
