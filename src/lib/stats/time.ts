export interface LocalParts {
  year: number;
  month: number; // 1-12
  day: number;
  hour: number; // 0-23
  weekday: number; // 0 = Sunday
  date: string; // YYYY-MM-DD
}

const WEEKDAYS: Record<string, number> = { Sun: 0, Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6 };
const formatters = new Map<string, Intl.DateTimeFormat>();

/** Returns `tz` if it is a valid IANA zone, otherwise "UTC". */
export function resolveTimeZone(tz: string | null | undefined): string {
  if (!tz) return "UTC";
  try {
    formatter(tz);
    return tz;
  } catch {
    return "UTC";
  }
}

function formatter(tz: string) {
  let f = formatters.get(tz);
  if (!f) {
    f = new Intl.DateTimeFormat("en-US", {
      timeZone: tz,
      hourCycle: "h23",
      year: "numeric",
      month: "numeric",
      day: "numeric",
      hour: "numeric",
      weekday: "short",
    });
    formatters.set(tz, f);
  }
  return f;
}

const pad = (n: number, w = 2) => String(n).padStart(w, "0");

export function localParts(instant: string | Date, tz: string): LocalParts {
  const p: Record<string, string> = {};
  for (const part of formatter(tz).formatToParts(new Date(instant))) p[part.type] = part.value;
  const year = Number(p.year);
  const month = Number(p.month);
  const day = Number(p.day);
  return {
    year,
    month,
    day,
    hour: Number(p.hour) % 24,
    weekday: WEEKDAYS[p.weekday],
    date: `${pad(year, 4)}-${pad(month)}-${pad(day)}`,
  };
}

/** Whole days since the epoch for a YYYY-MM-DD date (timezone-free, DST-safe). */
export function dayNumber(date: string): number {
  const [y, m, d] = date.split("-").map(Number);
  return Date.UTC(y, m - 1, d) / 86_400_000;
}

/**
 * UTC instants wide enough to contain local year `year` in any timezone
 * (offsets span UTC-12..UTC+14). Callers must still filter by local year.
 */
export function paddedYearWindow(year: number) {
  const pad = 14 * 3_600_000;
  return {
    from: new Date(Date.UTC(year, 0, 1) - pad).toISOString(),
    to: new Date(Date.UTC(year + 1, 0, 1) + pad).toISOString(),
  };
}
