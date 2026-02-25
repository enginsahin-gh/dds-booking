import {
  startOfDay,
  endOfDay,
  addMinutes,
  parseISO,
  format,
  isBefore,
  isAfter,
  set,
} from 'date-fns';
import { toZonedTime, fromZonedTime } from 'date-fns-tz';
import type { Staff, StaffSchedule, StaffBlock, PublicBooking, TimeSlot } from './types';

const SLOT_STEP_MINUTES = 15;

interface Interval {
  start: Date;
  end: Date;
}

/**
 * Parse a time string "HH:mm" or "HH:mm:ss" into hours and minutes.
 */
function parseTime(timeStr: string): { hours: number; minutes: number } {
  const parts = timeStr.split(':');
  return { hours: parseInt(parts[0], 10), minutes: parseInt(parts[1], 10) };
}

/**
 * Get day of week (0=Monday, 6=Sunday) matching our database convention.
 * JavaScript getDay: 0=Sun, 1=Mon ... 6=Sat
 */
function getDayOfWeek(date: Date): number {
  const jsDay = date.getDay();
  return jsDay === 0 ? 6 : jsDay - 1;
}

/**
 * Check if two intervals overlap.
 */
function overlaps(a: Interval, b: Interval): boolean {
  return isBefore(a.start, b.end) && isAfter(a.end, b.start);
}

/**
 * Calculate available slots for a single staff member on a given date.
 */
export function calculateSlotsForStaff(
  staffId: string,
  date: Date,
  durationMin: number,
  schedule: StaffSchedule | undefined,
  blocks: StaffBlock[],
  bookings: PublicBooking[],
  timezone: string
): TimeSlot[] {
  if (!schedule || !schedule.is_working) return [];

  const zonedDate = toZonedTime(date, timezone);
  const dayStart = startOfDay(zonedDate);

  const workStart = set(dayStart, parseTime(schedule.start_time));
  const workEnd = set(dayStart, parseTime(schedule.end_time));

  // Build occupied intervals
  const occupied: Interval[] = [
    ...blocks.map((b) => ({ start: toZonedTime(parseISO(b.start_at), timezone), end: toZonedTime(parseISO(b.end_at), timezone) })),
    ...bookings
      .filter((b) => b.staff_id === staffId)
      .map((b) => ({ start: toZonedTime(parseISO(b.start_at), timezone), end: toZonedTime(parseISO(b.end_at), timezone) })),
  ];

  // Generate slots in 15-minute steps
  const slots: TimeSlot[] = [];
  let cursor = workStart;

  while (!isAfter(addMinutes(cursor, durationMin), workEnd)) {
    const slotStart = cursor;
    const slotEnd = addMinutes(cursor, durationMin);

    const hasConflict = occupied.some((o) => overlaps({ start: slotStart, end: slotEnd }, o));

    // Also skip slots in the past
    const utcSlotStart = fromZonedTime(slotStart, timezone);
    const now = new Date();

    if (!hasConflict && isAfter(utcSlotStart, now)) {
      slots.push({
        time: utcSlotStart.toISOString(),
        staffId,
      });
    }

    cursor = addMinutes(cursor, SLOT_STEP_MINUTES);
  }

  return slots;
}

/**
 * Get available slots for a date, optionally for a specific staff or all staff.
 */
export function getAvailableSlots(
  date: Date,
  durationMin: number,
  staffList: Staff[],
  schedules: StaffSchedule[],
  blocks: StaffBlock[],
  bookings: PublicBooking[],
  timezone: string,
  selectedStaffId?: string | null
): TimeSlot[] {
  // Use the date directly for day-of-week — it represents the selected calendar day (BUG-001)
  const dow = getDayOfWeek(date);

  if (selectedStaffId) {
    const schedule = schedules.find(
      (s) => s.staff_id === selectedStaffId && s.day_of_week === dow
    );
    const staffBlocks = blocks.filter((b) => b.staff_id === selectedStaffId);
    return calculateSlotsForStaff(
      selectedStaffId, date, durationMin, schedule, staffBlocks, bookings, timezone
    );
  }

  // No preference: collect all available staff per time slot, then pick randomly
  const slotCandidates = new Map<string, TimeSlot[]>();

  for (const staff of staffList) {
    const schedule = schedules.find(
      (s) => s.staff_id === staff.id && s.day_of_week === dow
    );
    const staffBlocks = blocks.filter((b) => b.staff_id === staff.id);
    const slots = calculateSlotsForStaff(
      staff.id, date, durationMin, schedule, staffBlocks, bookings, timezone
    );

    for (const slot of slots) {
      const timeKey = format(parseISO(slot.time), 'HH:mm');
      const existing = slotCandidates.get(timeKey) || [];
      existing.push(slot);
      slotCandidates.set(timeKey, existing);
    }
  }

  // Pick a random staff member per time slot for fair distribution
  const result: TimeSlot[] = [];
  for (const candidates of slotCandidates.values()) {
    const picked = candidates[Math.floor(Math.random() * candidates.length)];
    result.push(picked);
  }

  return result.sort(
    (a, b) => new Date(a.time).getTime() - new Date(b.time).getTime()
  );
}
