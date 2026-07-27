import type { JSONSchema } from 'json-schema-to-ts';
import type { InferType } from '../types/Schema.js';
import { NamedNodeKindEntity } from './NamedNodeKindEntity.js';
import { BlankNodeKindEntity } from './BlankNodeKindEntity.js';
import { DefaultGraphKindEntity } from './DefaultGraphKindEntity.js';

/**
 * Term kinds valid in an RDF quad's graph slot: an IRI (`NamedNode`), a
 * `BlankNode`, or `DefaultGraph`. Composed from the three atomic term-kind
 * entities rather than a hand-rolled literal union.
 */
export namespace GraphTermKindEntity {
  export const Schema = {
    'anyOf': [
      NamedNodeKindEntity.Schema,
      BlankNodeKindEntity.Schema,
      DefaultGraphKindEntity.Schema
    ]
  } as const satisfies JSONSchema;

  export type Type = InferType<typeof Schema>;

  export function validate(candidate: unknown): candidate is Type {
    return NamedNodeKindEntity.validate(candidate)
      || BlankNodeKindEntity.validate(candidate)
      || DefaultGraphKindEntity.validate(candidate);
  }
}
