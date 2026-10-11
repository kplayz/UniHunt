import type { ImportantDateCategory } from "./types";

/**
 * Client-safe labels for important-date categories. Kept separate from
 * `important-dates.ts`, which pulls in server-only Brave and model clients.
 */
const CATEGORY_LABELS: Record<ImportantDateCategory, string> = {
  application_open: "Applications open",
  application_deadline: "Application deadline",
  entrance_exam: "Entrance exam / test",
  scholarship: "Scholarship",
  offer_or_result: "Results / offers",
  fee_payment: "Fee payment",
  session_start: "Session start",
  orientation: "Orientation",
  other: "Other date",
};

export function importantDateCategoryLabel(category: ImportantDateCategory): string {
  return CATEGORY_LABELS[category] ?? CATEGORY_LABELS.other;
}
