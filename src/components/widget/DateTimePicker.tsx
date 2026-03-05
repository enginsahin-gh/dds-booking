import { useState } from 'react';
import { startOfMonth, format } from 'date-fns';
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

  return (
    <div className="bellure-animate-in">
      <h2 className="bellure-step-title">Kies datum & tijd</h2>
      <p className="bellure-step-subtitle">Wanneer wil je langskomen?</p>

      <div className="bellure-datetime-layout">
        <div className="bellure-datetime-calendar">
          <CalendarGrid
            selectedDate={selectedDate}
            onSelectDate={onSelectDate}
            currentMonth={currentMonth}
            onChangeMonth={setCurrentMonth}
            workingDays={workingDays}
            maxDate={maxDate}
          />
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
