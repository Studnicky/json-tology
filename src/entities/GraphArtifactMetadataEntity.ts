import type { JSONSchema } from 'json-schema-to-ts';
import type { InferType } from '../types/Schema.js';

/** Staleness-verification metadata carried by a serialized graph artifact. */
export namespace GraphArtifactMetadataEntity {
  export const Schema = {
    'properties': { 'schemaHash': { 'type': 'string' } },
    'required': ['schemaHash'],
    'type': 'object'
  } as const satisfies JSONSchema;

  export type Type = InferType<typeof Schema>;

  export function validate(candidate: unknown): candidate is Type {
    if (typeof candidate !== 'object' || candidate === null) {
      return false;
    }

    const value = candidate as Record<string, unknown>;

    return typeof value.schemaHash === 'string';
  }
}
