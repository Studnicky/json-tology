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

const jt = JsonTology.create({
  'baseIRI': 'https://bookstore.example',
  'formats': { 'positive-int': isPositiveInt },
  'schemas': [
    PositiveCountSchema,
    QuantitySchema
  ] as const
});

// Bastian's order line carries quantity 1 — a positive integer.
console.assert(jt.validate(PositiveCountSchema.$id, 1).length === 0);
console.assert(jt.validate(PositiveCountSchema.$id, 0).length > 0);
console.assert(jt.validate(PositiveCountSchema.$id, -3).length > 0);
