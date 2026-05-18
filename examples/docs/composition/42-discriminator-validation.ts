/**
 * Compose.discriminatedUnion — Discriminator argument validation
 *
 * Every variant must declare `properties[prop]` as `const` and list
 * `prop` in `required`. A well-formed variant set lets
 * `Compose.discriminatedUnion` build a sound union.
 *
 * The canonical `InPrintBookSchema` and `OutOfPrintBookSchema` both
 * declare `printStatus` as a const literal — the discriminator
 * machinery uses that contract to route validation.
 */

import { Compose } from '../../../src/index.js';
import {
  InPrintBookSchema, OutOfPrintBookSchema
} from '../bookstore/index.js';

const PrintStatusUnionSchema = Compose.discriminatedUnion(
  'printStatus',
  [
    InPrintBookSchema,
    OutOfPrintBookSchema
  ] as const,
  'https://bookstore.example/PrintStatusUnion'
);

const unionId: string = PrintStatusUnionSchema.$id;

console.assert(unionId.endsWith('PrintStatusUnion'));
