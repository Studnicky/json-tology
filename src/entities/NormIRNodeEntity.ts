import type { InferType } from '../types/Schema.js';

/**
 * Identity record for a single node in the normalized intermediate representation.
 *
 * @remarks
 * Pairs a schema node's absolute IRI with the JSON Pointer used to locate it
 * within the root schema document. These two coordinates uniquely identify any
 * subschema, including anonymous nodes reached through `$defs`, `properties`,
 * composition branches, or conditional sub-schemas.
 *
 * @example
 * ```ts
 * const node: NormIRNodeEntity.Type = {
 *   id: 'https://example.com/User#/properties/address',
 *   pointer: '/properties/address',
 * };
 * ```
 *
 * @category SchemaGraph
 * @since 0.1.0
 * @group SchemaGraph
 */
export namespace NormIRNodeEntity {
  export const Schema = {
    'properties': {
      'id': { 'type': 'string' },
      'pointer': { 'type': 'string' }
    },
    'required': [
      'id',
      'pointer'
    ],
    'type': 'object'
  } as const;

  export type Type = InferType<typeof Schema>;

  export function validate(candidate: unknown): candidate is Type {
    if (typeof candidate !== 'object' || candidate === null) {
      return false;
    }

    const value = candidate as Record<string, unknown>;

    return typeof value.id === 'string'
      && typeof value.pointer === 'string';
  }
}
