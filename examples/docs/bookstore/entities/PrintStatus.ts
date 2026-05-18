export const PrintStatusSchema = {
  '$id': 'urn:bookstore:PrintStatus',
  // Publisher state — editorial, changes rarely. Distinct from operational
  // inventory state (`Book.inStock`), which is daily-mutable. A book can be
  // `inStock: true` and `printStatus: 'outOfPrint'` simultaneously (leftover
  // copies on hand, publisher has discontinued the title).
  'enum': [
    'inPrint',
    'outOfPrint',
    'limitedRun'
  ],
  'type': 'string'
} as const;
