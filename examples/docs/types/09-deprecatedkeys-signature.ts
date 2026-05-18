/**
 * DeprecatedKeysType — Signature
 *
 * The canonical declaration of DeprecatedKeysType<T>: extracts the
 * union of property keys marked `deprecated: true` from an object
 * schema literal. Returns `never` when no properties carry the
 * annotation.
 */

import type { DeprecatedKeysType } from '../../../src/types/index.js';

// Type declaration mirrors the canonical export in src/types/Infer.ts:
//
// export type DeprecatedKeysType<T>
//   = T extends { readonly 'properties': infer P }
//     ? { [K in keyof P & string]: P[K] extends { readonly 'deprecated': true } ? K : never
//       }[keyof P & string]
//     : never;

const _BookV1Schema = {
  '$id': 'https://bookstore.example/BookV1',
  'properties': {
    'isbn': { 'type': 'string' },
    'legacySku': {
      'deprecated': true,
      'type': 'string'
    },
    'title': { 'type': 'string' }
  },
  'required': [
    'isbn',
    'title'
  ],
  'type': 'object'
} as const;

type DeprecatedBookKeys = DeprecatedKeysType<typeof _BookV1Schema>;

// 'legacySku' is the only deprecated key in the schema above
const deprecatedKey: DeprecatedBookKeys = 'legacySku';

void deprecatedKey;
