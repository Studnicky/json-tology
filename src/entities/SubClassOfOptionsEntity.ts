import type { JSONSchema } from 'json-schema-to-ts';
import type { InferType } from '../types/Schema.js';

/**
 * Options accepted by {@link SchemaCursorInterface.subClassOf}.
 */
export namespace SubClassOfOptionsEntity {
  export const Schema = {
    'properties': {
      /** When `true`, walk the full superclass chain (BFS, cycle-guarded) rather than stopping at direct parents. */
      'transitive': { 'type': 'boolean' }
    },
    'type': 'object'
  } as const satisfies JSONSchema;

  export type Type = InferType<typeof Schema>;

  export function validate(candidate: unknown): candidate is Type {
    if (typeof candidate !== 'object' || candidate === null) {
      return false;
    }

    const value = candidate as Record<string, unknown>;

    return value.transitive === undefined || typeof value.transitive === 'boolean';
  }
}
