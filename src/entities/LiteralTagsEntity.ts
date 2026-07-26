import type { InferType } from '../types/Schema.js';

/**
 * The optional `termType`, `language`, and `datatype` annotations that travel
 * alongside a relation when its source quad's object is a Literal, BlankNode,
 * or NamedNode.
 *
 * @remarks
 * All three fields are optional: `Quad` and `Variable` objects produce an
 * empty object; `NamedNode` produces only `termType`; `Literal` produces all
 * three.
 *
 * @category Graph
 * @since 0.18.0
 * @see {@link QuadBackedSchemaGraph}
 * @group Graph
 */
export namespace LiteralTagsEntity {
  export const Schema = {
    'properties': {
      'datatype': { 'type': 'string' },
      'language': { 'type': 'string' },
      'termType': {
        'enum': [
          'BlankNode',
          'Literal',
          'NamedNode'
        ]
      }
    },
    'type': 'object'
  } as const;

  export type Type = InferType<typeof Schema>;

  export function validate(candidate: unknown): candidate is Type {
    if (typeof candidate !== 'object' || candidate === null) {
      return false;
    }

    const value = candidate as Record<string, unknown>;

    return (value.datatype === undefined || typeof value.datatype === 'string')
      && (value.language === undefined || typeof value.language === 'string')
      && (value.termType === undefined || value.termType === 'BlankNode' || value.termType === 'Literal' || value.termType === 'NamedNode');
  }
}
