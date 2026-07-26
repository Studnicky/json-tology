import type { JSONSchema } from 'json-schema-to-ts';
import type { InferType } from '../types/Schema.js';

/**
 * Options object for the {@link emitBanner} helper.
 *
 * @remarks
 * Bundles the parameters needed to emit the auto-generated banner comment
 * block into a single options shape, satisfying the parameter-count limit.
 *
 * @example
 * ```ts
 * emitBanner(lines, { ts, sourceLabel, collisions, header });
 * ```
 *
 * @category Codegen
 * @since 0.18.0
 * @see {@link OwlCodegen.toTypeScript}
 * @group OWL Codegen
 */
export namespace EmitBannerOptionsEntity {
  export const Schema = {
    'additionalProperties': false,
    'properties': {
      /** Deduplicated list of IRI base names that collided during name generation. */
      'collisions': {
        'items': { 'type': 'string' },
        'type': 'array'
      },
      /** Extra comment lines to append after the standard banner. */
      'header': {
        'items': { 'type': 'string' },
        'type': 'array'
      },
      /** Human-readable source label (file path or IRI), or empty string. */
      'sourceLabel': { 'type': 'string' },
      /** ISO-8601 timestamp string. */
      'ts': { 'type': 'string' }
    },
    'required': [
      'collisions',
      'header',
      'sourceLabel',
      'ts'
    ],
    'type': 'object'
  } as const satisfies JSONSchema;

  export type Type = InferType<typeof Schema>;

  export function validate(candidate: unknown): candidate is Type {
    if (typeof candidate !== 'object' || candidate === null) {
      return false;
    }

    const value = candidate as Record<string, unknown>;

    return Array.isArray(value.collisions)
      && Array.isArray(value.header)
      && typeof value.sourceLabel === 'string'
      && typeof value.ts === 'string';
  }
}
