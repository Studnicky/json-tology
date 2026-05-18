/**
 * Terms — RDF term factory.
 *
 * Produces structurally rdf/js-compatible term objects (NamedNode, BlankNode,
 * Literal, DefaultGraph, and the project-extension List) without requiring
 * @rdfjs/data-model at runtime.
 *
 * Each term carries an `equals(other)` method per the rdf/js Term contract
 * (https://rdf.js.org/data-model-spec/#term-interface).
 *
 * Project divergence:
 * - LiteralTermType.value is `unknown` (raw JS value, not serialised string).
 *   External RDF/JS consumers must coerce via `String(literal.value)`.
 * - ListTermType is a project extension (no rdf/js equivalent).
 * - DefaultGraph is a singleton (frozen shared instance).
 */

import type {
  BnodeTermType, DefaultGraphTermType, IriTermType, ListTermType, LiteralTermType, QuadObjectType, TermType
} from '../../types/Quad.js';

// ---------------------------------------------------------------------------
// Equality helpers
// ---------------------------------------------------------------------------

function iriEquals(self: IriTermType, other: null | TermType): boolean {
  if (other === null) {
    return false;
  }

  return other.termType === 'NamedNode' && other.value === self.value;
}

function bnodeEquals(self: BnodeTermType, other: null | TermType): boolean {
  if (other === null) {
    return false;
  }

  return other.termType === 'BlankNode' && other.value === self.value;
}

function literalEquals(self: LiteralTermType, other: null | TermType): boolean {
  if (other === null) {
    return false;
  }

  if (other.termType !== 'Literal') {
    return false;
  }

  return String(other.value) === String(self.value)
    && other.language === self.language
    && other.datatype.value === self.datatype.value;
}

function defaultGraphEquals(other: null | TermType): boolean {
  if (other === null) {
    return false;
  }

  return other.termType === 'DefaultGraph';
}

function listEquals(self: ListTermType, other: null | TermType): boolean {
  if (other === null) {
    return false;
  }

  if (other.termType !== 'List') {
    return false;
  }

  if (self.items.length !== other.items.length) {
    return false;
  }

  return self.items.every((item, i) => {
    return item.equals(other.items[i] ?? null);
  });
}

// ---------------------------------------------------------------------------
// DefaultGraph singleton
// ---------------------------------------------------------------------------

const DEFAULT_GRAPH_SINGLETON: DefaultGraphTermType = Object.freeze({
  'equals': defaultGraphEquals,
  'termType': 'DefaultGraph' as const,
  'value': '' as const
});

// ---------------------------------------------------------------------------
// Term factory
// ---------------------------------------------------------------------------

export const Terms = {
  blank(value: string): BnodeTermType {
    const term: BnodeTermType = {
      'equals'(other: null | TermType): boolean {
        return bnodeEquals(term, other);
      },
      'termType': 'BlankNode',
      value
    };

    return term;
  },

  defaultGraph(): DefaultGraphTermType {
    return DEFAULT_GRAPH_SINGLETON;
  },

  iri(value: string): IriTermType {
    const term: IriTermType = {
      'equals'(other: null | TermType): boolean {
        return iriEquals(term, other);
      },
      'termType': 'NamedNode',
      value
    };

    return term;
  },

  list(items: readonly QuadObjectType[]): ListTermType {
    const term: ListTermType = {
      'equals'(other: null | TermType): boolean {
        return listEquals(term, other);
      },
      'items': [...items],
      'termType': 'List'
    };

    return term;
  },

  literal(
    value: unknown,
    options?: { 'datatype'?: IriTermType;
      'language'?: string }
  ): LiteralTermType {
    const datatype = options?.datatype ?? Terms.iri('xsd:string');
    const language = options?.language ?? '';
    const term: LiteralTermType = {
      datatype,
      'equals'(other: null | TermType): boolean {
        return literalEquals(term, other);
      },
      language,
      'termType': 'Literal',
      value
    };

    return term;
  }
} as const;
