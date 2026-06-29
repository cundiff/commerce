import type { AvailabilityStatus } from "lib/types";

export function getAvailabilityLabel(status: AvailabilityStatus): string {
  switch (status) {
    case "in-stock":
      return "In stock";
    case "low-stock":
      return "Low stock";
    case "backorder":
      return "Backorder";
    case "out-of-stock":
    default:
      return "Out of stock";
  }
}

export function getAvailabilityBadgeClass(status: AvailabilityStatus): string {
  switch (status) {
    case "in-stock":
      return "border border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-900 dark:bg-emerald-950/40 dark:text-emerald-300";
    case "low-stock":
      return "border border-amber-200 bg-amber-50 text-amber-700 dark:border-amber-900 dark:bg-amber-950/40 dark:text-amber-300";
    case "backorder":
      return "border border-indigo-200 bg-indigo-50 text-indigo-700 dark:border-indigo-900 dark:bg-indigo-950/40 dark:text-indigo-300";
    case "out-of-stock":
    default:
      return "border border-neutral-200 bg-neutral-100 text-neutral-600 dark:border-neutral-700 dark:bg-neutral-900 dark:text-neutral-300";
  }
}
