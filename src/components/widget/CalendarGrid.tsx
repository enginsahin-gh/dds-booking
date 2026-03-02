import {
  startOfMonth,
  endOfMonth,
  startOfWeek,
  endOfWeek,
  eachDayOfInterval,
  format,
  isSameMonth,
  isSameDay,
  isToday,
  isBefore,
  isAfter,
  addMonths,
  subMonths,
  startOfDay,
} from 'date-fns';
import { nl } from 'date-fns/locale';

interface CalendarGridProps {
  selectedDate: Date | null;
  onSelectDate: (date: Date) => void;
  currentMonth: Date;
  onChangeMonth: (date: Date) => void;
  workingDays?: Set<number>;
  maxDate?: Date | null; // booking horizon limit
}

const WEEKDAYS = ['Ma', 'Di', 'Wo', 'Do', 'Vr', 'Za', 'Zo'];

export function CalendarGrid({ selectedDate, onSelectDate, currentMonth, onChangeMonth, workingDays, maxDate }: CalendarGridProps) {
  const monthStart = startOfMonth(currentMonth);
  const monthEnd = endOfMonth(currentMonth);
  const calStart = startOfWeek(monthStart, { weekStartsOn: 1 });
  const calEnd = endOfWeek(monthEnd, { weekStartsOn: 1 });
  const days = eachDayOfInterval({ start: calStart, end: calEnd });
  const today = startOfDay(new Date());

  const canGoPrev = !isBefore(startOfMonth(subMonths(currentMonth, 1)), startOfMonth(today));
  const canGoNext = !maxDate || !isBefore(maxDate, startOfMonth(addMonths(currentMonth, 1)));

  return (
    <div className="bellure-calendar">
      <div className="bellure-calendar-header">
        <button
          className="bellure-calendar-btn"
          onClick={() => onChangeMonth(subMonths(currentMonth, 1))}
          disabled={!canGoPrev}
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="15 18 9 12 15 6"/></svg>
        </button>
        <span className="bellure-calendar-title">
          {format(currentMonth, 'MMMM yyyy', { locale: nl })}
        </span>
        <button
          className="bellure-calendar-btn"
          onClick={() => onChangeMonth(addMonths(currentMonth, 1))}
          disabled={!canGoNext}
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="9 18 15 12 9 6"/></svg>
        </button>
      </div>

      <div className="bellure-calendar-weekdays">
        {WEEKDAYS.map((d) => (
          <div key={d} className="bellure-calendar-weekday">{d}</div>
        ))}
      </div>

      <div className="bellure-calendar-days">
        {days.map((day) => {
          const inMonth = isSameMonth(day, currentMonth);
          const isPast = isBefore(day, today);
          const isBeyondHorizon = maxDate ? isAfter(day, maxDate) : false;
          const selected = selectedDate && isSameDay(day, selectedDate);
          const todayClass = isToday(day);

          const jsDay = day.getDay(); // 0=Sun..6=Sat
          const isWorkDay = !workingDays || workingDays.size === 0 || workingDays.has(jsDay);
          const isClosed = inMonth && !isPast && !isBeyondHorizon && !isWorkDay;

          let cls = 'bellure-calendar-day';
          if (!inMonth) cls += ' bellure-calendar-day--empty bellure-calendar-day--disabled';
          else if (isPast || isBeyondHorizon) cls += ' bellure-calendar-day--disabled';
          else if (isClosed) cls += ' bellure-calendar-day--closed';
          else {
            if (todayClass) cls += ' bellure-calendar-day--today';
            if (selected) cls += ' bellure-calendar-day--selected';
            cls += ' bellure-calendar-day--available';
          }

          return (
            <div
              key={day.toISOString()}
              className={cls}
              onClick={() => inMonth && !isPast && !isBeyondHorizon && !isClosed && onSelectDate(day)}
            >
              {inMonth ? format(day, 'd') : ''}
            </div>
          );
        })}
      </div>
    </div>
  );
}
