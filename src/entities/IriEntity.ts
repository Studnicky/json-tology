import type { JSONSchema } from 'json-schema-to-ts';
import type { InferType } from '../types/Schema.js';

/** A single IRI string identifying a graph subject, class, or schema. */
export namespace IriEntity {
  export const Schema = { 'type': 'string' } as const satisfies JSONSchema;

  export type Type = InferType<typeof Schema>;

  export function validate(candidate: unknown): candidate is Type {
    return typeof candidate === 'string';
  }
}
