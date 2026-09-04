/** Small numeric helpers shared across the sim and its harnesses. */

/**
 * The middle value of a list, averaging the two middle values on an even
 * count.
 *
 * An empty list has no middle value; this returns 0 rather than `undefined`
 * because the one caller that can actually hit an empty list --
 * `diversity.ts`, before any build has finished -- needs a number to report,
 * not a hole to guard against.
 */
export function median(values: number[]): number {
  if (values.length === 0) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 0 ? (sorted[mid - 1]! + sorted[mid]!) / 2 : sorted[mid]!;
}
