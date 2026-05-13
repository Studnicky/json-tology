/**
 * StockLevel — primitive demonstrating bounded multipleOf literal-union narrowing.
 *
 * InferType resolves to the union: 0 | 5 | 10 | 15 | 20 | 25 | 30 | 35 | 40 | 45 | 50
 * (multiples of 5 within [0, 100], capped at IntegerRangeCap = 50).
 *
 * Demonstrates:
 *   - type: 'integer' + minimum + maximum + multipleOf → MultipleOfRangeType<0, 100, 5>
 *   - The IntegerRangeCap (50) bounds the inferred union; values above 50 are valid
 *     at runtime but the compile-time union collapses to `number` above the cap.
 */

export const StockLevelSchema = {
  '$id': 'urn:bookstore:StockLevel',
  'maximum': 100,
  'minimum': 0,
  'multipleOf': 5,
  'type': 'integer'
} as const;
