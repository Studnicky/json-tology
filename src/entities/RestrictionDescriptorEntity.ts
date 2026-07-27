import type { JSONSchema } from 'json-schema-to-ts';
import type { InferType } from '../types/Schema.js';
import { RawRestrictionDescriptorEntity } from './RawRestrictionDescriptorEntity.js';

/**
 * Descriptor payload embedded inside a restriction phantom tag
 * (see `RestrictionReferenceEntity` / `TypedRestrictionReferenceInterface`
 * in `src/interfaces/`).
 *
 * @remarks
 * Carries the three fields that fully describe an OWL 2 property restriction:
 * the restriction `kind` (which OWL axiom to emit), the `onProperty` IRI, and
 * the `value` (class IRI, individual IRI, or literal). Produced exclusively by
 * the `Compose.*` restriction factory methods; consumers should not construct
 * this shape directly.
 *
 * @example
 * ```ts
 * const descriptor: RestrictionDescriptorEntity.Type = {
 *   kind: 'hasValue',
 *   onProperty: 'https://schema.org/color',
 *   value: 'red',
 * };
 * ```
 *
 * @category Schema Utilities
 * @since 0.10.0
 * @group Schema Utilities
 */
export namespace RestrictionDescriptorEntity {
  export const Schema = {
    'additionalProperties': false,
    'properties': {
      'kind': {
        'enum': [
          'allValuesFrom',
          'cardinality',
          'hasValue',
          'maxCardinality',
          'minCardinality',
          'someValuesFrom'
        ]
      },
      'onProperty': RawRestrictionDescriptorEntity.Schema.properties.onProperty,
      'value': {
        'type': [
          'boolean',
          'number',
          'string'
        ]
      }
    },
    'required': RawRestrictionDescriptorEntity.Schema.required,
    'type': RawRestrictionDescriptorEntity.Schema.type
  } as const satisfies JSONSchema;

  export type Type = InferType<typeof Schema>;

  export function validate(candidate: unknown): candidate is Type {
    if (typeof candidate !== 'object' || candidate === null) {
      return false;
    }

    const value = candidate as Record<string, unknown>;

    return typeof value.kind === 'string' && (Schema.properties.kind.enum as readonly string[]).includes(value.kind)
      && typeof value.onProperty === 'string'
      && (typeof value.value === 'boolean' || typeof value.value === 'number' || typeof value.value === 'string');
  }
}
