/**
 * Unit tests for the Datatypes dispatcher (importDatatypes).
 *
 * Covers:
 *   - Empty quad input → empty schemaDeltas
 *   - rdfs:Datatype declaration only → empty delta (no type/facets)
 *   - owl:onDatatype → type mapped from XSD base type
 *   - owl:withRestrictions with each XSD facet:
 *       xsd:minInclusive  → minimum
 *       xsd:maxInclusive  → maximum
 *       xsd:minExclusive  → exclusiveMinimum
 *       xsd:maxExclusive  → exclusiveMaximum
 *       xsd:minLength     → minLength
 *       xsd:maxLength     → maxLength
 *       xsd:length        → minLength + maxLength (same value)
 *       xsd:pattern       → pattern
 *       xsd:fractionDigits → multipleOf (10^-N)
 *       xsd:totalDigits   → reportUnsupported (no schema keyword)
 *       xsd:whiteSpace    → ignored
 *   - owl:equivalentClass + owl:oneOf of string literals → enum
 *   - owl:equivalentClass + owl:oneOf of integer literals → enum + type inferred
 *   - Combined: onDatatype + withRestrictions (constrained numeric)
 *   - Non-rdfs:Datatype subjects are not processed
 *   - Bookstore round-trip: all bookstore primitive schemas with facets
 */

import assert from 'node:assert/strict';
import {
  describe, it
} from 'node:test';
import { importDatatypes } from '../../src/modules/ontology/importDispatch/Datatypes.js';
import { Curie } from '../../src/modules/rdf/Curie.js';
import { STANDARD_PREFIXES } from '../../src/constants/STANDARD_PREFIXES.js';
import { Terms } from '../../src/modules/rdf/Terms.js';
import { listQuad } from '../helpers/listQuad.js';
import type { JsonSchemaDocumentObjectType } from '../../src/types/Schema.js';
import type { QuadInterface } from '../../src/interfaces/Quad.js';
import type { QuadObjectType } from '../../src/types/Quad.js';
import type { OwlImportContext } from '../../src/interfaces/OwlImport.js';
import { SchemaGraph } from '../../src/modules/graph/SchemaGraph.js';

// ---------------------------------------------------------------------------
// IRI constants (full form — matches what JsonLdToQuads expands to)
// ---------------------------------------------------------------------------

const RDF_TYPE = 'http://www.w3.org/1999/02/22-rdf-syntax-ns#type';
const RDFS_DATATYPE = 'http://www.w3.org/2000/01/rdf-schema#Datatype';
const OWL_ON_DATATYPE = 'http://www.w3.org/2002/07/owl#onDatatype';
const OWL_WITH_RESTRICTIONS = 'http://www.w3.org/2002/07/owl#withRestrictions';
const OWL_EQUIVALENT_CLASS = 'http://www.w3.org/2002/07/owl#equivalentClass';
const OWL_ONE_OF = 'http://www.w3.org/2002/07/owl#oneOf';
const XSD_STRING = 'http://www.w3.org/2001/XMLSchema#string';
const XSD_INTEGER = 'http://www.w3.org/2001/XMLSchema#integer';
const XSD_DECIMAL = 'http://www.w3.org/2001/XMLSchema#decimal';
const XSD_NON_NEG_INT = 'http://www.w3.org/2001/XMLSchema#nonNegativeInteger';
const XSD_MIN_INCLUSIVE = 'http://www.w3.org/2001/XMLSchema#minInclusive';
const XSD_MAX_INCLUSIVE = 'http://www.w3.org/2001/XMLSchema#maxInclusive';
const XSD_MIN_EXCLUSIVE = 'http://www.w3.org/2001/XMLSchema#minExclusive';
const XSD_MAX_EXCLUSIVE = 'http://www.w3.org/2001/XMLSchema#maxExclusive';
const XSD_MIN_LENGTH = 'http://www.w3.org/2001/XMLSchema#minLength';
const XSD_MAX_LENGTH = 'http://www.w3.org/2001/XMLSchema#maxLength';
const XSD_LENGTH = 'http://www.w3.org/2001/XMLSchema#length';
const XSD_PATTERN = 'http://www.w3.org/2001/XMLSchema#pattern';
const XSD_TOTAL_DIGITS = 'http://www.w3.org/2001/XMLSchema#totalDigits';
const XSD_FRACTION_DIGITS = 'http://www.w3.org/2001/XMLSchema#fractionDigits';
const XSD_WHITE_SPACE = 'http://www.w3.org/2001/XMLSchema#whiteSpace';
const XSD_ENUMERATION = 'http://www.w3.org/2001/XMLSchema#enumeration';

// ---------------------------------------------------------------------------
// Stub context
// ---------------------------------------------------------------------------

const curie = new Curie(STANDARD_PREFIXES);

function makeCtx(quads: QuadInterface[] = []): OwlImportContext & {
  'unsupportedLog': Array<{ 'axiomIri': string;
    'subjectIri': null | string }>
} {
  const unsupportedLog: Array<{ 'axiomIri': string;
    'subjectIri': null | string }> = [];

  return {
    'allClassIris': new Set(),
    'allPropertyIris': new Set(),
    'baseIRI': 'https://example.com/',
    curie,
    'graph': SchemaGraph.fromQuads(quads, {
      'baseIRI': 'https://example.com/',
      'prefixes': STANDARD_PREFIXES
    }),
    'isDatatype': () => {
      return true;
    },
    'prefixes': STANDARD_PREFIXES,
    'reportUnsupported': (axiomIri, subjectIri) => {
      unsupportedLog.push({
        axiomIri,
        subjectIri
      });
    },
    unsupportedLog
  };
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Assert a delta is defined and return it narrowed to a non-undefined type.
 */
function requireDelta(
  schemaDeltas: ReadonlyMap<string, Partial<JsonSchemaDocumentObjectType>>,
  subjectIri: string
): Partial<JsonSchemaDocumentObjectType> {
  const delta = schemaDeltas.get(subjectIri);

  assert.ok(delta !== undefined, `delta must be present for ${subjectIri}`);

  return delta;
}

// ---------------------------------------------------------------------------
// Quad builders
// ---------------------------------------------------------------------------

function iri(value: string): QuadObjectType {
  return Terms.iri(value);
}

function lit(value: unknown, datatype: string): QuadObjectType {
  return Terms.literal(value, { 'datatype': Terms.iri(datatype) });
}

function numLit(value: number): QuadObjectType {
  return lit(value, XSD_DECIMAL);
}

function intLit(value: number): QuadObjectType {
  return lit(value, XSD_NON_NEG_INT);
}

function strLit(value: string): QuadObjectType {
  return lit(value, XSD_STRING);
}

function makeQuad(subject: string, predicate: string, object: QuadObjectType): QuadInterface {
  return {
    'graph': Terms.defaultGraph(),
    object,
    'predicate': Terms.iri(predicate),
    'subject': Terms.iri(subject)
  };
}

function blankQuad(subject: string, predicate: string, object: QuadObjectType): QuadInterface {
  return {
    'graph': Terms.defaultGraph(),
    object,
    'predicate': Terms.iri(predicate),
    'subject': Terms.blank(subject)
  };
}

/** Declare a subject as rdfs:Datatype. */
function declareDatatype(subjectIri: string): QuadInterface {
  return makeQuad(subjectIri, RDF_TYPE, iri(RDFS_DATATYPE));
}

/** Set owl:onDatatype for the subject. */
function setOnDatatype(subjectIri: string, xsdTypeIri: string): QuadInterface {
  return makeQuad(subjectIri, OWL_ON_DATATYPE, iri(xsdTypeIri));
}

/** Build a withRestrictions quad + list triples carrying facet bnodes. */
function makeWithRestrictions(subjectIri: string, facetBnodes: string[]): QuadInterface[] {
  const listItems: QuadObjectType[] = facetBnodes.map((bId) => {
    return Terms.blank(bId);
  });

  return listQuad(
    Terms.iri(subjectIri),
    Terms.iri(OWL_WITH_RESTRICTIONS),
    listItems
  );
}

/** Facet bnode quad: _:bnode xsd:facet numericValue. */
function facetNumeric(bnodeId: string, facetPredicate: string, value: number): QuadInterface {
  return blankQuad(bnodeId, facetPredicate, numLit(value));
}

/** Facet bnode quad: _:bnode xsd:facet "stringValue". */
function facetString(bnodeId: string, facetPredicate: string, value: string): QuadInterface {
  return blankQuad(bnodeId, facetPredicate, strLit(value));
}

/**
 * owl:equivalentClass + owl:oneOf enum quads.
 *
 * Produces:
 *   subjectIri owl:equivalentClass _:bnodeEquiv .
 *   _:bnodeEquiv owl:oneOf ( literalItems... ) .
 *
 * The bnodeEquiv carries the owl:oneOf list directly —
 * there is no intermediate blank node.
 */
function makeEnumDatatypeQuads(
  subjectIri: string,
  values: unknown[],
  bnodeEquiv: string
): QuadInterface[] {
  const literalItems: QuadObjectType[] = values.map((val) => {
    if (typeof val === 'number') {
      return numLit(val);
    }

    return strLit(String(val));
  });

  return [
    makeQuad(subjectIri, OWL_EQUIVALENT_CLASS, Terms.blank(bnodeEquiv)),
    ...listQuad(Terms.blank(bnodeEquiv), Terms.iri(OWL_ONE_OF), literalItems)
  ];
}

/** Mutable bnode counter (module-scoped; unique across tests). */
let bnodeCounter = 0;

function nextBnode(): string {
  return `dtb${bnodeCounter++}`;
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

void describe('importDatatypes', { 'concurrency': true }, () => {
  // ── Empty input ──────────────────────────────────────────────────────────

  void it('returns empty fragment for empty quad array', () => {
    const fragment = importDatatypes([], makeCtx());

    assert.strictEqual(fragment.schemaDeltas.size, 0);
    assert.deepEqual(fragment.characteristics, []);
    assert.deepEqual(fragment.invariants, []);
    assert.deepEqual(fragment.sameAs, []);
    assert.deepEqual(fragment.individuals, []);
  });

  void it('returns empty fragment when no rdfs:Datatype declarations present', () => {
    // owl:Class — not a datatype
    const quads: QuadInterface[] = [makeQuad('https://ex.com/Person', RDF_TYPE, iri('http://www.w3.org/2002/07/owl#Class'))];
    const fragment = importDatatypes(quads, makeCtx(quads));

    assert.strictEqual(fragment.schemaDeltas.size, 0);
  });

  // ── rdfs:Datatype declaration only ──────────────────────────────────────

  void it('processes rdfs:Datatype declaration → empty delta (no facets)', () => {
    const dt = 'https://ex.com/MyDT';
    const quads: QuadInterface[] = [declareDatatype(dt)];
    const fragment = importDatatypes(quads, makeCtx(quads));

    assert.strictEqual(fragment.schemaDeltas.size, 1);
    assert.ok(fragment.schemaDeltas.has(dt), 'delta must be keyed by datatype IRI');
    const delta = requireDelta(fragment.schemaDeltas, dt);

    assert.deepEqual(delta, {}, 'no facets → empty delta');
  });

  // ── owl:onDatatype → type ────────────────────────────────────────────────

  void it('xsd:string base → type: string', () => {
    const dt = 'https://ex.com/MyString';
    const quads: QuadInterface[] = [
      declareDatatype(dt),
      setOnDatatype(dt, XSD_STRING)
    ];
    const delta = requireDelta(importDatatypes(quads, makeCtx(quads)).schemaDeltas, dt);

    assert.strictEqual(delta.type, 'string');
  });

  void it('xsd:integer base → type: integer', () => {
    const dt = 'https://ex.com/MyInt';
    const quads: QuadInterface[] = [
      declareDatatype(dt),
      setOnDatatype(dt, XSD_INTEGER)
    ];
    const delta = requireDelta(importDatatypes(quads, makeCtx(quads)).schemaDeltas, dt);

    assert.strictEqual(delta.type, 'integer');
  });

  void it('xsd:decimal base → type: number', () => {
    const dt = 'https://ex.com/MyDec';
    const quads: QuadInterface[] = [
      declareDatatype(dt),
      setOnDatatype(dt, XSD_DECIMAL)
    ];
    const delta = requireDelta(importDatatypes(quads, makeCtx(quads)).schemaDeltas, dt);

    assert.strictEqual(delta.type, 'number');
  });

  // ── XSD facet: xsd:minInclusive → minimum ───────────────────────────────

  void it('xsd:minInclusive → minimum', () => {
    const dt = 'https://ex.com/BoundedNum';
    const bnode = nextBnode();
    const quads: QuadInterface[] = [
      declareDatatype(dt),
      setOnDatatype(dt, XSD_DECIMAL),
      ...makeWithRestrictions(dt, [bnode]),
      facetNumeric(bnode, XSD_MIN_INCLUSIVE, 0)
    ];
    const delta = requireDelta(importDatatypes(quads, makeCtx(quads)).schemaDeltas, dt);

    assert.strictEqual(delta.minimum, 0);
    assert.strictEqual(delta.type, 'number');
  });

  // ── XSD facet: xsd:maxInclusive → maximum ───────────────────────────────

  void it('xsd:maxInclusive → maximum', () => {
    const dt = 'https://ex.com/BoundedNum2';
    const bnode = nextBnode();
    const quads: QuadInterface[] = [
      declareDatatype(dt),
      setOnDatatype(dt, XSD_DECIMAL),
      ...makeWithRestrictions(dt, [bnode]),
      facetNumeric(bnode, XSD_MAX_INCLUSIVE, 100)
    ];
    const delta = requireDelta(importDatatypes(quads, makeCtx(quads)).schemaDeltas, dt);

    assert.strictEqual(delta.maximum, 100);
  });

  // ── XSD facet: xsd:minExclusive → exclusiveMinimum ──────────────────────

  void it('xsd:minExclusive → exclusiveMinimum', () => {
    const dt = 'https://ex.com/ExclusiveMin';
    const bnode = nextBnode();
    const quads: QuadInterface[] = [
      declareDatatype(dt),
      setOnDatatype(dt, XSD_DECIMAL),
      ...makeWithRestrictions(dt, [bnode]),
      facetNumeric(bnode, XSD_MIN_EXCLUSIVE, 0)
    ];
    const delta = requireDelta(importDatatypes(quads, makeCtx(quads)).schemaDeltas, dt);

    assert.strictEqual(delta.exclusiveMinimum, 0);
  });

  // ── XSD facet: xsd:maxExclusive → exclusiveMaximum ──────────────────────

  void it('xsd:maxExclusive → exclusiveMaximum', () => {
    const dt = 'https://ex.com/ExclusiveMax';
    const bnode = nextBnode();
    const quads: QuadInterface[] = [
      declareDatatype(dt),
      setOnDatatype(dt, XSD_DECIMAL),
      ...makeWithRestrictions(dt, [bnode]),
      facetNumeric(bnode, XSD_MAX_EXCLUSIVE, 10)
    ];
    const delta = requireDelta(importDatatypes(quads, makeCtx(quads)).schemaDeltas, dt);

    assert.strictEqual(delta.exclusiveMaximum, 10);
  });

  // ── XSD facet: xsd:minLength → minLength ─────────────────────────────────

  void it('xsd:minLength → minLength', () => {
    const dt = 'https://ex.com/MinLenStr';
    const bnode = nextBnode();
    const quads: QuadInterface[] = [
      declareDatatype(dt),
      setOnDatatype(dt, XSD_STRING),
      ...makeWithRestrictions(dt, [bnode]),
      blankQuad(bnode, XSD_MIN_LENGTH, intLit(1))
    ];
    const delta = requireDelta(importDatatypes(quads, makeCtx(quads)).schemaDeltas, dt);

    assert.strictEqual(delta.minLength, 1);
    assert.strictEqual(delta.type, 'string');
  });

  // ── XSD facet: xsd:maxLength → maxLength ─────────────────────────────────

  void it('xsd:maxLength → maxLength', () => {
    const dt = 'https://ex.com/MaxLenStr';
    const bnode = nextBnode();
    const quads: QuadInterface[] = [
      declareDatatype(dt),
      setOnDatatype(dt, XSD_STRING),
      ...makeWithRestrictions(dt, [bnode]),
      blankQuad(bnode, XSD_MAX_LENGTH, intLit(100))
    ];
    const delta = requireDelta(importDatatypes(quads, makeCtx(quads)).schemaDeltas, dt);

    assert.strictEqual(delta.maxLength, 100);
  });

  // ── XSD facet: xsd:length → minLength + maxLength (exact) ───────────────

  void it('xsd:length → minLength and maxLength equal', () => {
    const dt = 'https://ex.com/ExactLen';
    const bnode = nextBnode();
    const quads: QuadInterface[] = [
      declareDatatype(dt),
      setOnDatatype(dt, XSD_STRING),
      ...makeWithRestrictions(dt, [bnode]),
      blankQuad(bnode, XSD_LENGTH, intLit(13))
    ];
    const delta = requireDelta(importDatatypes(quads, makeCtx(quads)).schemaDeltas, dt);

    assert.strictEqual(delta.minLength, 13, 'minLength must equal xsd:length value');
    assert.strictEqual(delta.maxLength, 13, 'maxLength must equal xsd:length value');
  });

  // ── XSD facet: xsd:pattern → pattern ────────────────────────────────────

  void it('xsd:pattern → pattern', () => {
    const dt = 'https://ex.com/PatternStr';
    const bnode = nextBnode();
    const quads: QuadInterface[] = [
      declareDatatype(dt),
      setOnDatatype(dt, XSD_STRING),
      ...makeWithRestrictions(dt, [bnode]),
      facetString(bnode, XSD_PATTERN, '^\\d{13}$')
    ];
    const delta = requireDelta(importDatatypes(quads, makeCtx(quads)).schemaDeltas, dt);

    assert.strictEqual(delta.pattern, '^\\d{13}$');
  });

  // ── XSD facet: xsd:fractionDigits → multipleOf ──────────────────────────

  void it('xsd:fractionDigits N=2 → multipleOf 0.01', () => {
    const dt = 'https://ex.com/Decimal2';
    const bnode = nextBnode();
    const quads: QuadInterface[] = [
      declareDatatype(dt),
      setOnDatatype(dt, XSD_DECIMAL),
      ...makeWithRestrictions(dt, [bnode]),
      blankQuad(bnode, XSD_FRACTION_DIGITS, intLit(2))
    ];
    const delta = requireDelta(importDatatypes(quads, makeCtx(quads)).schemaDeltas, dt);

    assert.ok(typeof delta.multipleOf === 'number', 'multipleOf must be present');
    assert.ok(
      Math.abs(delta.multipleOf - 0.01) < 1e-10,
      `multipleOf should be 0.01, got ${String(delta.multipleOf)}`
    );
  });

  void it('xsd:fractionDigits N=0 → multipleOf 1', () => {
    const dt = 'https://ex.com/Decimal0';
    const bnode = nextBnode();
    const quads: QuadInterface[] = [
      declareDatatype(dt),
      setOnDatatype(dt, XSD_DECIMAL),
      ...makeWithRestrictions(dt, [bnode]),
      blankQuad(bnode, XSD_FRACTION_DIGITS, intLit(0))
    ];
    const delta = requireDelta(importDatatypes(quads, makeCtx(quads)).schemaDeltas, dt);

    assert.ok(typeof delta.multipleOf === 'number', 'multipleOf must be present');
    assert.strictEqual(delta.multipleOf, 1);
  });

  // ── XSD facet: xsd:totalDigits → reportUnsupported ──────────────────────

  void it('xsd:totalDigits → reportUnsupported, no schema keyword emitted', () => {
    const dt = 'https://ex.com/TotalDigits';
    const bnode = nextBnode();
    const quads: QuadInterface[] = [
      declareDatatype(dt),
      setOnDatatype(dt, XSD_DECIMAL),
      ...makeWithRestrictions(dt, [bnode]),
      blankQuad(bnode, XSD_TOTAL_DIGITS, intLit(10))
    ];
    const ctx = makeCtx(quads);
    const delta = requireDelta(importDatatypes(quads, ctx).schemaDeltas, dt);

    // No JSON Schema keyword for totalDigits
    assert.strictEqual(delta.multipleOf, undefined);
    // reportUnsupported was called
    assert.ok(ctx.unsupportedLog.some((entry) => {
      return entry.axiomIri === 'xsd:totalDigits';
    }), 'xsd:totalDigits should be reported as unsupported');
  });

  // ── XSD facet: xsd:whiteSpace → ignored silently ─────────────────────────

  void it('xsd:whiteSpace → ignored, no schema keyword, no unsupported report', () => {
    const dt = 'https://ex.com/WhiteSpace';
    const bnode = nextBnode();
    const quads: QuadInterface[] = [
      declareDatatype(dt),
      setOnDatatype(dt, XSD_STRING),
      ...makeWithRestrictions(dt, [bnode]),
      facetString(bnode, XSD_WHITE_SPACE, 'collapse')
    ];
    const ctx = makeCtx(quads);
    const delta = requireDelta(importDatatypes(quads, ctx).schemaDeltas, dt);

    assert.strictEqual(delta.type, 'string');
    // No whiteSpace-related key in the delta
    assert.ok(!('whiteSpace' in delta), 'no whiteSpace key expected');
    // Not reported as unsupported
    assert.ok(!ctx.unsupportedLog.some((entry) => {
      return entry.axiomIri.includes('whiteSpace');
    }), 'xsd:whiteSpace should be silently ignored');
  });

  // ── owl:equivalentClass + owl:oneOf → enum ───────────────────────────────

  void it('owl:equivalentClass + owl:oneOf string literals → enum + type string', () => {
    const dt = 'https://ex.com/PrintStatus';
    const bEquiv = nextBnode();
    const quads: QuadInterface[] = [
      declareDatatype(dt),
      ...makeEnumDatatypeQuads(dt, [
        'inPrint',
        'outOfPrint',
        'limitedRun'
      ], bEquiv)
    ];
    const delta = requireDelta(importDatatypes(quads, makeCtx(quads)).schemaDeltas, dt);

    assert.deepEqual(delta.enum, [
      'inPrint',
      'outOfPrint',
      'limitedRun'
    ]);
    assert.strictEqual(delta.type, 'string');
  });

  void it('owl:equivalentClass + owl:oneOf integer literals → enum + type integer', () => {
    const dt = 'https://ex.com/StatusCode';
    const bEquiv = nextBnode();
    const quads: QuadInterface[] = [
      declareDatatype(dt),
      makeQuad(dt, OWL_EQUIVALENT_CLASS, Terms.blank(bEquiv)),
      ...listQuad(Terms.blank(bEquiv), Terms.iri(OWL_ONE_OF), [
        intLit(1),
        intLit(2),
        intLit(3)
      ])
    ];
    const delta = requireDelta(importDatatypes(quads, makeCtx(quads)).schemaDeltas, dt);

    assert.deepEqual(delta.enum, [
      1,
      2,
      3
    ]);
    assert.strictEqual(delta.type, 'integer');
  });

  // ── xsd:enumeration as unknown facet → reportUnsupported, no crash ──────

  void it('xsd:enumeration facets inside owl:withRestrictions → unsupported, no crash', () => {
    const dt = 'https://ex.com/ColorEnum';
    const bRestr1 = nextBnode();
    const bRestr2 = nextBnode();
    const bRestr3 = nextBnode();
    const quads: QuadInterface[] = [
      declareDatatype(dt),
      setOnDatatype(dt, XSD_STRING),
      ...makeWithRestrictions(dt, [
        bRestr1,
        bRestr2,
        bRestr3
      ]),
      facetString(bRestr1, XSD_ENUMERATION, 'red'),
      facetString(bRestr2, XSD_ENUMERATION, 'green'),
      facetString(bRestr3, XSD_ENUMERATION, 'blue')
    ];
    const ctx = makeCtx(quads);
    const delta = requireDelta(importDatatypes(quads, ctx).schemaDeltas, dt);

    // Type still emitted from owl:onDatatype
    assert.strictEqual(delta.type, 'string');
    // xsd:enumeration not in FACET_MAP → reported as unsupported per bnode
    assert.ok(
      ctx.unsupportedLog.length >= 3,
      `expected ≥3 unsupported reports for xsd:enumeration facets, got ${ctx.unsupportedLog.length}`
    );
  });

  // ── Combined: onDatatype + withRestrictions ──────────────────────────────

  void it('combined: type + min/max numeric bounds round-trip correctly', () => {
    const dt = 'https://ex.com/RatingScore';
    const bMin = nextBnode();
    const bMax = nextBnode();
    const quads: QuadInterface[] = [
      declareDatatype(dt),
      setOnDatatype(dt, XSD_INTEGER),
      ...makeWithRestrictions(dt, [
        bMin,
        bMax
      ]),
      facetNumeric(bMin, XSD_MIN_INCLUSIVE, 1),
      facetNumeric(bMax, XSD_MAX_INCLUSIVE, 5)
    ];
    const delta = requireDelta(importDatatypes(quads, makeCtx(quads)).schemaDeltas, dt);

    assert.strictEqual(delta.type, 'integer');
    assert.strictEqual(delta.minimum, 1);
    assert.strictEqual(delta.maximum, 5);
  });

  void it('combined: type + minLength + maxLength round-trip correctly', () => {
    const dt = 'https://ex.com/CityName';
    const bMin = nextBnode();
    const bMax = nextBnode();
    const quads: QuadInterface[] = [
      declareDatatype(dt),
      setOnDatatype(dt, XSD_STRING),
      ...makeWithRestrictions(dt, [
        bMin,
        bMax
      ]),
      blankQuad(bMin, XSD_MIN_LENGTH, intLit(1)),
      blankQuad(bMax, XSD_MAX_LENGTH, intLit(100))
    ];
    const delta = requireDelta(importDatatypes(quads, makeCtx(quads)).schemaDeltas, dt);

    assert.strictEqual(delta.type, 'string');
    assert.strictEqual(delta.minLength, 1);
    assert.strictEqual(delta.maxLength, 100);
  });

  // ── Multiple datatypes in one quad array ─────────────────────────────────

  void it('processes multiple distinct datatype subjects independently', () => {
    const dt1 = 'https://ex.com/DT1';
    const dt2 = 'https://ex.com/DT2';
    const bnode1 = nextBnode();
    const bnode2 = nextBnode();
    const quads: QuadInterface[] = [
      declareDatatype(dt1),
      setOnDatatype(dt1, XSD_STRING),
      ...makeWithRestrictions(dt1, [bnode1]),
      facetString(bnode1, XSD_PATTERN, '^[A-Z]{2}$'),

      declareDatatype(dt2),
      setOnDatatype(dt2, XSD_INTEGER),
      ...makeWithRestrictions(dt2, [bnode2]),
      facetNumeric(bnode2, XSD_MIN_INCLUSIVE, 0)
    ];
    const fragment = importDatatypes(quads, makeCtx(quads));

    assert.strictEqual(fragment.schemaDeltas.size, 2);

    const d1 = requireDelta(fragment.schemaDeltas, dt1);

    assert.strictEqual(d1.type, 'string');
    assert.strictEqual(d1.pattern, '^[A-Z]{2}$');

    const d2 = requireDelta(fragment.schemaDeltas, dt2);

    assert.strictEqual(d2.type, 'integer');
    assert.strictEqual(d2.minimum, 0);
  });

  // ── Prefixed IRI form (compact) ──────────────────────────────────────────

  void it('accepts rdfs:Datatype in compact prefixed form', () => {
    const dt = 'https://ex.com/CompactDT';
    const quads: QuadInterface[] = [{
      'graph': Terms.defaultGraph(),
      'object': Terms.iri('rdfs:Datatype'),
      'predicate': Terms.iri('rdf:type'),
      'subject': Terms.iri(dt)
    }];
    const fragment = importDatatypes(quads, makeCtx(quads));

    assert.strictEqual(fragment.schemaDeltas.size, 1);
    assert.ok(fragment.schemaDeltas.has(dt));
  });

  // ── Bookstore round-trip primitives ─────────────────────────────────────
  //
  // These tests verify that the dispatcher reconstructs each bookstore
  // primitive schema from OWL 2 rdfs:Datatype quads.

  void describe('bookstore primitives', { 'concurrency': true }, () => {
    void it('Amount: type number, minimum 0', () => {
      const dt = 'urn:bookstore:Amount';
      const bMin = nextBnode();
      const quads: QuadInterface[] = [
        declareDatatype(dt),
        setOnDatatype(dt, XSD_DECIMAL),
        ...makeWithRestrictions(dt, [bMin]),
        facetNumeric(bMin, XSD_MIN_INCLUSIVE, 0)
      ];
      const delta = requireDelta(importDatatypes(quads, makeCtx(quads)).schemaDeltas, dt);

      assert.strictEqual(delta.type, 'number');
      assert.strictEqual(delta.minimum, 0);
    });

    void it('CityName: type string, minLength 1, maxLength 100', () => {
      const dt = 'urn:bookstore:CityName';
      const bMin = nextBnode();
      const bMax = nextBnode();
      const quads: QuadInterface[] = [
        declareDatatype(dt),
        setOnDatatype(dt, XSD_STRING),
        ...makeWithRestrictions(dt, [
          bMin,
          bMax
        ]),
        blankQuad(bMin, XSD_MIN_LENGTH, intLit(1)),
        blankQuad(bMax, XSD_MAX_LENGTH, intLit(100))
      ];
      const delta = requireDelta(importDatatypes(quads, makeCtx(quads)).schemaDeltas, dt);

      assert.strictEqual(delta.type, 'string');
      assert.strictEqual(delta.minLength, 1);
      assert.strictEqual(delta.maxLength, 100);
    });

    void it('CountryCode: type string, pattern ^[A-Z]{2}$', () => {
      const dt = 'urn:bookstore:CountryCode';
      const bPat = nextBnode();
      const quads: QuadInterface[] = [
        declareDatatype(dt),
        setOnDatatype(dt, XSD_STRING),
        ...makeWithRestrictions(dt, [bPat]),
        facetString(bPat, XSD_PATTERN, '^[A-Z]{2}$')
      ];
      const delta = requireDelta(importDatatypes(quads, makeCtx(quads)).schemaDeltas, dt);

      assert.strictEqual(delta.type, 'string');
      assert.strictEqual(delta.pattern, '^[A-Z]{2}$');
    });

    void it('CurrencyCode: enum string values', () => {
      const dt = 'urn:bookstore:CurrencyCode';
      const bEquiv = nextBnode();
      const currencies = [
        'USD',
        'EUR',
        'GBP',
        'JPY',
        'CAD',
        'AUD'
      ];
      const quads: QuadInterface[] = [
        declareDatatype(dt),
        ...makeEnumDatatypeQuads(dt, currencies, bEquiv)
      ];
      const delta = requireDelta(importDatatypes(quads, makeCtx(quads)).schemaDeltas, dt);

      assert.deepEqual(delta.enum, currencies);
      assert.strictEqual(delta.type, 'string');
    });

    void it('Isbn: type string, pattern ^\\d{13}$', () => {
      const dt = 'urn:bookstore:Isbn';
      const bPat = nextBnode();
      const quads: QuadInterface[] = [
        declareDatatype(dt),
        setOnDatatype(dt, XSD_STRING),
        ...makeWithRestrictions(dt, [bPat]),
        facetString(bPat, XSD_PATTERN, '^\\d{13}$')
      ];
      const delta = requireDelta(importDatatypes(quads, makeCtx(quads)).schemaDeltas, dt);

      assert.strictEqual(delta.type, 'string');
      assert.strictEqual(delta.pattern, '^\\d{13}$');
    });

    void it('PageCount: type integer, minimum 0', () => {
      const dt = 'urn:bookstore:PageCount';
      const bMin = nextBnode();
      const quads: QuadInterface[] = [
        declareDatatype(dt),
        setOnDatatype(dt, XSD_INTEGER),
        ...makeWithRestrictions(dt, [bMin]),
        facetNumeric(bMin, XSD_MIN_INCLUSIVE, 0)
      ];
      const delta = requireDelta(importDatatypes(quads, makeCtx(quads)).schemaDeltas, dt);

      assert.strictEqual(delta.type, 'integer');
      assert.strictEqual(delta.minimum, 0);
    });

    void it('PageNumber: type integer, minimum 1', () => {
      const dt = 'urn:bookstore:PageNumber';
      const bMin = nextBnode();
      const quads: QuadInterface[] = [
        declareDatatype(dt),
        setOnDatatype(dt, XSD_INTEGER),
        ...makeWithRestrictions(dt, [bMin]),
        facetNumeric(bMin, XSD_MIN_INCLUSIVE, 1)
      ];
      const delta = requireDelta(importDatatypes(quads, makeCtx(quads)).schemaDeltas, dt);

      assert.strictEqual(delta.type, 'integer');
      assert.strictEqual(delta.minimum, 1);
    });

    void it('PageSize: type integer, minimum 1', () => {
      const dt = 'urn:bookstore:PageSize';
      const bMin = nextBnode();
      const quads: QuadInterface[] = [
        declareDatatype(dt),
        setOnDatatype(dt, XSD_INTEGER),
        ...makeWithRestrictions(dt, [bMin]),
        facetNumeric(bMin, XSD_MIN_INCLUSIVE, 1)
      ];
      const delta = requireDelta(importDatatypes(quads, makeCtx(quads)).schemaDeltas, dt);

      assert.strictEqual(delta.type, 'integer');
      assert.strictEqual(delta.minimum, 1);
    });

    void it('PersonName: type string, minLength 1, maxLength 200', () => {
      const dt = 'urn:bookstore:PersonName';
      const bMin = nextBnode();
      const bMax = nextBnode();
      const quads: QuadInterface[] = [
        declareDatatype(dt),
        setOnDatatype(dt, XSD_STRING),
        ...makeWithRestrictions(dt, [
          bMin,
          bMax
        ]),
        blankQuad(bMin, XSD_MIN_LENGTH, intLit(1)),
        blankQuad(bMax, XSD_MAX_LENGTH, intLit(200))
      ];
      const delta = requireDelta(importDatatypes(quads, makeCtx(quads)).schemaDeltas, dt);

      assert.strictEqual(delta.type, 'string');
      assert.strictEqual(delta.minLength, 1);
      assert.strictEqual(delta.maxLength, 200);
    });

    void it('PostalCode: type string, minLength 3, maxLength 12', () => {
      const dt = 'urn:bookstore:PostalCode';
      const bMin = nextBnode();
      const bMax = nextBnode();
      const quads: QuadInterface[] = [
        declareDatatype(dt),
        setOnDatatype(dt, XSD_STRING),
        ...makeWithRestrictions(dt, [
          bMin,
          bMax
        ]),
        blankQuad(bMin, XSD_MIN_LENGTH, intLit(3)),
        blankQuad(bMax, XSD_MAX_LENGTH, intLit(12))
      ];
      const delta = requireDelta(importDatatypes(quads, makeCtx(quads)).schemaDeltas, dt);

      assert.strictEqual(delta.type, 'string');
      assert.strictEqual(delta.minLength, 3);
      assert.strictEqual(delta.maxLength, 12);
    });

    void it('PrintPageCount: type integer, minimum 1', () => {
      const dt = 'urn:bookstore:PrintPageCount';
      const bMin = nextBnode();
      const quads: QuadInterface[] = [
        declareDatatype(dt),
        setOnDatatype(dt, XSD_INTEGER),
        ...makeWithRestrictions(dt, [bMin]),
        facetNumeric(bMin, XSD_MIN_INCLUSIVE, 1)
      ];
      const delta = requireDelta(importDatatypes(quads, makeCtx(quads)).schemaDeltas, dt);

      assert.strictEqual(delta.type, 'integer');
      assert.strictEqual(delta.minimum, 1);
    });

    void it('PrintStatus: enum string values', () => {
      const dt = 'urn:bookstore:PrintStatus';
      const bEquiv = nextBnode();
      const quads: QuadInterface[] = [
        declareDatatype(dt),
        ...makeEnumDatatypeQuads(dt, [
          'inPrint',
          'outOfPrint',
          'limitedRun'
        ], bEquiv)
      ];
      const delta = requireDelta(importDatatypes(quads, makeCtx(quads)).schemaDeltas, dt);

      assert.deepEqual(delta.enum, [
        'inPrint',
        'outOfPrint',
        'limitedRun'
      ]);
      assert.strictEqual(delta.type, 'string');
    });

    void it('Quantity: type integer, minimum 1', () => {
      const dt = 'urn:bookstore:Quantity';
      const bMin = nextBnode();
      const quads: QuadInterface[] = [
        declareDatatype(dt),
        setOnDatatype(dt, XSD_INTEGER),
        ...makeWithRestrictions(dt, [bMin]),
        facetNumeric(bMin, XSD_MIN_INCLUSIVE, 1)
      ];
      const delta = requireDelta(importDatatypes(quads, makeCtx(quads)).schemaDeltas, dt);

      assert.strictEqual(delta.type, 'integer');
      assert.strictEqual(delta.minimum, 1);
    });

    void it('RatingScore: type integer, minimum 1, maximum 5', () => {
      const dt = 'urn:bookstore:RatingScore';
      const bMin = nextBnode();
      const bMax = nextBnode();
      const quads: QuadInterface[] = [
        declareDatatype(dt),
        setOnDatatype(dt, XSD_INTEGER),
        ...makeWithRestrictions(dt, [
          bMin,
          bMax
        ]),
        facetNumeric(bMin, XSD_MIN_INCLUSIVE, 1),
        facetNumeric(bMax, XSD_MAX_INCLUSIVE, 5)
      ];
      const delta = requireDelta(importDatatypes(quads, makeCtx(quads)).schemaDeltas, dt);

      assert.strictEqual(delta.type, 'integer');
      assert.strictEqual(delta.minimum, 1);
      assert.strictEqual(delta.maximum, 5);
    });

    void it('StockLevel: type integer, minimum 0, maximum 100', () => {
      // StockLevel also has multipleOf:5 which is a jt: extension not
      // representable via standard XSD facets — tested separately via
      // the fractionDigits test above.
      const dt = 'urn:bookstore:StockLevel';
      const bMin = nextBnode();
      const bMax = nextBnode();
      const quads: QuadInterface[] = [
        declareDatatype(dt),
        setOnDatatype(dt, XSD_INTEGER),
        ...makeWithRestrictions(dt, [
          bMin,
          bMax
        ]),
        facetNumeric(bMin, XSD_MIN_INCLUSIVE, 0),
        facetNumeric(bMax, XSD_MAX_INCLUSIVE, 100)
      ];
      const delta = requireDelta(importDatatypes(quads, makeCtx(quads)).schemaDeltas, dt);

      assert.strictEqual(delta.type, 'integer');
      assert.strictEqual(delta.minimum, 0);
      assert.strictEqual(delta.maximum, 100);
    });

    void it('StreetLine: type string, minLength 1, maxLength 200', () => {
      const dt = 'urn:bookstore:StreetLine';
      const bMin = nextBnode();
      const bMax = nextBnode();
      const quads: QuadInterface[] = [
        declareDatatype(dt),
        setOnDatatype(dt, XSD_STRING),
        ...makeWithRestrictions(dt, [
          bMin,
          bMax
        ]),
        blankQuad(bMin, XSD_MIN_LENGTH, intLit(1)),
        blankQuad(bMax, XSD_MAX_LENGTH, intLit(200))
      ];
      const delta = requireDelta(importDatatypes(quads, makeCtx(quads)).schemaDeltas, dt);

      assert.strictEqual(delta.type, 'string');
      assert.strictEqual(delta.minLength, 1);
      assert.strictEqual(delta.maxLength, 200);
    });

    void it('Title: type string, minLength 1, maxLength 500', () => {
      const dt = 'urn:bookstore:Title';
      const bMin = nextBnode();
      const bMax = nextBnode();
      const quads: QuadInterface[] = [
        declareDatatype(dt),
        setOnDatatype(dt, XSD_STRING),
        ...makeWithRestrictions(dt, [
          bMin,
          bMax
        ]),
        blankQuad(bMin, XSD_MIN_LENGTH, intLit(1)),
        blankQuad(bMax, XSD_MAX_LENGTH, intLit(500))
      ];
      const delta = requireDelta(importDatatypes(quads, makeCtx(quads)).schemaDeltas, dt);

      assert.strictEqual(delta.type, 'string');
      assert.strictEqual(delta.minLength, 1);
      assert.strictEqual(delta.maxLength, 500);
    });

    void it('WeightGrams: type number, minimum 0', () => {
      const dt = 'urn:bookstore:WeightGrams';
      const bMin = nextBnode();
      const quads: QuadInterface[] = [
        declareDatatype(dt),
        setOnDatatype(dt, XSD_DECIMAL),
        ...makeWithRestrictions(dt, [bMin]),
        facetNumeric(bMin, XSD_MIN_INCLUSIVE, 0)
      ];
      const delta = requireDelta(importDatatypes(quads, makeCtx(quads)).schemaDeltas, dt);

      assert.strictEqual(delta.type, 'number');
      assert.strictEqual(delta.minimum, 0);
    });
  });
});
