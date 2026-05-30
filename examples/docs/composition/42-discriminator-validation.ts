/**
 * Compose.discriminatedUnion — Discriminator argument validation
 *
 * Every variant must declare `properties[prop]` as `const` and list
 * `prop` in `required`. A well-formed variant set lets
 * `Compose.discriminatedUnion` build a sound union.
 *
 * Variants must directly expose `properties[discriminator].const` at the
 * top level for the compile-time validator to accept them. These schemas
 * satisfy the contract explicitly.
 */

import { Compose } from '../../../src/index.js';

const InPrintVariantSchema = {
  '$id': 'https://bookstore.example/InPrintVariant3',
  'properties': {
    'authors': {
      'items': { 'type': 'string' },
      'minItems': 1,
      'type': 'array'
    },
    'inStock': { 'type': 'boolean' },
    'isbn': { 'type': 'string' },
    'price': { 'type': 'object' },
    'printStatus': { 'const': 'inPrint' },
    'title': { 'type': 'string' }
  },
  'required': [
    'isbn',
    'title',
    'authors',
    'price',
    'printStatus',
    'inStock'
  ],
  'type': 'object'
} as const;

const OutOfPrintVariantSchema = {
  '$id': 'https://bookstore.example/OutOfPrintVariant3',
  'properties': {
    'authors': {
      'items': { 'type': 'string' },
      'minItems': 1,
      'type': 'array'
    },
    'isbn': { 'type': 'string' },
    'price': { 'type': 'object' },
    'printStatus': { 'const': 'outOfPrint' },
    'title': { 'type': 'string' }
  },
  'required': [
    'isbn',
    'title',
    'authors',
    'price',
    'printStatus'
  ],
  'type': 'object'
} as const;

const PrintStatusUnionSchema = Compose.discriminatedUnion(
  'printStatus',
  [
    InPrintVariantSchema,
    OutOfPrintVariantSchema
  ] as const,
  'https://bookstore.example/PrintStatusUnion'
);

const unionId: string = PrintStatusUnionSchema.$id;

console.assert(unionId.endsWith('PrintStatusUnion'));
