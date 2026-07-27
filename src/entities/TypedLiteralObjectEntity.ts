import type { JSONSchema } from 'json-schema-to-ts';
import type { InferType } from '../types/Schema.js';

/**
 * A typed literal object for JSON-LD `@value`/`@type` encoding, or null when unsupported.
 *
 * @remarks
 * Modeled as `oneOf` rather than a top-level `type: ['null', 'object']` array:
 * the project's object inference (`InferObjectType`) only matches a literal
 * `type: 'object'`, so a multi-value `type` array never reaches the
 * object branch and collapses to `never` for that member. `oneOf` infers each
 * branch schema independently, so the `{ type: 'object' }` member resolves to
 * `Record<string, unknown>` as expected.
 */
export namespace TypedLiteralObjectEntity {
  export const Schema = {
    'oneOf': [
      { 'type': 'null' },
      { 'type': 'object' }
    ]
  } as const satisfies JSONSchema;

  export type Type = InferType<typeof Schema>;

  export function validate(candidate: unknown): candidate is Type {
    return candidate === null || (typeof candidate === 'object' && !Array.isArray(candidate));
  }
}
