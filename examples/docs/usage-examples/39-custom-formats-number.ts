/**
 * Custom formats — number formats
 *
 * The `formats` map handles number formats too. The validator
 * receives the number value directly. Demonstrated via a fresh
 * JsonTology instance that registers a `positive-int` format and a
 * matching schema derived from the bookstore `QuantitySchema`.
 */

import { JsonTology } from '../../../src/index.js';
import { QuantitySchema } from '../bookstore/index.js';

const PositiveCountSchema = {
  '$id': 'https://bookstore.example/PositiveCount',
  'format': 'positive-int',
  'type': 'integer'
} as const;

function isPositiveInt(value: unknown): boolean {
  return typeof value === 'number' && Number.isInteger(value) && value > 0;
}

const formats: Record<string, (value: unknown) => boolean> = { 'positive-int': isPositiveInt };

const jt = JsonTology.create({
  'baseIri': 'https://bookstore.example',
  formats,
  'schemas': [
    PositiveCountSchema,
    QuantitySchema
  ] as const
});

// Bastian's order line carries quantity 1 — a positive integer.
console.assert(jt.validate(PositiveCountSchema.$id, 1).length === 0);
console.assert(jt.validate(PositiveCountSchema.$id, 0).length > 0);
console.assert(jt.validate(PositiveCountSchema.$id, -3).length > 0);
// 0
console.log('quantity 1 errors:', jt.validate(PositiveCountSchema.$id, 1).length);
// > 0 — not positive
console.log('quantity 0 errors:', jt.validate(PositiveCountSchema.$id, 0).length);
// > 0 — negative
console.log('quantity -3 errors:', jt.validate(PositiveCountSchema.$id, -3).length);
