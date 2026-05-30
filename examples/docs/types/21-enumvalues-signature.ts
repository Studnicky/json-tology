/**
 * EnumValuesType — Signature
 *
 * The canonical declaration of EnumValuesType<T>: extracts the union of
 * `enum` values from a schema literal. Works on any schema shape that
 * carries an `enum` array; returns `never` when no `enum` is declared.
 */

import type { EnumValuesType } from '../../../src/types/index.js';
import type { PrintStatusSchema } from '../bookstore/index.js';

// Type declaration mirrors the canonical export in src/types/Infer.ts:
//
// export type EnumValuesType<T>
//   = T extends { readonly 'enum': ReadonlyArray<infer V> } ? V : never;

// PrintStatusSchema declares `enum: ['inPrint', 'limitedRun', 'outOfPrint']`.
type PrintStatus = EnumValuesType<typeof PrintStatusSchema>;
// 'inPrint' | 'limitedRun' | 'outOfPrint'

const statuses: PrintStatus[] = [
  'inPrint',
  'limitedRun',
  'outOfPrint'
];

console.log('EnumValuesType<PrintStatusSchema>:', statuses.join(' | '));
console.log('sample value:', statuses[0]);
