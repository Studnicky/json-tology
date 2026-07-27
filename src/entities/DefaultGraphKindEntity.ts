import type { JSONSchema } from 'json-schema-to-ts';
import type { InferType } from '../types/Schema.js';

/** The rdf/js `DefaultGraph` term-kind discriminator literal. */
export namespace DefaultGraphKindEntity {
  export const Schema = {
    'const': 'DefaultGraph',
    'type': 'string'
  } as const satisfies JSONSchema;

  export type Type = InferType<typeof Schema>;

  export function validate(candidate: unknown): candidate is Type {
    return candidate === 'DefaultGraph';
  }
}
