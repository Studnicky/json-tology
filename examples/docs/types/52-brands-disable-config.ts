/**
 * Constraint brands — Example: Disable brands for a project.
 *
 * Create a `.d.ts` anywhere in your `tsconfig include` path and
 * augment the `JsonTologyTypeConfigInterface` module declaration with
 * `brands: false`. All `InferType` results revert to plain TypeScript
 * primitives. Runtime validation is unaffected.
 *
 * The block below is the literal contents of `json-tology.d.ts`:
 *
 *   declare module 'json-tology/types' {
 *     interface JsonTologyTypeConfigInterface {
 *       brands: false; // disables all phantom brands
 *     }
 *   }
 *
 * After adding the declaration, the inferred shape of the Email
 * primitive collapses from `string & FormatBrand<'email'>` to plain
 * `string`. The runtime call to `instantiate` still validates the
 * format — only the static type changes.
 */

import type { InferType } from '../../../src/types/index.js';
import type { EmailSchema } from '../bookstore/index.js';

// With brands enabled (default), the inferred type carries the
// FormatBrand<'email'> intersection.
// With brands disabled via the d.ts above, the same type collapses to
// plain string.
type Email = InferType<typeof EmailSchema>;

// In either configuration, Email is assignable to string.
type AssertExtendsType<TLeft, TRight>
  = [TLeft] extends [TRight] ? true : false;

function assert<T extends true>(_proof?: T): void {
  return;
}

assert<AssertExtendsType<Email, string>>();

const sample: Email = 'bastian@neverending.example' as Email;

console.assert(typeof sample === 'string');
