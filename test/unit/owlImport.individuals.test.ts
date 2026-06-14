/**
 * Unit tests for importIndividuals — OWL 2 §9.6 Assertions dispatcher.
 *
 * Covers:
 *   - owl:NamedIndividual with rdf:type class assertion + object property assertion
 *   - owl:sameAs pair (forward + reverse deduplication)
 *   - owl:differentFrom pair
 *   - owl:AllDifferent + owl:distinctMembers (pairwise invariants)
 *   - owl:NegativePropertyAssertion (named invariant)
 *   - owl:hasKey 2-property composite (invariant + jt:hasKey schemaDelta)
 *   - Bookstore round-trip: two sameAs pairs survive fromTbox
 */

import assert from 'node:assert/strict';
import {
  describe, it
} from 'node:test';
import type { QuadInterface } from '../../src/interfaces/Quad.js';
import type {
  OwlImportContextType, OwlImportFragmentType
} from '../../src/types/OwlImport.js';
import { importIndividuals } from '../../src/modules/ontology/importDispatch/Individuals.js';
import { Terms } from '../../src/modules/rdf/Terms.js';
import { SchemaGraph } from '../../src/modules/graph/SchemaGraph.js';
import { listQuad } from '../helpers/listQuad.js';
import { jsonLdNodesToQuads } from '../../src/modules/rdf/JsonLdToQuads.js';
import { JsonTology } from '../../src/index.js';
import { bookstoreEntities } from '../../examples/docs/bookstore/index.js';

// ---------------------------------------------------------------------------
// Quad construction helpers
// ---------------------------------------------------------------------------

const RDF_TYPE = 'http://www.w3.org/1999/02/22-rdf-syntax-ns#type';
const OWL_NS = 'http://www.w3.org/2002/07/owl#';
const OWL_SAME_AS = 'http://www.w3.org/2002/07/owl#sameAs';

function makeTypeQuad(subject: string, typeIri: string): QuadInterface {
  return Terms.quad(Terms.iri(subject), Terms.iri(RDF_TYPE), Terms.iri(typeIri));
}

function makeIriQuad(subject: string, predicate: string, object: string): QuadInterface {
  return Terms.quad(Terms.iri(subject), Terms.iri(predicate), Terms.iri(object));
}

function makeLiteralQuad(subject: string, predicate: string, value: unknown): QuadInterface {
  return Terms.quad(Terms.iri(subject), Terms.iri(predicate), Terms.literal(value));
}

function makeListQuad(subject: string, predicate: string, members: string[]): QuadInterface[] {
  return listQuad(
    Terms.iri(subject),
    Terms.iri(predicate),
    members.map((m) => {
      return Terms.iri(m);
    })
  );
}

// ---------------------------------------------------------------------------
// Pair normaliser — canonical (iriA < iriB) order for set-equality checks
// ---------------------------------------------------------------------------

function normalizePair(pair: readonly [string, string]): readonly [string, string] {
  const [
    a,
    b
  ] = pair;

  return a < b
    ? [
      a,
      b
    ]
    : [
      b,
      a
    ];
}

// ---------------------------------------------------------------------------
// OwlImportContextType factory backed by a real quad-derived SchemaGraph
// ---------------------------------------------------------------------------

function makeCtx(
  allClassIris: string[] = [],
  allPropertyIris: string[] = [],
  reportUnsupported: (axiomIri: string, subjectIri: null | string) => void = () => { /* no-op */ }
): OwlImportContextType {
  return {
    'allClassIris': new Set(allClassIris),
    'allPropertyIris': new Set(allPropertyIris),
    'baseIRI': 'urn:test',
    'curie': {
      'compact': (iri: string) => {
        return iri;
      },
      'expand': (curie: string) => {
        return curie;
      },
      'expandIfNeeded': (value: string) => {
        return value;
      }
    },
    'graph': SchemaGraph.fromQuads([], { 'baseIRI': 'urn:test' }),
    'isDatatype': () => {
      return false;
    },
    'prefixes': {},
    reportUnsupported
  };
}

/**
 * Run the Individuals dispatcher with a real quad-backed graph constructed
 * from the same `quads` array. Replaces ad-hoc `importIndividuals(quads,
 * makeCtx(...))` calls so the graph and the quads stay in sync.
 */
function runIndividuals(
  quads: QuadInterface[],
  allClassIris: string[] = [],
  allPropertyIris: string[] = [],
  reportUnsupported: (axiomIri: string, subjectIri: null | string) => void = () => { /* no-op */ }
): OwlImportFragmentType {
  const ctx = makeCtx(allClassIris, allPropertyIris, reportUnsupported);
  const withGraph: OwlImportContextType = {
    ...ctx,
    'graph': SchemaGraph.fromQuads(quads, { 'baseIRI': 'urn:test' })
  };

  return importIndividuals(quads, withGraph);
}

// ---------------------------------------------------------------------------
// Empty input — should return an empty fragment without throwing
// ---------------------------------------------------------------------------

void describe('importIndividuals — empty input', () => {
  void it('returns a valid empty fragment for no quads', () => {
    const result: OwlImportFragmentType = runIndividuals([]);

    assert.equal(result.individuals.length, 0);
    assert.equal(result.sameAs.length, 0);
    assert.equal(result.invariants.length, 0);
    assert.equal(result.characteristics.length, 0);
    assert.equal(result.schemaDeltas.size, 0);
  });
});

// ---------------------------------------------------------------------------
// Named individual with type + property assertion
// ---------------------------------------------------------------------------

void describe('importIndividuals — NamedIndividual with type and property assertion', () => {
  void it('collects the individual, its class type, and registered property value', () => {
    const classIri = 'urn:test:Person';
    const propIri = 'urn:test:hasName';
    const individualIri = 'urn:test:alice';

    const quads: QuadInterface[] = [
      makeTypeQuad(individualIri, `${OWL_NS}NamedIndividual`),
      makeTypeQuad(individualIri, classIri),
      makeLiteralQuad(individualIri, propIri, 'Alice')
    ];

    const result = runIndividuals(quads, [classIri], [propIri]);

    assert.equal(result.individuals.length, 1, 'one individual collected');
    const ind = result.individuals.at(0);

    assert.ok(ind, 'individual present');
    assert.equal(ind.iri, individualIri);
    assert.deepEqual(ind.types, [classIri], 'types includes the class IRI');
    assert.equal(ind.properties[propIri], 'Alice', 'property assertion captured');
  });

  void it('ignores rdf:type NamedIndividual in the types array', () => {
    const classIri = 'urn:test:Book';
    const individualIri = 'urn:test:book1';

    const quads: QuadInterface[] = [
      makeTypeQuad(individualIri, `${OWL_NS}NamedIndividual`),
      makeTypeQuad(individualIri, classIri)
    ];

    const result = runIndividuals(quads, [classIri], []);
    const ind = result.individuals.at(0);

    assert.ok(ind, 'individual present');
    assert.ok(
      !ind.types.includes(`${OWL_NS}NamedIndividual`),
      'NamedIndividual type is filtered out'
    );
    assert.ok(ind.types.includes(classIri), 'class IRI is in types');
  });

  void it('skips property assertions for unregistered predicates', () => {
    const classIri = 'urn:test:Widget';
    const registeredProp = 'urn:test:size';
    const unregisteredProp = 'urn:test:unknownProp';
    const individualIri = 'urn:test:w1';

    const quads: QuadInterface[] = [
      makeTypeQuad(individualIri, `${OWL_NS}NamedIndividual`),
      makeTypeQuad(individualIri, classIri),
      makeLiteralQuad(individualIri, registeredProp, 42),
      makeLiteralQuad(individualIri, unregisteredProp, 'surprise')
    ];

    const result = runIndividuals(quads, [classIri], [registeredProp]);
    const ind = result.individuals.at(0);

    assert.ok(ind, 'individual present');
    assert.equal(ind.properties[registeredProp], 42);
    assert.equal(ind.properties[unregisteredProp], undefined);
  });
});

// ---------------------------------------------------------------------------
// owl:sameAs
// ---------------------------------------------------------------------------

void describe('importIndividuals — owl:sameAs', () => {
  void it('collects a sameAs pair from a forward assertion', () => {
    const iriA = 'urn:test:alice';
    const iriB = 'urn:test:alice-legacy';

    const result = runIndividuals([makeIriQuad(iriA, OWL_SAME_AS, iriB)]);

    assert.equal(result.sameAs.length, 1);
    const first = result.sameAs.at(0);

    assert.ok(first, 'sameAs pair present');
    assert.equal(first[0], iriA);
    assert.equal(first[1], iriB);
  });

  void it('deduplicates forward and reverse sameAs triples', () => {
    const iriA = 'urn:test:alice';
    const iriB = 'urn:test:alice-legacy';

    const result = runIndividuals([
      makeIriQuad(iriA, OWL_SAME_AS, iriB),
      makeIriQuad(iriB, OWL_SAME_AS, iriA)
    ]);

    assert.equal(result.sameAs.length, 1, 'forward and reverse produce one pair');
  });

  void it('drops self-identity assertions', () => {
    const iriA = 'urn:test:alice';

    const result = runIndividuals([makeIriQuad(iriA, OWL_SAME_AS, iriA)]);

    assert.equal(result.sameAs.length, 0, 'self sameAs is dropped');
  });

  void it('collects two distinct sameAs pairs', () => {
    const result = runIndividuals([
      makeIriQuad('urn:a', OWL_SAME_AS, 'urn:b'),
      makeIriQuad('urn:c', OWL_SAME_AS, 'urn:d')
    ]);

    assert.equal(result.sameAs.length, 2);
  });
});

// ---------------------------------------------------------------------------
// owl:differentFrom
// ---------------------------------------------------------------------------

void describe('importIndividuals — owl:differentFrom', () => {
  void it('produces a named differentFrom invariant', () => {
    const iriA = 'urn:test:alice';
    const iriB = 'urn:test:bob';

    const result = runIndividuals([makeIriQuad(iriA, `${OWL_NS}differentFrom`, iriB)]);

    assert.equal(result.invariants.length, 1);
    const inv = result.invariants.at(0);

    assert.ok(inv, 'invariant present');
    assert.ok(inv.invariant.name.includes('differentFrom'));
    assert.ok(inv.invariant.name.includes(iriA));
    assert.ok(inv.invariant.name.includes(iriB));
    assert.equal(inv.schemaId, iriA);
  });

  void it('deduplicates symmetric differentFrom assertions', () => {
    const iriA = 'urn:test:alice';
    const iriB = 'urn:test:bob';

    const result = runIndividuals([
      makeIriQuad(iriA, `${OWL_NS}differentFrom`, iriB),
      makeIriQuad(iriB, `${OWL_NS}differentFrom`, iriA)
    ]);

    assert.equal(result.invariants.length, 1, 'symmetric pair is deduplicated');
  });
});

// ---------------------------------------------------------------------------
// owl:AllDifferent + owl:distinctMembers
// ---------------------------------------------------------------------------

void describe('importIndividuals — owl:AllDifferent', () => {
  void it('produces pairwise differentFrom invariants for three members', () => {
    const iriA = 'urn:test:i1';
    const iriB = 'urn:test:i2';
    const iriC = 'urn:test:i3';

    const quads: QuadInterface[] = [
      Terms.quad(Terms.blank('allDiff1'), Terms.iri(RDF_TYPE), Terms.iri(`${OWL_NS}AllDifferent`)),
      ...listQuad(
        Terms.blank('allDiff1'),
        Terms.iri(`${OWL_NS}distinctMembers`),
        [
          Terms.iri(iriA),
          Terms.iri(iriB),
          Terms.iri(iriC)
        ]
      )
    ];

    const result = runIndividuals(quads);

    // C(3, 2) = 3 pairs: (A,B), (A,C), (B,C)
    assert.equal(result.invariants.length, 3, 'three pairwise differentFrom invariants');

    const names = result.invariants.map((inv) => {
      return inv.invariant.name;
    });

    assert.ok(names.some((n) => {
      return n.includes(iriA) && n.includes(iriB);
    }), 'A-B pair present');
    assert.ok(names.some((n) => {
      return n.includes(iriA) && n.includes(iriC);
    }), 'A-C pair present');
    assert.ok(names.some((n) => {
      return n.includes(iriB) && n.includes(iriC);
    }), 'B-C pair present');
  });
});

// ---------------------------------------------------------------------------
// owl:NegativePropertyAssertion
// ---------------------------------------------------------------------------

void describe('importIndividuals — owl:NegativePropertyAssertion', () => {
  void it('produces a named negativePropertyAssertion invariant for an object value', () => {
    const sourceIri = 'urn:test:alice';
    const propIri = 'urn:test:knows';
    const targetIri = 'urn:test:bob';

    const quads: QuadInterface[] = [
      Terms.quad(Terms.blank('npa1'), Terms.iri(RDF_TYPE), Terms.iri(`${OWL_NS}NegativePropertyAssertion`)),
      Terms.quad(Terms.blank('npa1'), Terms.iri(`${OWL_NS}sourceIndividual`), Terms.iri(sourceIri)),
      Terms.quad(Terms.blank('npa1'), Terms.iri(`${OWL_NS}assertionProperty`), Terms.iri(propIri)),
      Terms.quad(Terms.blank('npa1'), Terms.iri(`${OWL_NS}targetIndividual`), Terms.iri(targetIri))
    ];

    const result = runIndividuals(quads);

    assert.equal(result.invariants.length, 1);
    const inv = result.invariants.at(0);

    assert.ok(inv, 'invariant present');
    assert.ok(inv.invariant.name.includes('negativePropertyAssertion'));
    assert.ok(inv.invariant.name.includes(sourceIri));
    assert.ok(inv.invariant.name.includes(propIri));
    assert.ok(inv.invariant.name.includes(targetIri));
    assert.equal(inv.schemaId, sourceIri);
  });

  void it('produces a negativePropertyAssertion invariant for a datatype value', () => {
    const sourceIri = 'urn:test:alice';
    const propIri = 'urn:test:age';

    const quads: QuadInterface[] = [
      Terms.quad(Terms.blank('npa2'), Terms.iri(RDF_TYPE), Terms.iri(`${OWL_NS}NegativePropertyAssertion`)),
      Terms.quad(Terms.blank('npa2'), Terms.iri(`${OWL_NS}sourceIndividual`), Terms.iri(sourceIri)),
      Terms.quad(Terms.blank('npa2'), Terms.iri(`${OWL_NS}assertionProperty`), Terms.iri(propIri)),
      Terms.quad(Terms.blank('npa2'), Terms.iri(`${OWL_NS}targetValue`), Terms.literal(99))
    ];

    const result = runIndividuals(quads);
    const inv = result.invariants.at(0);

    assert.ok(inv, 'invariant present');
    assert.ok(inv.invariant.name.includes('negativePropertyAssertion'));
    assert.ok(inv.invariant.name.includes('99'));
  });
});

// ---------------------------------------------------------------------------
// owl:hasKey
// ---------------------------------------------------------------------------

void describe('importIndividuals — owl:hasKey', () => {
  void it('produces a hasKey invariant + jt:hasKey schemaDelta for a 2-property composite', () => {
    const classIri = 'urn:test:Person';
    const prop1 = 'urn:test:firstName';
    const prop2 = 'urn:test:lastName';

    const result = runIndividuals(makeListQuad(classIri, `${OWL_NS}hasKey`, [
      prop1,
      prop2
    ]));

    // Invariant
    assert.equal(result.invariants.length, 1);
    const inv = result.invariants.at(0);

    assert.ok(inv, 'invariant present');
    assert.ok(inv.invariant.name.includes('hasKey'));
    assert.ok(inv.invariant.name.includes(classIri));
    assert.ok(inv.invariant.name.includes(prop1));
    assert.ok(inv.invariant.name.includes(prop2));
    assert.equal(inv.schemaId, classIri);

    // Schema delta jt:hasKey annotation
    const delta = result.schemaDeltas.get(classIri);

    assert.ok(delta, 'schemaDelta entry created for class');
    const hasKey = delta['jt:hasKey'];

    assert.ok(Array.isArray(hasKey), 'jt:hasKey is an array');
    assert.equal(hasKey.length, 1, 'one key set');
    // hasKey is ReadonlyArray<readonly string[]> — first entry has prop1, prop2
    assert.deepEqual(
      hasKey[0],
      [
        prop1,
        prop2
      ]
    );
  });

  void it('accumulates multiple hasKey declarations on the same class', () => {
    const classIri = 'urn:test:Entity';
    const prop1 = 'urn:test:p1';
    const prop2 = 'urn:test:p2';
    const prop3 = 'urn:test:p3';

    const result = runIndividuals([
      ...makeListQuad(classIri, `${OWL_NS}hasKey`, [
        prop1,
        prop2
      ]),
      ...makeListQuad(classIri, `${OWL_NS}hasKey`, [prop3])
    ]);

    assert.equal(result.invariants.length, 2);

    const delta = result.schemaDeltas.get(classIri);

    assert.ok(delta, 'delta present');
    const hasKey = delta['jt:hasKey'];

    assert.ok(Array.isArray(hasKey));
    assert.equal(hasKey.length, 2);
  });

  void it('reports an empty hasKey list as unsupported and produces no invariant', () => {
    const classIri = 'urn:test:Ghost';
    const captured: string[] = [];

    const result = runIndividuals(
      listQuad(
        Terms.iri(classIri),
        Terms.iri(`${OWL_NS}hasKey`),
        []
      ),
      [],
      [],
      (axiomIri) => {
        captured.push(axiomIri);
      }
    );

    assert.equal(result.invariants.length, 0, 'no invariant for empty key');
    assert.ok(captured.includes('owl:hasKey'), 'empty hasKey reported as unsupported');
  });
});

// ---------------------------------------------------------------------------
// Bookstore round-trip: sameAs pairs survive fromTbox
//
// Note: toTbox() serialises OWL TBox quads (class declarations, property
// declarations, axioms) but does NOT serialise owl:sameAs ABox identity
// assertions — those live in the SameAsStore and are emitted by toQuads().
//
// The round-trip test verifies that importIndividuals correctly extracts
// sameAs pairs when they are PRESENT in the input quads. We construct
// a quad array that mirrors what appendSameAsQuads would emit for the two
// bookstore sameAs pairs, append them to the TBox quads, and confirm
// fromTbox recovers both pairs.
// ---------------------------------------------------------------------------

void describe('importIndividuals — bookstore sameAs round-trip', () => {
  void it('fromTbox recovers the two bookstore sameAs pairs when embedded in TBox input', () => {
    const tboxJsonLd = bookstoreEntities.toTbox().jsonLd();

    const pairA: readonly [string, string] = [
      'urn:bookstore:customer:bastian-bux',
      'urn:coreander-antiquariat:cust-00042'
    ];
    const pairB: readonly [string, string] = [
      'urn:bookstore:rarebook:neverending-1979-thienemann',
      'http://www.worldcat.org/oclc/5705614'
    ];

    // appendSameAsQuads emits both directions for each pair
    const extraQuads: QuadInterface[] = [
      makeIriQuad(pairA[0], OWL_SAME_AS, pairA[1]),
      makeIriQuad(pairA[1], OWL_SAME_AS, pairA[0]),
      makeIriQuad(pairB[0], OWL_SAME_AS, pairB[1]),
      makeIriQuad(pairB[1], OWL_SAME_AS, pairB[0])
    ];

    const parsed = JSON.parse(tboxJsonLd) as Record<string, unknown>;
    const jsonLdCtx = parsed['@context'] as Record<string, string>;
    const graphArr = parsed['@graph'] as Array<Record<string, unknown>>;
    const tboxQuads = jsonLdNodesToQuads(graphArr, jsonLdCtx);

    const result = JsonTology.fromTbox(
      [
        ...tboxQuads,
        ...extraQuads
      ],
      { 'baseIRI': 'https://bookstore.example' }
    );

    const resultPairs = result.sameAs.map((pair) => {
      return normalizePair(pair);
    });
    const expectedNorm = [
      pairA,
      pairB
    ].map((pair) => {
      return normalizePair(pair);
    });

    for (const expected of expectedNorm) {
      assert.ok(
        resultPairs.some((candidate) => {
          return candidate[0] === expected[0] && candidate[1] === expected[1];
        }),
        `sameAs pair not found: ${expected[0]} ↔ ${expected[1]}`
      );
    }

    assert.ok(
      result.sameAs.length >= 2,
      `expected at least 2 sameAs pairs, got ${result.sameAs.length}`
    );
  });
});
