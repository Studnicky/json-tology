import type { JSONSchema } from 'json-schema-to-ts';
import type { InferType } from '../types/Schema.js';

/**
 * Discriminant literal union for OWL 2 property restriction kinds.
 *
 * @remarks
 * Each member corresponds to an OWL 2 property restriction axiom keyword:
 * `allValuesFrom` (universal), `someValuesFrom` (existential), `hasValue`
 * (individual or literal), `cardinality` (exact), `minCardinality`, and
 * `maxCardinality`. Used as the `kind` discriminant on
 * `RestrictionDescriptorEntity.Type` (see `src/entities/RestrictionDescriptorEntity.ts`).
 *
 * @example
 * ```ts
 * const kind: RestrictionKindEntity.Type = 'someValuesFrom';
 * ```
 *
 * @category Schema Utilities
 * @since 0.10.0
 * @group Schema Utilities
 */
export namespace RestrictionKindEntity {
  export const Schema = {
    'enum': [
      'allValuesFrom',
      'cardinality',
      'hasValue',
      'maxCardinality',
      'minCardinality',
      'someValuesFrom'
    ],
    'type': 'string'
  } as const satisfies JSONSchema;

  export type Type = InferType<typeof Schema>;

  export function validate(candidate: unknown): candidate is Type {
    return candidate === 'allValuesFrom'
      || candidate === 'cardinality'
      || candidate === 'hasValue'
      || candidate === 'maxCardinality'
      || candidate === 'minCardinality'
      || candidate === 'someValuesFrom';
  }
}
