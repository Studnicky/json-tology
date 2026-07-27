import type { InferType } from '../types/Schema.js';

/**
 * SetEntryEntity — a single entry accepted by `SchemaRegistry.set()`.
 *
 * Either a bare schema object or a tuple of `[schema, iri]` where the IRI
 * overrides the schema's own `$id` as the registry key.
 *
 * `prefixItems` is a Draft 2020-12 keyword this project's own `InferType` infers
 * as a closed tuple; the `json-schema-to-ts` `JSONSchema` type does not model it
 * (it only knows the older `items` array-tuple form), so this schema is left
 * unchecked against that external type rather than widened to fit it.
 */
export namespace SetEntryEntity {
  export const Schema = {
    'oneOf': [
      {
        'maxItems': 2,
        'minItems': 2,
        'prefixItems': [
          { 'type': 'object' },
          { 'type': 'string' }
        ],
        'type': 'array'
      },
      { 'type': 'object' }
    ]
  } as const;

  export type Type = InferType<typeof Schema>;

  export function validate(candidate: unknown): candidate is Type {
    if (Array.isArray(candidate)) {
      return candidate.length === 2
        && typeof candidate[0] === 'object' && candidate[0] !== null
        && typeof candidate[1] === 'string';
    }

    return typeof candidate === 'object' && candidate !== null;
  }
}
