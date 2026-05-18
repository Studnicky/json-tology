/**
 * DefaultAlignedType — Signature
 *
 * The canonical declaration of DefaultAlignedType<T>: compile-time
 * guard that resolves to the schema type `T` when every property with
 * a `default` value carries a default that matches its declared
 * `type`, and resolves to `never` otherwise. Checks `string`,
 * `boolean`, `integer`, and `number`; unrecognised property shapes
 * pass through.
 */

import type { DefaultAlignedType } from '../../../src/types/index.js';

// Type declaration mirrors the canonical export in src/types/Infer.ts:
//
// export type DefaultAlignedType<T>
//   = T extends { readonly 'properties': infer TP }
//     ? CheckPropertyDefaultsType<TP> extends true ? T : never
//     : T;

const _AlignedSchema = {
  'properties': {
    'currency': {
      'default': 'USD',
      'type': 'string'
    },
    'inStock': {
      'default': true,
      'type': 'boolean'
    }
  },
  'type': 'object'
} as const;

type Aligned = DefaultAlignedType<typeof _AlignedSchema>;
// typeof _AlignedSchema — defaults are aligned, the schema passes through.

const aligned: Aligned = _AlignedSchema;

void aligned;
