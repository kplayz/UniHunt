"use client";

import { useState } from "react";
import {
  CalendarClock,
  CalendarPlus,
  CalendarSearch,
  Download,
  ExternalLink,
  Loader2,
  RefreshCw,
} from "lucide-react";
import { toast } from "sonner";
import {
  buildIcs,
  calendarEventFromDate,
  downloadIcs,
  googleCalendarUrl,
  icsFilename,
  outlookCalendarUrl,
  type CalendarEvent,
} from "@/lib/calendar-links";
import { importantDateCategoryLabel } from "@/lib/important-dates-format";
import type {
  ImportantDate,
  ImportantDateCategory,
  ShortlistedCourse,
} from "@/lib/types";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

interface ImportantDatesDialogProps {
  course: ShortlistedCourse;
  onLookup: (id: string) => Promise<void>;
}

const CATEGORY_BADGE: Record<ImportantDateCategory, string> = {
  application_open: "bg-emerald-100 text-emerald-900 dark:bg-emerald-900/40 dark:text-emerald-100",
  application_deadline: "bg-rose-100 text-rose-900 dark:bg-rose-900/40 dark:text-rose-100",
  entrance_exam: "bg-violet-100 text-violet-900 dark:bg-violet-900/40 dark:text-violet-100",
  scholarship: "bg-amber-100 text-amber-900 dark:bg-amber-900/40 dark:text-amber-100",
  offer_or_result: "bg-sky-100 text-sky-900 dark:bg-sky-900/40 dark:text-sky-100",
  fee_payment: "bg-orange-100 text-orange-900 dark:bg-orange-900/40 dark:text-orange-100",
  session_start: "bg-teal-100 text-teal-900 dark:bg-teal-900/40 dark:text-teal-100",
  orientation: "bg-indigo-100 text-indigo-900 dark:bg-indigo-900/40 dark:text-indigo-100",
  other: "bg-muted text-foreground",
};

const SHORT_DATE = new Intl.DateTimeFormat("en-GB", {
  day: "numeric",
  month: "short",
  year: "numeric",
  timeZone: "UTC",
});

function todayIso(): string {
  return new Date().toISOString().slice(0, 10);
}

export function formatIsoDate(iso: string | null, fallback: string): string {
  if (!iso) return fallback;
  const parsed = new Date(`${iso}T00:00:00Z`);
  return Number.isNaN(parsed.getTime()) ? fallback : SHORT_DATE.format(parsed);
}

/** The single most useful upcoming date for a compact table cell. */
export function nextImportantDate(course: ShortlistedCourse): ImportantDate | null {
  const dates = course.important_dates?.dates ?? [];
  if (dates.length === 0) return null;
  const today = todayIso();
  const upcoming = dates.filter((date) => date.date && date.date >= today);
  return (
    upcoming.find((date) => date.category === "application_deadline") ??
    upcoming[0] ??
    dates.find((date) => !date.date) ??
    // Past dates are stored most-recent-first, so this is the latest one.
    dates.find((date) => date.date) ??
    dates[0]
  );
}

function daysUntil(iso: string): number {
  const target = Date.parse(`${iso}T00:00:00Z`);
  const now = Date.parse(`${todayIso()}T00:00:00Z`);
  return Math.round((target - now) / 86_400_000);
}

function openInNewTab(url: string) {
  window.open(url, "_blank", "noopener,noreferrer");
}

interface AddToCalendarMenuProps {
  events: CalendarEvent[];
  filename: string;
  label: string;
  size?: "sm" | "xs";
  variant?: "outline" | "secondary" | "ghost";
}

/**
 * Google and Outlook deep links can only create one event at a time, so for a
 * single date they are offered directly; for several dates the .ics download
 * (which both services import) is the only multi-event option.
 */
function AddToCalendarMenu({ events, filename, label, size = "sm", variant = "outline" }: AddToCalendarMenuProps) {
  if (events.length === 0) return null;
  const single = events.length === 1 ? events[0] : null;

  function handleDownload() {
    downloadIcs(filename, buildIcs(events));
    toast.success(
      events.length === 1
        ? "Calendar file downloaded — open it to add the event"
        : `Calendar file with ${events.length} dates downloaded — open it to import them`
    );
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant={variant} size={size} aria-label={label}>
          <CalendarPlus />
          {label}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="min-w-56">
        {single ? (
          <>
            <DropdownMenuItem onSelect={() => openInNewTab(googleCalendarUrl(single))}>
              Google Calendar
              <ExternalLink className="ml-auto size-3 text-muted-foreground" />
            </DropdownMenuItem>
            <DropdownMenuItem onSelect={() => openInNewTab(outlookCalendarUrl(single, "live"))}>
              Outlook.com
              <ExternalLink className="ml-auto size-3 text-muted-foreground" />
            </DropdownMenuItem>
            <DropdownMenuItem onSelect={() => openInNewTab(outlookCalendarUrl(single, "office"))}>
              Outlook (work or school)
              <ExternalLink className="ml-auto size-3 text-muted-foreground" />
            </DropdownMenuItem>
            <DropdownMenuSeparator />
          </>
        ) : (
          <>
            <DropdownMenuLabel className="text-xs font-normal text-muted-foreground">
              {events.length} upcoming dates. Download the file, then import it into Google
              Calendar or Outlook.
            </DropdownMenuLabel>
            <DropdownMenuSeparator />
          </>
        )}
        <DropdownMenuItem onSelect={handleDownload}>
          <Download className="size-4" />
          {single ? "Download .ics (Outlook desktop, Apple Calendar)" : "Download .ics file"}
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

function DateRow({ date, course }: { date: ImportantDate; course: ShortlistedCourse }) {
  const days = date.date ? daysUntil(date.date) : null;
  const passed = days !== null && days < 0;
  const soon = days !== null && days >= 0 && days <= 30;
  const event = passed ? null : calendarEventFromDate(date, course);

  return (
    <li
      className={`flex flex-col gap-1 rounded-md border p-3 ${passed ? "opacity-60" : ""}`}
    >
      <div className="flex flex-wrap items-center gap-2">
        <span className="text-sm font-semibold tabular-nums">
          {formatIsoDate(date.date, date.dateText)}
        </span>
        <Badge className={CATEGORY_BADGE[date.category] ?? CATEGORY_BADGE.other}>
          {importantDateCategoryLabel(date.category)}
        </Badge>
        {passed && <Badge variant="outline">Passed</Badge>}
        {soon && (
          <Badge variant="destructive">
            {days === 0 ? "Today" : `In ${days} day${days === 1 ? "" : "s"}`}
          </Badge>
        )}
      </div>
      <p className="text-sm">{date.label}</p>
      {date.details && (
        <p className="text-xs text-muted-foreground whitespace-pre-wrap break-words">
          {date.details}
        </p>
      )}
      {date.date && date.dateText && formatIsoDate(date.date, "") !== date.dateText && (
        <p className="text-xs text-muted-foreground">As written: “{date.dateText}”</p>
      )}
      <div className="flex flex-wrap items-center justify-between gap-2">
        {date.sourceUrl ? (
          <a
            href={date.sourceUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1 text-xs text-primary hover:underline break-all"
          >
            Source
            <ExternalLink className="size-3" />
          </a>
        ) : (
          <span />
        )}
        {event && (
          <AddToCalendarMenu
            events={[event]}
            filename={icsFilename(course)}
            label="Add to calendar"
            size="xs"
            variant="ghost"
          />
        )}
      </div>
    </li>
  );
}

export function ImportantDatesDialog({ course, onLookup }: ImportantDatesDialogProps) {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const report = course.important_dates;
  const next = nextImportantDate(course);
  const today = todayIso();
  const upcomingEvents = (report?.dates ?? [])
    .filter((date) => date.date && date.date >= today)
    .map((date) => calendarEventFromDate(date, course))
    .filter((event): event is CalendarEvent => event !== null);

  async function handleLookup() {
    setLoading(true);
    try {
      await onLookup(course.id);
      toast.success("University website searched for important dates");
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Could not find important dates"
      );
    } finally {
      setLoading(false);
    }
  }

  const triggerLabel = next
    ? `${next.category === "application_deadline" ? "Apply by" : importantDateCategoryLabel(next.category)} ${formatIsoDate(next.date, next.dateText)}`
    : report
      ? "No dates found"
      : "Find dates";

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button
          variant={report ? "secondary" : "outline"}
          size="sm"
          className="max-w-[14rem] justify-start"
          aria-label={`Important dates for ${course.course_name} at ${course.university_name}`}
        >
          {report ? <CalendarClock /> : <CalendarSearch />}
          <span className="truncate">{triggerLabel}</span>
        </Button>
      </DialogTrigger>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>Important dates</DialogTitle>
          <DialogDescription>
            {course.course_name} — {course.university_name}
          </DialogDescription>
        </DialogHeader>

        {!report && !loading && (
          <div className="rounded-lg border border-dashed p-6 text-center">
            <CalendarSearch className="mx-auto mb-2 size-8 text-muted-foreground" />
            <p className="text-sm">
              Search the university&apos;s own website for application opening and closing
              dates, scholarship deadlines, entrance tests, results, and session start.
            </p>
            <p className="mt-1 text-xs text-muted-foreground">
              Uses Brave Search restricted to the university domain. Takes about 30–60 seconds.
            </p>
          </div>
        )}

        {loading && (
          <div className="flex items-center gap-3 rounded-lg border p-4 text-sm">
            <Loader2 className="size-4 animate-spin" />
            Searching the university website and reading the admissions pages…
          </div>
        )}

        {report && !loading && (
          <div className="space-y-4">
            <div className="rounded-md bg-muted/50 p-3 text-sm">
              <p>{report.summary}</p>
              <p className="mt-1 text-xs text-muted-foreground">
                Checked {new Date(report.checkedAt).toLocaleString()}
                {report.host ? ` · ${report.host}` : ""}
                {report.method === "heuristic" ? " · extracted without AI model" : ""}
              </p>
            </div>

            {upcomingEvents.length > 0 && (
              <div className="flex flex-wrap items-center justify-between gap-2">
                <p className="text-xs text-muted-foreground">
                  {upcomingEvents.length} upcoming date{upcomingEvents.length === 1 ? "" : "s"}
                  . Each is added as an all-day event with a reminder one week before.
                </p>
                <AddToCalendarMenu
                  events={upcomingEvents}
                  filename={icsFilename(course)}
                  label={upcomingEvents.length === 1 ? "Add to calendar" : "Add all to calendar"}
                  variant="secondary"
                />
              </div>
            )}

            {report.dates.length > 0 && (
              <ul className="space-y-2">
                {report.dates.map((date, index) => (
                  <DateRow
                    key={`${date.category}-${date.date ?? date.dateText}-${index}`}
                    date={date}
                    course={course}
                  />
                ))}
              </ul>
            )}

            {report.sources.length > 0 && (
              <details className="text-sm">
                <summary className="cursor-pointer text-muted-foreground">
                  Pages checked ({report.sources.length})
                </summary>
                <ul className="mt-2 space-y-1">
                  {report.sources.map((source) => (
                    <li key={source.url}>
                      <a
                        href={source.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-1 text-primary hover:underline break-all"
                      >
                        {source.title || source.url}
                        <ExternalLink className="size-3 shrink-0" />
                      </a>
                    </li>
                  ))}
                </ul>
              </details>
            )}

            <p className="text-xs text-muted-foreground">
              Dates are read automatically from the university website and can change —
              confirm on the official page before applying.
            </p>
          </div>
        )}

        <DialogFooter>
          <Button onClick={handleLookup} disabled={loading}>
            {loading ? (
              <Loader2 className="animate-spin" />
            ) : report ? (
              <RefreshCw />
            ) : (
              <CalendarSearch />
            )}
            {loading ? "Searching…" : report ? "Search again" : "Search university website"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
