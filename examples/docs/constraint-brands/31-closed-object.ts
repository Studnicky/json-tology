/**
 * Object brands — `additionalProperties: false` closed object.
 *
 * With `objectBrands: true` (the default), excess property keys are
 * flagged as `never` at compile time when the schema declares both
 * `properties` and `additionalProperties: false`.
 */

import type { InferType } from '../../../src/types/index.js';

const _ClosedSchema = {
  'additionalProperties': false,
  'properties': { 'name': { 'type': 'string' } },
  'type': 'object'
} as const;

type Closed = InferType<typeof _ClosedSchema>;

const valid: Closed = { 'name': 'Bastian Balthazar Bux' };

console.log('Closed object:', valid);
console.log('name property:', valid.name);
