import type { JSONSchema } from 'json-schema-to-ts';
import type { InferType } from '../types/Schema.js';

/** The rdf/js `NamedNode` term-kind discriminator literal. */
export namespace NamedNodeKindEntity {
  export const Schema = {
    'const': 'NamedNode',
    'type': 'string'
  } as const satisfies JSONSchema;

  export type Type = InferType<typeof Schema>;

  export function validate(candidate: unknown): candidate is Type {
    return candidate === 'NamedNode';
  }
}
