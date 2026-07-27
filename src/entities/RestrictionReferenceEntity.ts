import type { JSONSchema } from 'json-schema-to-ts';
import type { InferType } from '../types/Schema.js';
import { RestrictionDescriptorEntity } from './RestrictionDescriptorEntity.js';

/**
 * Phantom-tagged wrapper that marks a schema as carrying an OWL 2 restriction.
 *
 * @remarks
 * The `'~jt:restriction'` key is a compile-time-only phantom tag. The only
 * valid producers are the `Compose.*` restriction factory methods
 * (`Compose.someValuesFrom`, `Compose.allValuesFrom`, `Compose.hasValue`,
 * `Compose.cardinality`, `Compose.minimumCardinality`, `Compose.maximumCardinality`).
 * The OWL TBox projection reads this tag to emit an anonymous
 * `owl:Restriction` blank node when the restriction is composed via
 * `Compose.subClassOf(restriction, body)`.
 *
 * @example
 * ```ts
 * const ref: RestrictionReferenceEntity.Type = Compose.hasValue('https://schema.org/color', 'red');
 * ```
 *
 * @category Schema Utilities
 * @since 0.10.0
 * @see {@link TypedRestrictionReferenceInterface}
 * @group Schema Utilities
 */
export namespace RestrictionReferenceEntity {
  export const Schema = {
    'additionalProperties': false,
    'properties': { '~jt:restriction': RestrictionDescriptorEntity.Schema },
    'required': ['~jt:restriction'],
    'type': 'object'
  } as const satisfies JSONSchema;

  export type Type = InferType<typeof Schema>;

  export function validate(candidate: unknown): candidate is Type {
    if (typeof candidate !== 'object' || candidate === null) {
      return false;
    }

    const value = candidate as Record<string, unknown>;

    return RestrictionDescriptorEntity.validate(value['~jt:restriction']);
  }
}
