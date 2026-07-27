import type { JSONSchema } from 'json-schema-to-ts';
import type { InferType } from '../types/Schema.js';

/** The rdf/js `BlankNode` term-kind discriminator literal. */
export namespace BlankNodeKindEntity {
  export const Schema = {
    'const': 'BlankNode',
    'type': 'string'
  } as const satisfies JSONSchema;

  export type Type = InferType<typeof Schema>;

  export function validate(candidate: unknown): candidate is Type {
    return candidate === 'BlankNode';
  }
}
