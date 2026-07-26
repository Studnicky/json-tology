import type { JSONSchema } from 'json-schema-to-ts';
import type { InferType } from '../types/Schema.js';

/**
 * Named return type for {@link buildNameMap}.
 *
 * `nameMap` is an IRI-to-PascalCase-name map.  `collisions` is the set of
 * base names for which at least two IRIs produced the same local name — those
 * entries are suffixed with `_2`, `_3`, etc. in `nameMap`.
 *
 * @remarks
 * Used internally by `OwlCodegen.toTypeScript` and `OwlCodegen.toRegistryFiles` to
 * ensure every OWL class gets a unique TypeScript identifier.
 *
 * @example
 * ```ts
 * const { nameMap, collisions } = buildNameMap(iris);
 * ```
 *
 * @category Codegen
 * @since 0.18.0
 * @see {@link OwlCodegen.toTypeScript}
 * @group OWL Codegen
 */
export namespace BuildNameMapResultEntity {
  export const Schema = {
    'additionalProperties': false,
    'properties': {
      /** Deduplicated list of base names that collided (used for banner warnings). */
      'collisions': {
        'items': { 'type': 'string' },
        'type': 'array'
      },
      /** Map from IRI to its assigned PascalCase identifier. */
      'nameMap': {
        'additionalProperties': { 'type': 'string' },
        'type': 'object'
      }
    },
    'required': [
      'collisions',
      'nameMap'
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
      && value.collisions.every((entry) => {
        return typeof entry === 'string';
      })
      && typeof value.nameMap === 'object' && value.nameMap !== null
      && Object.values(value.nameMap as Record<string, unknown>).every((entry) => {
        return typeof entry === 'string';
      });
  }
}
