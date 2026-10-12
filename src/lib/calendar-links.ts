import { importantDateCategoryLabel } from "./important-dates-format";
import type { ImportantDate, ShortlistedCourse } from "./types";

/**
 * Client-safe helpers that turn extracted important dates into all-day
 * calendar events for Google Calendar, Outlook, or an .ics download.
 */

export interface CalendarEvent {
  title: string;
  /** ISO date (YYYY-MM-DD). All events are all-day. */
  date: string;
  description: string;
  location: string;
  url: string;
}

const ISO_DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

/** Build a calendar event for one important date, or null if it is undated. */
export function calendarEventFromDate(
  date: ImportantDate,
  course: Pick<ShortlistedCourse, "course_name" | "university_name" | "university_location" | "course_url">
): CalendarEvent | null {
  if (!date.date || !ISO_DATE_RE.test(date.date)) return null;

  const lines = [
    `${course.course_name} — ${course.university_name}`,
    `Category: ${importantDateCategoryLabel(date.category)}`,
    date.dateText ? `As written on the university website: ${date.dateText}` : "",
    date.details ? `\n${date.details}` : "",
    date.sourceUrl ? `\nSource: ${date.sourceUrl}` : "",
    course.course_url && course.course_url !== date.sourceUrl ? `Course page: ${course.course_url}` : "",
    "\nAdded from UniHunt. Dates are read automatically from the university website and can change — confirm on the official page before applying.",
  ].filter(Boolean);

  return {
    title: `${date.label} · ${course.university_name}`,
    date: date.date,
    description: lines.join("\n"),
    location: course.university_location ?? course.university_name,
    url: date.sourceUrl || course.course_url || "",
  };
}

function compactDate(iso: string): string {
  return iso.replaceAll("-", "");
}

function nextDay(iso: string): string {
  const next = new Date(`${iso}T00:00:00Z`);
  next.setUTCDate(next.getUTCDate() + 1);
  return next.toISOString().slice(0, 10);
}

/** Deep-link URLs have a practical length limit; keep the description short. */
function urlSafeDescription(text: string, max = 800): string {
  const compact = text.replace(/\n{3,}/g, "\n\n").trim();
  return compact.length <= max ? compact : `${compact.slice(0, max - 1)}…`;
}

/** Google Calendar "create event" link (all-day: end date is exclusive). */
export function googleCalendarUrl(event: CalendarEvent): string {
  const params = new URLSearchParams({
    action: "TEMPLATE",
    text: event.title,
    dates: `${compactDate(event.date)}/${compactDate(nextDay(event.date))}`,
    details: urlSafeDescription(event.description),
  });
  if (event.location) params.set("location", event.location);
  return `https://calendar.google.com/calendar/render?${params.toString()}`;
}

export type OutlookFlavour = "live" | "office";

/**
 * Outlook web "compose event" deep link. `live` is Outlook.com (personal
 * accounts); `office` is Outlook on the web for work/school (Microsoft 365).
 */
export function outlookCalendarUrl(event: CalendarEvent, flavour: OutlookFlavour = "live"): string {
  const params = new URLSearchParams({
    path: "/calendar/action/compose",
    rru: "addevent",
    subject: event.title,
    startdt: event.date,
    enddt: nextDay(event.date),
    allday: "true",
    body: urlSafeDescription(event.description),
  });
  if (event.location) params.set("location", event.location);
  const host = flavour === "office" ? "outlook.office.com" : "outlook.live.com";
  return `https://${host}/calendar/0/deeplink/compose?${params.toString()}`;
}

function escapeIcsText(value: string): string {
  return value
    .replace(/\\/g, "\\\\")
    .replace(/;/g, "\\;")
    .replace(/,/g, "\\,")
    .replace(/\r?\n/g, "\\n");
}

/** RFC 5545 content lines must be folded at 75 octets. */
function foldIcsLine(line: string): string {
  const encoder = new TextEncoder();
  const out: string[] = [];
  let current = "";
  let currentBytes = 0;
  for (const char of line) {
    const size = encoder.encode(char).length;
    const limit = out.length === 0 ? 75 : 74; // continuation lines start with a space
    if (currentBytes + size > limit) {
      out.push(current);
      current = "";
      currentBytes = 0;
    }
    current += char;
    currentBytes += size;
  }
  out.push(current);
  return out.map((part, index) => (index === 0 ? part : ` ${part}`)).join("\r\n");
}

function icsTimestamp(date: Date): string {
  return date.toISOString().replace(/[-:]/g, "").replace(/\.\d{3}Z$/, "Z");
}

function simpleHash(value: string): string {
  let hash = 0;
  for (let i = 0; i < value.length; i++) {
    hash = (hash * 31 + value.charCodeAt(i)) | 0;
  }
  return Math.abs(hash).toString(36);
}

/**
 * Build an iCalendar file containing all-day events. Works with Outlook
 * (desktop and web), Apple Calendar, Google Calendar import, and others.
 */
export function buildIcs(events: CalendarEvent[], options: { now?: Date } = {}): string {
  const now = options.now ?? new Date();
  const stamp = icsTimestamp(now);
  const lines: string[] = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//UniHunt//Important dates//EN",
    "CALSCALE:GREGORIAN",
    "METHOD:PUBLISH",
  ];

  for (const event of events) {
    const uid = `${compactDate(event.date)}-${simpleHash(`${event.title}|${event.url}`)}@unihunt`;
    lines.push(
      "BEGIN:VEVENT",
      `UID:${uid}`,
      `DTSTAMP:${stamp}`,
      `DTSTART;VALUE=DATE:${compactDate(event.date)}`,
      `DTEND;VALUE=DATE:${compactDate(nextDay(event.date))}`,
      `SUMMARY:${escapeIcsText(event.title)}`,
      `DESCRIPTION:${escapeIcsText(event.description)}`
    );
    if (event.location) lines.push(`LOCATION:${escapeIcsText(event.location)}`);
    if (event.url) lines.push(`URL:${event.url}`);
    lines.push(
      "BEGIN:VALARM",
      "ACTION:DISPLAY",
      `DESCRIPTION:${escapeIcsText(event.title)}`,
      "TRIGGER:-P7D",
      "END:VALARM",
      "END:VEVENT"
    );
  }

  lines.push("END:VCALENDAR");
  return lines.map(foldIcsLine).join("\r\n") + "\r\n";
}

/** Trigger a browser download of an .ics file. */
export function downloadIcs(filename: string, ics: string): void {
  const blob = new Blob([ics], { type: "text/calendar;charset=utf-8" });
  const href = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = href;
  anchor.download = filename.endsWith(".ics") ? filename : `${filename}.ics`;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  setTimeout(() => URL.revokeObjectURL(href), 1000);
}

export function icsFilename(course: Pick<ShortlistedCourse, "university_name" | "course_name">): string {
  const base = `${course.university_name} ${course.course_name} dates`
    .normalize("NFKD")
    .replace(/[^\w\s-]/g, "")
    .trim()
    .replace(/\s+/g, "-")
    .toLowerCase()
    .slice(0, 80);
  return `${base || "important-dates"}.ics`;
}
