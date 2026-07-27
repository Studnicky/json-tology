import type { JSONSchema } from 'json-schema-to-ts';
import type { InferType } from '../types/Schema.js';
import { NamedNodeKindEntity } from './NamedNodeKindEntity.js';
import { BlankNodeKindEntity } from './BlankNodeKindEntity.js';

/**
 * An RDF "resource" term-kind — a term that can identify (rather than merely
 * hold) a value: an IRI (`NamedNode`) or a `BlankNode`. Composed from the two
 * atomic term-kind entities rather than a hand-rolled literal union.
 */
export namespace ResourceTermKindEntity {
  export const Schema = {
    'anyOf': [
      NamedNodeKindEntity.Schema,
      BlankNodeKindEntity.Schema
    ]
  } as const satisfies JSONSchema;

  export type Type = InferType<typeof Schema>;

  export function validate(candidate: unknown): candidate is Type {
    return NamedNodeKindEntity.validate(candidate) || BlankNodeKindEntity.validate(candidate);
  }

  /**
   * Narrows a `{ termType: unknown }`-shaped value to its resource-typed variant.
   * Unlike {@link validate} (which only narrows the `termType` field itself), this
   * narrows the containing object — needed at call sites that rely on TypeScript's
   * discriminated-union narrowing over the whole term (e.g. an rdf/js `Quad` object).
   */
  export function validateObject<T extends { 'termType': unknown }>(candidate: T): candidate is Extract<T, { 'termType': Type }> {
    const isResource = validate(candidate.termType);

    return isResource;
  }
}
