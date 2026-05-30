/**
 * Anti-pattern: calling `Compose.pick` with a key that does not exist in
 * the source schema's `properties`. The compiler narrows `keys` to
 * `keyof properties`, so the unknown key is rejected at the call site.
 */

import { Compose } from '../../../src/index.js';
import { BookSchema } from '../bookstore/index.js';

// ✗ Compile error — 'nonExistent' is not a key of BookSchema.properties.
const _Bad = Compose.pick(
  BookSchema,
  [
    'isbn',
    // @ts-expect-error 'nonExistent' is not a key of BookSchema.properties
    'nonExistent'
  ] as const,
  'https://bookstore.example/BookIsbnOnly'
);

console.log('pick unknown key anti-pattern: compile-time error for keys not in BookSchema.properties | valid keys:', Object.keys(BookSchema.properties));
void 0 as unknown as typeof _Bad;
