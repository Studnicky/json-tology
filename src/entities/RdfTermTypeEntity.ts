import type { JSONSchema } from 'json-schema-to-ts';
import type { InferType } from '../types/Schema.js';

/** The rdf/js term-type discriminator (`'BlankNode' | 'Literal' | 'NamedNode'`). */
export namespace RdfTermTypeEntity {
  export const Schema = {
    'enum': [
      'BlankNode',
      'Literal',
      'NamedNode'
    ],
    'type': 'string'
  } as const satisfies JSONSchema;

  export type Type = InferType<typeof Schema>;

  export function validate(candidate: unknown): candidate is Type {
    return candidate === 'BlankNode' || candidate === 'Literal' || candidate === 'NamedNode';
  }
}
