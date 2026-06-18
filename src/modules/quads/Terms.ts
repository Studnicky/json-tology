/**
 * Terms — RDF term factory.
 *
 * Produces rdf/js-spec-compliant term objects (NamedNode, BlankNode, Literal,
 * DefaultGraph) and quads (`@rdfjs/types#Quad`) without requiring
 * `@rdfjs/data-model` at runtime.
 *
 * The factory output IS the rdf/js spec type — no conversion needed at any
 * consumer boundary. `IriTermType`, `BnodeTermType`, `LiteralTermType`, and
 * `DefaultGraphTermType` are direct re-exports of `@rdfjs/types#NamedNode`,
 * `BlankNode`, `Literal`, and `DefaultGraph`. `Terms.quad()` produces a
 * `@rdfjs/types#Quad` complete with `termType: 'Quad'`, `value: ''`, and the
 * spec `equals(other)` method.
 *
 * RDF lists are not a term type — they are emitted as `rdf:first` /
 * `rdf:rest` / `rdf:nil` triple sequences by `src/modules/rdf/Lists.ts` at
 * the point of construction. See `Lists.build(items)`.
 *
 * To use a different rdf/js DataFactory implementation (e.g. `@rdfjs/data-model`,
 * `n3.DataFactory`), construct quads directly with that factory and pass them
 * into `JsonTology` methods — they are accepted as-is because the project's
 * accepted shape is the canonical rdf/js type.
 *
 * Literal contract:
 * - `Terms.literal(value, options?)` accepts `unknown` and stringifies via
 *   `String(rawValue)` internally so the produced Literal carries the
 *   rdf/js-spec `value: string`.
 * - The JS type is preserved through `datatype.value` (xsd:integer for numbers,
 *   xsd:boolean for booleans, xsd:dateTime for Date, xsd:string otherwise).
 *   If `datatype` is provided in options, it overrides type inference.
 * - `Terms.decodeLiteral(literal)` reverses the encoding — reads `datatype.value`
 *   and parses the string back into a typed JS value. Used by `Lift` and
 *   `fromQuads` so consumers never have to hand-decode.
 *
 * DefaultGraph is a singleton (frozen shared instance).
 */

import type {
  Quad, Term
} from '@rdfjs/types';
import type {
  BnodeTermType, DefaultGraphTermType, IriTermType, LiteralTermType, QuadObjectType, TermType
} from '../../types/Quad.js';

import { DECIMAL_RADIX } from '../../constants/FORMAT_VALIDATION.js';
import {
  XSD, XSD_COMPACT_PREFIX
} from '../../constants/IRI.js';
import { XSD_IRI_PREFIX } from '../../constants/STANDARD_PREFIXES.js';
import {
  DECIMAL_XSD_TYPE_NAMES, INTEGER_XSD_TYPE_NAMES
} from '../../constants/XSD_MAPS.js';

// ---------------------------------------------------------------------------
// Equality helpers
//
// The `equals` signature accepts `null | undefined` to match the rdf/js spec
// (https://rdf.js.org/data-model-spec/#term-interface) and handles both.
// ---------------------------------------------------------------------------

function iriEquals(self: IriTermType, other: null | TermType | undefined): boolean {
  if (other === null || other === undefined) {
    return false;
  }

  return other.termType === 'NamedNode' && other.value === self.value;
}

function bnodeEquals(self: BnodeTermType, other: null | TermType | undefined): boolean {
  if (other === null || other === undefined) {
    return false;
  }

  return other.termType === 'BlankNode' && other.value === self.value;
}

function literalEquals(self: LiteralTermType, other: null | TermType | undefined): boolean {
  if (other === null || other === undefined) {
    return false;
  }

  if (other.termType !== 'Literal') {
    return false;
  }

  return other.value === self.value
    && other.language === self.language
    && other.datatype.value === self.datatype.value;
}

function defaultGraphEquals(other: null | TermType | undefined): boolean {
  if (other === null || other === undefined) {
    return false;
  }

  return other.termType === 'DefaultGraph';
}

function quadEquals(self: Quad, other: null | Term | undefined): boolean {
  if (other === null || other === undefined) {
    return false;
  }
  if (other.termType !== 'Quad') {
    return false;
  }

  return self.subject.equals(other.subject)
    && self.predicate.equals(other.predicate)
    && self.object.equals(other.object)
    && self.graph.equals(other.graph);
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
// Datatype inference
//
// When no explicit datatype is provided, infer the canonical XSD datatype
// from the JS type of the value. Strings default to xsd:string.
// ---------------------------------------------------------------------------

function inferDatatypeIri(value: unknown): string {
  if (typeof value === 'number') {
    return Number.isInteger(value) ? XSD.integer : XSD.double;
  }
  if (typeof value === 'boolean') {
    return XSD.boolean;
  }
  if (value instanceof Date) {
    return XSD.dateTime;
  }

  return XSD.string;
}

function stringifyValue(value: unknown): string {
  if (value instanceof Date) {
    return value.toISOString();
  }
  if (typeof value === 'object' && value !== null && '@value' in (value as Record<string, unknown>)) {
    return String((value as Record<string, unknown>)['@value']);
  }

  return String(value);
}

/**
 * Extract a JSON-LD value-object datatype-IRI hint (`{'@type': 'xsd:...'}`)
 * when one is embedded in the raw literal input. Used by `Terms.literal`
 * to honour the structured form that OwlProjection / SHACL projections emit.
 *
 * Returns the bare IRI string; the caller wraps it via `Terms.iri`.
 */
function extractValueObjectDatatypeIri(value: unknown): string | undefined {
  if (typeof value !== 'object' || value === null) {
    return undefined;
  }
  const obj = value as Record<string, unknown>;

  // Only treat as a JSON-LD value-object when `@value` is present. A node
  // with `@type` but no `@value` (e.g. `{'@type': 'owl:Class', ...}`) is a
  // node identifier, not a typed literal.
  if (!('@value' in obj) || typeof obj['@type'] !== 'string') {
    return undefined;
  }

  return obj['@type'];
}

// ---------------------------------------------------------------------------
// Term factory
// ---------------------------------------------------------------------------

export const Terms = {
  blank(value: string): BnodeTermType {
    const term: BnodeTermType = {
      'equals'(other: null | TermType | undefined): boolean {
        return bnodeEquals(term, other);
      },
      'termType': 'BlankNode',
      value
    };

    return term;
  },

  /**
   * Decode an rdf/js Literal back to its typed JS value.
   *
   * Reads `literal.datatype.value` and parses `literal.value` accordingly.
   * Unknown datatypes pass the raw string through unchanged. Inverse of
   * `Terms.literal`. Used by `Lift` and `fromQuads` so consumers never have to
   * hand-decode XSD-tagged literals.
   */
  decodeLiteral(literal: LiteralTermType): unknown {
    const raw = literal.value;
    const dt = localXsdName(literal.datatype.value);

    if (dt === 'boolean') {
      return raw === 'true' || raw === '1';
    }
    if (INTEGER_XSD_TYPE_NAMES.has(dt)) {
      const num = Number.parseInt(raw, DECIMAL_RADIX);

      return Number.isFinite(num) ? num : raw;
    }
    if (DECIMAL_XSD_TYPE_NAMES.has(dt)) {
      const num = Number.parseFloat(raw);

      return Number.isFinite(num) ? num : raw;
    }
    // Return the original lexical string for temporal types.
    // Schemas represent dates/times as `type: 'string'` with a `format`
    // validator; returning a Date object would fail the format check inside
    // fromQuads→instantiate. Preserving the raw lexical value guarantees an
    // exact round-trip (e.g. '1979-09-01' stays '1979-09-01', not
    // '1979-09-01T00:00:00.000Z').
    if (dt === 'dateTime' || dt === 'date' || dt === 'time') {
      return raw;
    }

    return raw;
  },

  defaultGraph(): DefaultGraphTermType {
    return DEFAULT_GRAPH_SINGLETON;
  },

  iri(value: string): IriTermType {
    const term: IriTermType = {
      'equals'(other: null | TermType | undefined): boolean {
        return iriEquals(term, other);
      },
      'termType': 'NamedNode',
      value
    };

    return term;
  },

  /**
   * Construct an rdf/js-spec Literal.
   *
   * - `value` may be any JS value (number, boolean, Date, string, etc.).
   *   It is stringified via `String(rawValue)` (Dates use `toISOString()`)
   *   so the produced Literal carries the spec-required `value: string`.
   * - If `options.datatype` is provided, it is used directly. Otherwise the
   *   datatype is inferred from the JS type: number → xsd:integer or xsd:double,
   *   boolean → xsd:boolean, Date → xsd:dateTime, anything else → xsd:string.
   * - `options.language` sets a BCP47 language tag (use only with xsd:string /
   *   rdf:langString datatypes per the rdf/js spec).
   */
  literal(
    value: unknown,
    options?: { 'datatype'?: IriTermType;
      'language'?: string }
  ): LiteralTermType {
    const valueObjectDatatypeIri = extractValueObjectDatatypeIri(value);
    const datatype = options?.datatype
      ?? Terms.iri(valueObjectDatatypeIri ?? inferDatatypeIri(value));
    const language = options?.language ?? '';
    const stringValue = stringifyValue(value);
    const term: LiteralTermType = {
      datatype,
      'equals'(other: null | TermType | undefined): boolean {
        return literalEquals(term, other);
      },
      language,
      'termType': 'Literal',
      'value': stringValue
    };

    return term;
  },

  /**
   * Construct an rdf/js-spec `@rdfjs/types#Quad`.
   *
   * The returned quad carries the spec-required `termType: 'Quad'`,
   * `value: ''`, and the `equals(other)` method. `graph` defaults to the
   * default-graph singleton when not supplied.
   *
   * The subject may itself be a `Quad` (an RDF 1.2 triple term / quoted
   * triple), per the rdf/js data model `Quad_Subject` union.
   */
  quad(
    subject: BnodeTermType | IriTermType | Quad,
    predicate: IriTermType,
    object: QuadObjectType,
    graph?: BnodeTermType | DefaultGraphTermType | IriTermType
  ): Quad {
    const quad: Quad = {
      'equals'(other: null | TermType | undefined): boolean {
        return quadEquals(quad, other);
      },
      'graph': graph ?? DEFAULT_GRAPH_SINGLETON,
      object,
      predicate,
      subject,
      'termType': 'Quad',
      'value': ''
    };

    return quad;
  },

  /**
   * Construct an RDF 1.2 triple term (quoted triple) — a `Quad`-typed term
   * usable as the subject of an annotation quad.
   *
   * The inner triple carries the spec-required `termType: 'Quad'`, `value: ''`,
   * and the `equals(other)` method. A triple term is a value with no graph
   * membership: its `graph` is always the default-graph singleton. The graph
   * membership is carried by the OUTER annotation quad that uses this term as
   * its subject.
   */
  tripleTerm(
    subject: BnodeTermType | IriTermType,
    predicate: IriTermType,
    object: QuadObjectType
  ): Quad {
    const term: Quad = {
      'equals'(other: null | TermType | undefined): boolean {
        return quadEquals(term, other);
      },
      'graph': DEFAULT_GRAPH_SINGLETON,
      object,
      predicate,
      subject,
      'termType': 'Quad',
      'value': ''
    };

    return term;
  }
} as const;

// ---------------------------------------------------------------------------
// Literal decoding helpers — used by `Terms.decodeLiteral`.
//
// Reads `literal.datatype.value` and parses the string `literal.value` back
// into the canonical JS type (number, boolean, Date, string). Used by `Lift`
// and `fromQuads` so consumers never have to hand-decode XSD-tagged literals.
// ---------------------------------------------------------------------------

function normaliseDatatypeIri(iri: string): string {
  if (iri.startsWith(XSD_IRI_PREFIX)) {
    return `xsd:${iri.slice(XSD_IRI_PREFIX.length)}`;
  }

  return iri;
}

function localXsdName(iri: string): string {
  const normalised = normaliseDatatypeIri(iri);

  return normalised.startsWith(XSD_COMPACT_PREFIX) ? normalised.slice(XSD_COMPACT_PREFIX.length) : normalised;
}

// INTEGER_XSD_TYPE_NAMES and DECIMAL_XSD_TYPE_NAMES imported from XSD_MAPS
