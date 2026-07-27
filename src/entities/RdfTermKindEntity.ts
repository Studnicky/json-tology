import type { JSONSchema } from 'json-schema-to-ts';
import type { InferType } from '../types/Schema.js';
import { NamedNodeKindEntity } from './NamedNodeKindEntity.js';
import { BlankNodeKindEntity } from './BlankNodeKindEntity.js';
import { LiteralKindEntity } from './LiteralKindEntity.js';

/**
 * The rdf/js term-type discriminator for a value-bearing term: an IRI
 * (`NamedNode`), a `BlankNode`, or a `Literal`. Composed from the three
 * atomic term-kind entities rather than a hand-rolled literal union.
 */
export namespace RdfTermKindEntity {
  export const Schema = {
    'anyOf': [
      NamedNodeKindEntity.Schema,
      BlankNodeKindEntity.Schema,
      LiteralKindEntity.Schema
    ]
  } as const satisfies JSONSchema;

  export type Type = InferType<typeof Schema>;

  export function validate(candidate: unknown): candidate is Type {
    return NamedNodeKindEntity.validate(candidate)
      || BlankNodeKindEntity.validate(candidate)
      || LiteralKindEntity.validate(candidate);
  }
}
