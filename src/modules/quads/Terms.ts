/**
 * Terms — RDF term factory.
 *
 * Produces rdf/js-spec-compliant term objects (NamedNode, BlankNode, Literal,
 * DefaultGraph) and quads (`@rdfjs/types#Quad`) without requiring
 * `@rdfjs/data-model` at runtime.
 *
 * The factory output IS the rdf/js spec type — no conversion needed at any
 * consumer boundary. `Terms.quad()` produces a `@rdfjs/types#Quad` complete
 * with `termType: 'Quad'`, `value: ''`, and the spec `equals(other)` method.
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
  BlankNode, DefaultGraph, Literal, NamedNode, Quad, Term
} from '@rdfjs/types';
import type {
  QuadObjectType, TermType
} from '../../types/Quad.js';

import { DECIMAL_RADIX } from '../../constants/FORMAT_VALIDATION.js';
import {
  XSD, XSD_COMPACT_PREFIX
} from '../../constants/IRI.js';
import { XSD_IRI_PREFIX } from '../../constants/XSD_IRI_PREFIX.js';
import {
  DECIMAL_XSD_TYPE_NAMES, INTEGER_XSD_TYPE_NAMES
} from '../../constants/XSD_TYPE_NAME_SETS.js';

/**
 * Term-construction and literal-decoding support for the {@link Terms} factory.
 *
 * The `equals*` methods accept `null | undefined` to match the rdf/js spec
 * (https://rdf.js.org/data-model-spec/#term-interface) and handle both.
 *
 * Each factory function (Terms.blank, Terms.iri, ...) constructs a fresh term
 * object per call, but the `equals` method itself must be a single, pre-built
 * function reference — not an inline closure rebuilt on every call — so V8 can
 * treat every term of a given kind as sharing one hidden class. `this` is bound
 * to the owning term automatically via the `term.equals(other)` call form.
 */
class TermSupport {
  static bnodeEquals(this: BlankNode, other: null | TermType | undefined): boolean {
    if (other === null || other === undefined) {
      return false;
    }

    return other.termType === 'BlankNode' && other.value === this.value;
  }

  static defaultGraphEquals(other: null | TermType | undefined): boolean {
    if (other === null || other === undefined) {
      return false;
    }

    return other.termType === 'DefaultGraph';
  }

  /**
   * Extract a JSON-LD value-object datatype-IRI hint (`{'@type': 'xsd:...'}`)
   * when one is embedded in the raw literal input. Used by `Terms.literal`
   * to honour the structured form that OwlProjection / SHACL projections emit.
   *
   * Returns the bare IRI string; the caller wraps it via `Terms.iri`.
   */
  static extractValueObjectDatatypeIri(value: unknown): string | undefined {
    if (typeof value !== 'object' || value === null) {
      return undefined;
    }
    const objectValue = value as Record<string, unknown>;

    // Only treat as a JSON-LD value-object when `@value` is present. A node
    // with `@type` but no `@value` (e.g. `{'@type': 'owl:Class', ...}`) is a
    // node identifier, not a typed literal.
    if (!('@value' in objectValue) || typeof objectValue['@type'] !== 'string') {
      return undefined;
    }

    return objectValue['@type'];
  }

  static inferDatatypeIri(value: unknown): string {
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

  static iriEquals(this: NamedNode, other: null | TermType | undefined): boolean {
    if (other === null || other === undefined) {
      return false;
    }

    return other.termType === 'NamedNode' && other.value === this.value;
  }

  static literalEquals(this: Literal, other: null | TermType | undefined): boolean {
    if (other === null || other === undefined) {
      return false;
    }

    if (other.termType !== 'Literal') {
      return false;
    }

    return other.value === this.value
      && other.language === this.language
      && other.datatype.value === this.datatype.value;
  }

  static localXsdName(iri: string): string {
    const normalised = TermSupport.normaliseDatatypeIri(iri);

    return normalised.startsWith(XSD_COMPACT_PREFIX) ? normalised.slice(XSD_COMPACT_PREFIX.length) : normalised;
  }

  static normaliseDatatypeIri(iri: string): string {
    if (iri.startsWith(XSD_IRI_PREFIX)) {
      return `xsd:${iri.slice(XSD_IRI_PREFIX.length)}`;
    }

    return iri;
  }

  static quadEquals(this: Quad, other: null | Term | undefined): boolean {
    if (other === null || other === undefined) {
      return false;
    }
    if (other.termType !== 'Quad') {
      return false;
    }

    return this.subject.equals(other.subject)
      && this.predicate.equals(other.predicate)
      && this.object.equals(other.object)
      && this.graph.equals(other.graph);
  }

  static stringifyValue(value: unknown): string {
    if (value instanceof Date) {
      return value.toISOString();
    }
    if (typeof value === 'object' && value !== null && '@value' in (value as Record<string, unknown>)) {
      return String((value as Record<string, unknown>)['@value']);
    }

    return String(value);
  }
}

// ---------------------------------------------------------------------------
// DefaultGraph singleton
// ---------------------------------------------------------------------------

const DEFAULT_GRAPH_SINGLETON: DefaultGraph = Object.freeze({
  'equals': TermSupport.defaultGraphEquals,
  'termType': 'DefaultGraph' as const,
  'value': '' as const
});

// ---------------------------------------------------------------------------
// Term factory
// ---------------------------------------------------------------------------

export const Terms = {
  blank(value: string): BlankNode {
    const term: BlankNode = {
      'equals': TermSupport.bnodeEquals,
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
  decodeLiteral(literal: Literal): unknown {
    const raw = literal.value;
    const dt = TermSupport.localXsdName(literal.datatype.value);

    if (dt === 'boolean') {
      return raw === 'true' || raw === '1';
    }
    if (INTEGER_XSD_TYPE_NAMES.has(dt)) {
      const parsedInteger = Number.parseInt(raw, DECIMAL_RADIX);

      return Number.isFinite(parsedInteger) ? parsedInteger : raw;
    }
    if (DECIMAL_XSD_TYPE_NAMES.has(dt)) {
      const parsedFloat = Number.parseFloat(raw);

      return Number.isFinite(parsedFloat) ? parsedFloat : raw;
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

  defaultGraph(): DefaultGraph {
    const result = DEFAULT_GRAPH_SINGLETON;

    return result;
  },

  iri(value: string): NamedNode {
    const term: NamedNode = {
      'equals': TermSupport.iriEquals,
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
    options?: { 'datatype'?: NamedNode;
      'language'?: string }
  ): Literal {
    const valueObjectDatatypeIri = TermSupport.extractValueObjectDatatypeIri(value);
    const datatype = options?.datatype
      ?? Terms.iri(valueObjectDatatypeIri ?? TermSupport.inferDatatypeIri(value));
    const language = options?.language ?? '';
    const stringValue = TermSupport.stringifyValue(value);
    const term: Literal = {
      datatype,
      'equals': TermSupport.literalEquals,
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
    subject: BlankNode | NamedNode | Quad,
    predicate: NamedNode,
    object: QuadObjectType,
    graph?: BlankNode | DefaultGraph | NamedNode
  ): Quad {
    const quad: Quad = {
      'equals': TermSupport.quadEquals,
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
    subject: BlankNode | NamedNode,
    predicate: NamedNode,
    object: QuadObjectType
  ): Quad {
    const term: Quad = {
      'equals': TermSupport.quadEquals,
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

// INTEGER_XSD_TYPE_NAMES and DECIMAL_XSD_TYPE_NAMES imported from XSD_TYPE_NAME_SETS
