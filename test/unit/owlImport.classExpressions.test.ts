/**
 * Unit tests for the ClassExpressions dispatcher (importClassExpressions).
 *
 * Covers:
 *   - owl:intersectionOf of two named classes → allOf
 *   - owl:unionOf of two named classes → oneOf
 *   - owl:unionOf with shared hasValue discriminator → oneOf with discriminator detection
 *   - owl:oneOf of three named individuals with string values → enum
 *   - Nested owl:intersectionOf containing a owl:unionOf → nested allOf/oneOf
 *   - Empty quad input → empty schemaDeltas
 *   - Non-class subjects → skipped
 *   - Bookstore: InPrintBook/OutOfPrintBook use equivalentClass/oneOf patterns;
 *     any bookstore class that produces allOf/oneOf must round-trip.
 */

import assert from 'node:assert/strict';
import {
  describe, it
} from 'node:test';
import { importClassExpressions } from '../../src/modules/ontology/importDispatch/ClassExpressions.js';
import { Curie } from '../../src/modules/quads/Curie.js';
import { STANDARD_PREFIXES } from '../../src/constants/STANDARD_PREFIXES.js';
import { Terms } from '../../src/modules/quads/Terms.js';
import { SchemaGraph } from '../../src/modules/graph/SchemaGraph.js';
import { listQuad } from '../helpers/listQuad.js';
import type { QuadInterface } from '../../src/interfaces/QuadInterface.js';
import type { OwlImportContextType } from '../../src/types/OwlImport.js';

// ---------------------------------------------------------------------------
// OWL full IRI constants (JsonLdToQuads expands to full IRIs)
// ---------------------------------------------------------------------------

const OWL_INTERSECTION_OF = 'http://www.w3.org/2002/07/owl#intersectionOf';
const OWL_UNION_OF = 'http://www.w3.org/2002/07/owl#unionOf';
const OWL_ONE_OF = 'http://www.w3.org/2002/07/owl#oneOf';
const OWL_HAS_VALUE = 'http://www.w3.org/2002/07/owl#hasValue';
const OWL_ON_PROPERTY = 'http://www.w3.org/2002/07/owl#onProperty';
const OWL_RESTRICTION = 'http://www.w3.org/2002/07/owl#Restriction';
const RDF_TYPE = 'http://www.w3.org/1999/02/22-rdf-syntax-ns#type';
const XSD_STRING = 'http://www.w3.org/2001/XMLSchema#string';

// ---------------------------------------------------------------------------
// Context helpers
// ---------------------------------------------------------------------------

const curie = new Curie(STANDARD_PREFIXES);

function makeCtx(classIris: string[] = [], quads: QuadInterface[] = []): OwlImportContextType & {
  'unsupportedLog': Array<{ 'axiomIri': string;
    'subjectIri': null | string }>;
} {
  const unsupportedLog: Array<{ 'axiomIri': string;
    'subjectIri': null | string }> = [];

  return {
    'allClassIris': new Set(classIris),
    'allPropertyIris': new Set(),
    'baseIRI': 'https://example.com/',
    curie,
    'graph': SchemaGraph.fromQuads(quads, {
      'baseIRI': 'https://example.com/',
      'prefixes': STANDARD_PREFIXES
    }),
    'isDatatype': () => {
      return false;
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
// Quad builders
// ---------------------------------------------------------------------------

function makeTypeQuad(subject: string, typeIri: string): QuadInterface {
  return Terms.quad(
    Terms.iri(subject),
    Terms.iri(RDF_TYPE),
    Terms.iri(typeIri)
  );
}

/**
 * Build the parent quad + rdf:first/rdf:rest triples for an rdf:List of
 * named-class IRIs. Splat the result into the test's quad array.
 */
function makeListQuad(subject: string, predicate: string, memberIris: string[]): QuadInterface[] {
  return listQuad(
    Terms.iri(subject),
    Terms.iri(predicate),
    memberIris.map((iri) => {
      return Terms.iri(iri);
    })
  );
}

/**
 * Build the parent quad + rdf:first/rdf:rest triples for an rdf:List of
 * blank-node members. Splat the result into the test's quad array.
 */
function makeListQuadWithBnodes(
  subject: string,
  predicate: string,
  bnodeIds: string[]
): QuadInterface[] {
  return listQuad(
    Terms.iri(subject),
    Terms.iri(predicate),
    bnodeIds.map((id) => {
      return Terms.blank(id);
    })
  );
}

/**
 * Build quads for an owl:Restriction blank node with a hasValue constraint.
 * Used to test discriminated union detection.
 */
function makeRestrictionBnodeQuads(
  bnodeId: string,
  onPropertyIri: string,
  hasValue: unknown,
  datatypeIri = XSD_STRING
): QuadInterface[] {
  const bTerm = Terms.blank(bnodeId);

  return [
    Terms.quad(bTerm, Terms.iri(RDF_TYPE), Terms.iri(OWL_RESTRICTION)),
    Terms.quad(bTerm, Terms.iri(OWL_ON_PROPERTY), Terms.iri(onPropertyIri)),
    Terms.quad(bTerm, Terms.iri(OWL_HAS_VALUE), Terms.literal(hasValue, { 'datatype': Terms.iri(datatypeIri) }))
  ];
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

void describe('importClassExpressions', { 'concurrency': true }, () => {
  // ── Empty input ────────────────────────────────────────────────────────────

  void it('returns an empty fragment for an empty quad array', () => {
    const ctx = makeCtx();
    const fragment = importClassExpressions([], ctx);

    assert.strictEqual(fragment.schemaDeltas.size, 0);
    assert.deepEqual(fragment.characteristics, []);
    assert.deepEqual(fragment.invariants, []);
    assert.deepEqual(fragment.sameAs, []);
    assert.deepEqual(fragment.individuals, []);
  });

  // ── owl:intersectionOf → allOf ─────────────────────────────────────────────

  void it('owl:intersectionOf of two named classes → allOf with $ref members', () => {
    const classA = 'https://example.com/A';
    const classB = 'https://example.com/B';
    const subject = 'https://example.com/AB';

    const quads: QuadInterface[] = [
      makeTypeQuad(subject, 'http://www.w3.org/2002/07/owl#Class'),
      ...makeListQuad(subject, OWL_INTERSECTION_OF, [
        classA,
        classB
      ])
    ];

    const ctx = makeCtx([
      subject,
      classA,
      classB
    ], quads);
    const fragment = importClassExpressions(quads, ctx);
    const delta = fragment.schemaDeltas.get(subject);

    assert.ok(delta !== undefined, 'delta must be present for subject');
    assert.ok(Array.isArray(delta.allOf), 'delta must have allOf');
    assert.strictEqual(delta.allOf.length, 2, 'allOf must have two members');

    const refs = new Set((delta.allOf as Array<{ '$ref'?: string }>).map((m) => {
      return m.$ref;
    }));

    assert.ok(refs.has(classA), 'allOf must include $ref to A');
    assert.ok(refs.has(classB), 'allOf must include $ref to B');
  });

  // ── owl:unionOf → oneOf ────────────────────────────────────────────────────

  void it('owl:unionOf of two named classes → oneOf with $ref members', () => {
    const classC = 'https://example.com/C';
    const classD = 'https://example.com/D';
    const subject = 'https://example.com/CD';

    const quads: QuadInterface[] = [
      makeTypeQuad(subject, 'http://www.w3.org/2002/07/owl#Class'),
      ...makeListQuad(subject, OWL_UNION_OF, [
        classC,
        classD
      ])
    ];

    const ctx = makeCtx([
      subject,
      classC,
      classD
    ], quads);
    const fragment = importClassExpressions(quads, ctx);
    const delta = fragment.schemaDeltas.get(subject);

    assert.ok(delta !== undefined, 'delta must be present for subject');
    assert.ok(Array.isArray(delta.oneOf), 'delta must have oneOf');
    assert.strictEqual(delta.oneOf.length, 2, 'oneOf must have two members');

    const refs = new Set((delta.oneOf as Array<{ '$ref'?: string }>).map((m) => {
      return m.$ref;
    }));

    assert.ok(refs.has(classC), 'oneOf must include $ref to C');
    assert.ok(refs.has(classD), 'oneOf must include $ref to D');
  });

  // ── owl:unionOf with shared discriminator ──────────────────────────────────

  void it('owl:unionOf with shared hasValue discriminator → oneOf (discriminator detected)', () => {
    const subject = 'https://example.com/Shape';
    const propIri = 'https://example.com/Shape#kind';

    // Two blank-node restriction members — each has owl:hasValue on the same property.
    const bnodeA = 'restriction-circle';
    const bnodeB = 'restriction-rect';

    const quads: QuadInterface[] = [
      makeTypeQuad(subject, 'http://www.w3.org/2002/07/owl#Class'),
      ...makeListQuadWithBnodes(subject, OWL_UNION_OF, [
        bnodeA,
        bnodeB
      ]),
      // Restriction blank nodes
      ...makeRestrictionBnodeQuads(bnodeA, propIri, 'circle'),
      ...makeRestrictionBnodeQuads(bnodeB, propIri, 'rect')
    ];

    const ctx = makeCtx([subject], quads);
    const fragment = importClassExpressions(quads, ctx);
    const delta = fragment.schemaDeltas.get(subject);

    // The union resolves to an empty oneOf (blank-node Restrictions are skipped
    // since they belong to PropertyRestrictions) — but discriminator detection
    // fires and is recorded as an unsupported report.
    // When all members are Restrictions (no named-class members), the oneOf may
    // be empty and no delta is emitted.
    assert.ok(
      delta === undefined || Array.isArray(delta.oneOf),
      'delta is absent (all members are restrictions) or has oneOf'
    );

    // Discriminator was detected — recorded via reportUnsupported.
    const discReports = ctx.unsupportedLog.filter((report) => {
      return report.axiomIri.startsWith('discriminator:');
    });

    assert.ok(discReports.length > 0, 'discriminator detection should be reported');
    assert.ok(
      discReports[0].axiomIri.includes('kind'),
      `discriminator property name should include 'kind'; got: ${discReports[0].axiomIri}`
    );
  });

  // ── owl:oneOf → enum ───────────────────────────────────────────────────────

  void it('owl:oneOf of three named individuals with string values → enum', () => {
    const subject = 'https://example.com/Color';

    // Individuals as literal-carrying list items (as OwlProjection emits them).
    const oneOfQuads = listQuad(
      Terms.iri(subject),
      Terms.iri(OWL_ONE_OF),
      [
        Terms.literal({
          '@type': 'http://www.w3.org/2001/XMLSchema#string',
          '@value': 'red'
        }),
        Terms.literal({
          '@type': 'http://www.w3.org/2001/XMLSchema#string',
          '@value': 'green'
        }),
        Terms.literal({
          '@type': 'http://www.w3.org/2001/XMLSchema#string',
          '@value': 'blue'
        })
      ]
    );

    const quads: QuadInterface[] = [
      makeTypeQuad(subject, 'http://www.w3.org/2002/07/owl#Class'),
      ...oneOfQuads
    ];

    const ctx = makeCtx([subject], quads);
    const fragment = importClassExpressions(quads, ctx);
    const delta = fragment.schemaDeltas.get(subject);

    assert.ok(delta !== undefined, 'delta must be present for subject');
    assert.ok(Array.isArray(delta.enum), 'delta must have enum');
    assert.strictEqual(delta.enum.length, 3, 'enum must have three values');
    assert.ok(delta.enum.includes('red'), 'enum must include red');
    assert.ok(delta.enum.includes('green'), 'enum must include green');
    assert.ok(delta.enum.includes('blue'), 'enum must include blue');
  });

  // ── owl:oneOf with raw string individual IRIs ───────────────────────────────

  void it('owl:oneOf of named individual IRIs → enum with IRI strings', () => {
    const subject = 'https://example.com/Status';
    const i1 = 'https://example.com/Status/Active';
    const i2 = 'https://example.com/Status/Inactive';

    const quads: QuadInterface[] = [
      makeTypeQuad(subject, 'http://www.w3.org/2002/07/owl#Class'),
      ...makeListQuad(subject, OWL_ONE_OF, [
        i1,
        i2
      ])
    ];

    const ctx = makeCtx([subject], quads);
    const fragment = importClassExpressions(quads, ctx);
    const delta = fragment.schemaDeltas.get(subject);

    assert.ok(delta !== undefined, 'delta must be present for subject');
    assert.ok(Array.isArray(delta.enum), 'delta must have enum');
    assert.strictEqual(delta.enum.length, 2, 'enum must have two values');
    assert.ok(delta.enum.some((iri) => {
      return iri === i1;
    }), 'enum must include i1 IRI');
    assert.ok(delta.enum.some((iri) => {
      return iri === i2;
    }), 'enum must include i2 IRI');
  });

  // ── Nested intersectionOf / unionOf ────────────────────────────────────────

  void it('nested intersectionOf containing a unionOf → allOf with inline oneOf member', () => {
    const classE = 'https://example.com/E';
    const classF = 'https://example.com/F';
    const classG = 'https://example.com/G';
    const subject = 'https://example.com/Nested';

    // Anonymous union blank node — value is bare ID without '_:' prefix.
    // Terms.blank(id) stores `id` (without prefix) in `.value`.
    // The subject index is keyed by quad.subject.value, so the blank node
    // quads must use Terms.blank() so their subject.value matches.
    const unionBnodeId = 'anon-union-1';

    const quads: QuadInterface[] = [
      makeTypeQuad(subject, 'http://www.w3.org/2002/07/owl#Class'),
      // subject intersectionOf [E, _:anon-union-1]
      ...listQuad(
        Terms.iri(subject),
        Terms.iri(OWL_INTERSECTION_OF),
        [
          Terms.iri(classE),
          Terms.blank(unionBnodeId)
        ]
      ),
      // _:anon-union-1 type owl:Class
      Terms.quad(
        Terms.blank(unionBnodeId),
        Terms.iri(RDF_TYPE),
        Terms.iri('http://www.w3.org/2002/07/owl#Class'),
        Terms.defaultGraph()
      ),
      // _:anon-union-1 unionOf [F, G]
      ...listQuad(
        Terms.blank(unionBnodeId),
        Terms.iri(OWL_UNION_OF),
        [
          Terms.iri(classF),
          Terms.iri(classG)
        ]
      )
    ];

    const ctx = makeCtx([
      subject,
      classE,
      classF,
      classG
    ], quads);
    const fragment = importClassExpressions(quads, ctx);
    const delta = fragment.schemaDeltas.get(subject);

    assert.ok(delta !== undefined, 'delta must be present for subject');
    assert.ok(Array.isArray(delta.allOf), 'delta must have allOf');

    // First member: $ref to E
    const allOf = delta.allOf as Array<Record<string, unknown>>;
    const eRef = allOf.find((m) => {
      return m.$ref === classE;
    });

    assert.ok(eRef !== undefined, 'allOf must contain $ref to E');

    // Second member: inline oneOf with F and G
    const inlineUnion = allOf.find((m) => {
      return Array.isArray(m.oneOf);
    });

    assert.ok(inlineUnion !== undefined, 'allOf must contain inline oneOf');
    const inlineRefs = new Set((inlineUnion.oneOf as Array<{ '$ref'?: string }>).map((m) => {
      return m.$ref;
    }));

    assert.ok(inlineRefs.has(classF), 'inline oneOf must include $ref to F');
    assert.ok(inlineRefs.has(classG), 'inline oneOf must include $ref to G');
  });

  // ── Non-class subjects ignored ─────────────────────────────────────────────

  void it('subjects not in allClassIris are skipped', () => {
    const nonClass = 'https://example.com/SomeProperty';
    const classH = 'https://example.com/H';

    const quads: QuadInterface[] = makeListQuad(nonClass, OWL_INTERSECTION_OF, [classH]);

    // nonClass is NOT in allClassIris
    const ctx = makeCtx([classH], quads);
    const fragment = importClassExpressions(quads, ctx);
    const delta = fragment.schemaDeltas.get(nonClass);

    assert.strictEqual(delta, undefined, 'non-class subjects must not produce deltas');
  });

  // ── prefixed predicate forms ───────────────────────────────────────────────

  void it('accepts prefixed owl:intersectionOf predicate (compact CURIE form)', () => {
    const classI = 'https://example.com/I';
    const classJ = 'https://example.com/J';
    const subject = 'https://example.com/IJ';

    const quads: QuadInterface[] = [
      makeTypeQuad(subject, 'http://www.w3.org/2002/07/owl#Class'),
      // Use prefixed form as QuadFactory emits
      ...listQuad(
        Terms.iri(subject),
        Terms.iri('owl:intersectionOf'),
        [
          Terms.iri(classI),
          Terms.iri(classJ)
        ]
      )
    ];

    const ctx = makeCtx([
      subject,
      classI,
      classJ
    ], quads);
    const fragment = importClassExpressions(quads, ctx);
    const delta = fragment.schemaDeltas.get(subject);

    assert.ok(delta !== undefined, 'delta must be present for subject with prefixed predicate');
    assert.ok(Array.isArray(delta.allOf), 'delta must have allOf');
  });

  // ── Bookstore round-trip: InPrintBook uses equivalentClass (owl:oneOf via hasValue) ──

  void it('bookstore InPrintBook-style pattern: oneOf from OwlProjection round-trips to enum', () => {
    // OwlProjection emits owl:oneOf for enum-valued schemas.
    // This test mimics what OwlProjection emits for a class with enum: ['in-print'].
    const subject = 'https://bookstore.example/InPrint';

    const oneOfQuads = listQuad(
      Terms.iri(subject),
      Terms.iri(OWL_ONE_OF),
      [Terms.literal({
        '@type': 'http://www.w3.org/2001/XMLSchema#string',
        '@value': 'in-print'
      })]
    );

    const quads: QuadInterface[] = [
      makeTypeQuad(subject, 'http://www.w3.org/2002/07/owl#Class'),
      ...oneOfQuads
    ];

    const ctx = makeCtx([subject], quads);
    const fragment = importClassExpressions(quads, ctx);
    const delta = fragment.schemaDeltas.get(subject);

    assert.ok(delta !== undefined, 'delta must be present');
    assert.ok(Array.isArray(delta.enum), 'delta must have enum');
    assert.ok(delta.enum.includes('in-print'), 'enum must include the in-print value');
  });
});
