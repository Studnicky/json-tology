import type { JSONSchema } from 'json-schema-to-ts';
import type { InferType } from '../types/Schema.js';

/**
 * Edge representing a relationship between schemas.
 *
 * `label` — property or relationship name.
 * `source` — source schema ID.
 * `target` — target schema ID.
 */
export namespace VizEdgeEntity {
  export const Schema = {
    'properties': {
      'label': { 'type': 'string' },
      'source': { 'type': 'string' },
      'target': { 'type': 'string' }
    },
    'required': [
      'label',
      'source',
      'target'
    ],
    'type': 'object'
  } as const satisfies JSONSchema;

  export type Type = InferType<typeof Schema>;

  export function validate(candidate: unknown): candidate is Type {
    if (typeof candidate !== 'object' || candidate === null) {
      return false;
    }

    const value = candidate as Record<string, unknown>;

    return typeof value.label === 'string'
      && typeof value.source === 'string'
      && typeof value.target === 'string';
  }
}
