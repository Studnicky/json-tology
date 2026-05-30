/**
 * Anti-pattern: a self-equivalent declaration where `options.$id` equals
 * `source.$id`. The compiler surfaces a `SelfEquivalentType` brand at the
 * call site so the mistake fails to compile.
 */

import { Compose } from '../../../src/index.js';
import { IsbnSchema } from '../bookstore/index.js';

// ✗ Compile error — `options.$id` collides with `source.$id`.
// @ts-expect-error SelfEquivalentType brand fires on $id collision
const _Bad = Compose.equivalent(IsbnSchema, { '$id': IsbnSchema.$id });

console.log('Self-equivalent anti-pattern: options.$id must differ from source.$id:', IsbnSchema.$id);
void 0 as unknown as typeof _Bad;
