/**
 * IntegerRangeType — Example: Small page-size range for a paginated
 * query.
 *
 * The `pageSize` argument is compile-time bounded between 1 and 25.
 * Callers cannot pass `0` or `26`; no runtime min/max guard is needed.
 */

import type { IntegerRangeType } from '../../../src/types/index.js';

type PageSize = IntegerRangeType<1, 25>;
// 1 | 2 | 3 | ... | 25

async function fetchBooks(
  page: number,
  pageSize: PageSize
): Promise<readonly unknown[]> {
  // pageSize is compile-time bounded — no need for a runtime guard.
  void page;
  void pageSize;

  return [];
}

const page1 = await fetchBooks(1, 20);

console.assert(Array.isArray(page1));
console.assert(page1.length === 0);
