/**
 * order_number is stored as TEXT, so database ordering is lexicographic
 * ("999" sorts above "1000"). Use this comparator to sort numerically,
 * newest (highest) order number first. Non-numeric / missing values go last.
 */
export function orderNumberValue(orderNumber: string | null | undefined): number {
  if (!orderNumber) return Number.NEGATIVE_INFINITY;
  const n = parseInt(orderNumber.replace(/[^0-9]/g, ''), 10);
  return Number.isNaN(n) ? Number.NEGATIVE_INFINITY : n;
}

export function compareOrderNumberDesc(
  a: { order_number: string | null | undefined },
  b: { order_number: string | null | undefined },
): number {
  return orderNumberValue(b.order_number) - orderNumberValue(a.order_number);
}

/**
 * Newest job first by created_at (Printavo and Shopify order numbers overlap,
 * so date is the reliable "recent" signal), then by numeric order number.
 */
export function compareJobsNewestFirst(
  a: { created_at: string; order_number: string | null | undefined },
  b: { created_at: string; order_number: string | null | undefined },
): number {
  const diff = new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
  return diff !== 0 ? diff : compareOrderNumberDesc(a, b);
}
