/**
 * Orders QS World Rankings best-first. A missing ranking always sorts after a
 * known one, in either sort direction, so unranked universities never displace
 * ranked ones at the top of a table.
 */
export function compareRanking(a: number | null, b: number | null): number {
  if (a === b) return 0;
  if (a === null) return 1;
  if (b === null) return -1;
  return a - b;
}
