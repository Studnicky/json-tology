import type { InferType } from '../types/Schema.js';

/**
 * Item produced by `SchemaGraphInterface.collectList` when walking an
 * `rdf:first` / `rdf:rest` / `rdf:nil` chain.
 *
 * Preserves the term shape from the underlying quad store so callers can
 * distinguish blank nodes (anonymous class expressions / facet bnodes),
 * named nodes (IRI references), and literals (with language tags / datatype
 * IRIs) without having to walk raw quads themselves.
 */
export namespace ListItemEntity {
  export const Schema = {
    'properties': {
      'datatype': { 'type': 'string' },
      'language': { 'type': 'string' },
      'target': { 'type': 'string' },
      'termType': {
        'enum': [
          'BlankNode',
          'Literal',
          'NamedNode'
        ]
      }
    },
    'required': [
      'target',
      'termType'
    ],
    'type': 'object'
  } as const;

  export type Type = InferType<typeof Schema>;

  export function validate(candidate: unknown): candidate is Type {
    if (typeof candidate !== 'object' || candidate === null) {
      return false;
    }

    const value = candidate as Record<string, unknown>;

    return typeof value.target === 'string'
      && (value.termType === 'BlankNode' || value.termType === 'Literal' || value.termType === 'NamedNode')
      && (value.datatype === undefined || typeof value.datatype === 'string')
      && (value.language === undefined || typeof value.language === 'string');
  }
}
