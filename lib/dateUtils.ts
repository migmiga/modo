// yyyy-mm-dd 문자열 기준 날짜 유틸. 시간대 혼선을 피하기 위해
// 날짜 계산은 UTC 정오 기준 Date 객체로 수행한다.

function toUtcDate(dateStr: string): Date {
  return new Date(`${dateStr}T12:00:00Z`);
}

function fromUtcDate(date: Date): string {
  return date.toISOString().slice(0, 10);
}

// Local-calendar-day extraction shared by todayStr (current moment) and
// localDateStrFromIso (an arbitrary stored timestamp, e.g. Task.deferred_at)
// — both need "which local calendar day was this", not a UTC slice, which
// would misdate timestamps near local midnight in any UTC-offset timezone.
function localDateStrFromDate(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

export function todayStr(): string {
  return localDateStrFromDate(new Date());
}

// Converts an ISO timestamp (e.g. Task.deferred_at) to the yyyy-mm-dd it
// falls on in the viewer's local timezone — comparable against todayStr()'s
// result. Never slice the ISO string's own UTC date directly: in a positive
// UTC-offset timezone (e.g. UTC+9), a timestamp from local early-morning
// hours still carries the *previous* UTC calendar day, which would make
// "deferred earlier today" look like "deferred yesterday".
export function localDateStrFromIso(iso: string): string {
  return localDateStrFromDate(new Date(iso));
}

export function addDays(dateStr: string, amount: number): string {
  const d = toUtcDate(dateStr);
  d.setUTCDate(d.getUTCDate() + amount);
  return fromUtcDate(d);
}

export function compareDates(a: string, b: string): number {
  return a < b ? -1 : a > b ? 1 : 0;
}

export function isWeekend(dateStr: string): boolean {
  const day = toUtcDate(dateStr).getUTCDay();
  return day === 0 || day === 6;
}

const MAX_RANGE_DAYS = 366 * 3;

export function enumerateDates(start: string, end: string): string[] {
  if (compareDates(start, end) > 0) return [];
  const dates: string[] = [];
  let cursor = start;
  let guard = 0;
  while (compareDates(cursor, end) <= 0 && guard < MAX_RANGE_DAYS) {
    dates.push(cursor);
    cursor = addDays(cursor, 1);
    guard += 1;
  }
  return dates;
}

export function dayBudgetFor(
  dateStr: string,
  weekdayMinutes: number,
  weekendMinutes: number
): number {
  return isWeekend(dateStr) ? weekendMinutes : weekdayMinutes;
}

export function formatShortDate(dateStr: string): string {
  const d = toUtcDate(dateStr);
  const mm = String(d.getUTCMonth() + 1).padStart(2, "0");
  const dd = String(d.getUTCDate()).padStart(2, "0");
  return `${mm}.${dd}`;
}

export function formatDotDate(dateStr: string): string {
  const d = toUtcDate(dateStr);
  const mm = String(d.getUTCMonth() + 1).padStart(2, "0");
  const dd = String(d.getUTCDate()).padStart(2, "0");
  return `${d.getUTCFullYear()}.${mm}.${dd}`;
}

export function formatDateRange(start: string, end: string): string {
  return `${formatDotDate(start)} – ${formatShortDate(end)}`;
}

export function formatWeekdayShort(dateStr: string): string {
  return toUtcDate(dateStr).toLocaleDateString("ko-KR", { weekday: "short", timeZone: "UTC" });
}

export function getDayOfMonth(dateStr: string): number {
  return toUtcDate(dateStr).getUTCDate();
}

export function getMonthLabel(dateStr: string): string {
  return `${toUtcDate(dateStr).getUTCMonth() + 1}월`;
}

export function formatDisplayDate(dateStr: string): string {
  return toUtcDate(dateStr).toLocaleDateString("ko-KR", {
    month: "long",
    day: "numeric",
    weekday: "short",
    timeZone: "UTC",
  });
}

export function getYearMonthLabel(dateStr: string): string {
  const d = toUtcDate(dateStr);
  return `${d.getUTCFullYear()}년 ${d.getUTCMonth() + 1}월`;
}

export function getWeekday(dateStr: string): number {
  return toUtcDate(dateStr).getUTCDay();
}

export function startOfMonth(dateStr: string): string {
  const d = toUtcDate(dateStr);
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}-01`;
}

export function addMonths(dateStr: string, amount: number): string {
  const d = toUtcDate(dateStr);
  const target = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + amount, 1, 12));
  return fromUtcDate(target);
}

/**
 * 해당 날짜가 속한 달의 Sun-start 전체 주 Grid를 반환한다.
 * 월 앞/뒤의 빈 칸은 인접 월의 실제 날짜로 채우되 inCurrentMonth: false로 표시한다.
 */
export function getMonthGridCells(dateStr: string): { date: string; inCurrentMonth: boolean }[] {
  const monthStart = startOfMonth(dateStr);
  const startWeekday = getWeekday(monthStart);
  const d = toUtcDate(dateStr);
  const daysInMonth = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + 1, 0, 12)).getUTCDate();

  const cells: { date: string; inCurrentMonth: boolean }[] = [];
  for (let i = startWeekday; i > 0; i -= 1) {
    cells.push({ date: addDays(monthStart, -i), inCurrentMonth: false });
  }
  for (let day = 0; day < daysInMonth; day += 1) {
    cells.push({ date: addDays(monthStart, day), inCurrentMonth: true });
  }
  while (cells.length % 7 !== 0) {
    cells.push({ date: addDays(cells[cells.length - 1].date, 1), inCurrentMonth: false });
  }
  return cells;
}
