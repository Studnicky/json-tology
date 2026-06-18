/**
 * Unit tests for the importCharacteristics dispatcher.
 *
 * Each test uses a minimal synthetic OWL 2 ontology (quad array) with one
 * property and one characteristic and verifies that the dispatcher returns
 * a fragment with the expected { propertyIri, characteristic } tuple.
 *
 * Also exercises the bookstore round-trip path: SchemaRegistry.addCharacteristic
 * is called with bookstore property IRIs and the resulting registered schemas
 * carry the correct boolean flags.
 */

import assert from 'node:assert/strict';
import {
  describe, it
} from 'node:test';
import { Characteristics } from '../../src/modules/ontology/importDispatch/Characteristics.js';
import { SchemaRegistry } from '../../src/modules/registry/SchemaRegistry.js';
import { Curie } from '../../src/modules/quads/Curie.js';
import { Terms } from '../../src/modules/quads/Terms.js';
import { STANDARD_PREFIXES } from '../../src/constants/STANDARD_PREFIXES.js';
import type { QuadInterface } from '../../src/interfaces/QuadInterface.js';
import type { OwlImportContextType } from '../../src/types/OwlImport.js';
import { SchemaGraph } from '../../src/modules/graph/SchemaGraph.js';

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const PROPERTY_IRI = 'urn:test:MyClass#rel';
const CLASS_IRI = 'urn:test:MyClass';
const RDF_TYPE = 'http://www.w3.org/1999/02/22-rdf-syntax-ns#type';

// OWL characteristic full IRIs
const OWL_FUNCTIONAL = 'http://www.w3.org/2002/07/owl#FunctionalProperty';
const OWL_INVERSE_FUNCTIONAL = 'http://www.w3.org/2002/07/owl#InverseFunctionalProperty';
const OWL_TRANSITIVE = 'http://www.w3.org/2002/07/owl#TransitiveProperty';
const OWL_SYMMETRIC = 'http://www.w3.org/2002/07/owl#SymmetricProperty';
const OWL_ASYMMETRIC = 'http://www.w3.org/2002/07/owl#AsymmetricProperty';
const OWL_REFLEXIVE = 'http://www.w3.org/2002/07/owl#ReflexiveProperty';
const OWL_IRREFLEXIVE = 'http://www.w3.org/2002/07/owl#IrreflexiveProperty';

// OWL characteristic curie forms
const OWL_FUNCTIONAL_CURIE = 'owl:FunctionalProperty';
const OWL_INVERSE_FUNCTIONAL_CURIE = 'owl:InverseFunctionalProperty';
const OWL_TRANSITIVE_CURIE = 'owl:TransitiveProperty';
const OWL_SYMMETRIC_CURIE = 'owl:SymmetricProperty';
const OWL_ASYMMETRIC_CURIE = 'owl:AsymmetricProperty';
const OWL_REFLEXIVE_CURIE = 'owl:ReflexiveProperty';
const OWL_IRREFLEXIVE_CURIE = 'owl:IrreflexiveProperty';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeCtx(allPropertyIris?: ReadonlySet<string>, quads: QuadInterface[] = []): OwlImportContextType {
  const curie = new Curie(STANDARD_PREFIXES);
  const unsupported: Array<{
    'axiomIri': string;
    'subjectIri': null | string;
  }> = [];
  const graph = SchemaGraph.fromQuads(quads, { 'baseIRI': 'urn:test' });

  return {
    'allClassIris': new Set<string>(),
    'allPropertyIris': allPropertyIris ?? new Set([PROPERTY_IRI]),
    'baseIRI': 'urn:test',
    curie,
    graph,
    'isDatatype': () => {
      return false;
    },
    'prefixes': STANDARD_PREFIXES,
    'reportUnsupported': (axiomIri, subjectIri) => {
      unsupported.push({
        axiomIri,
        subjectIri
      });
    }
  };
}

/**
 * Build a minimal quad: `<propertyIri> rdf:type <characteristicIri>`
 */
function typeQuad(propertyIri: string, characteristicIri: string): QuadInterface {
  return Terms.quad(
    Terms.iri(propertyIri),
    Terms.iri(RDF_TYPE),
    Terms.iri(characteristicIri)
  );
}

function registry(): SchemaRegistry {
  return new SchemaRegistry({ 'enableStrictGraph': false });
}

// ---------------------------------------------------------------------------
// Individual characteristic dispatching — one test per characteristic (full IRI)
// ---------------------------------------------------------------------------

void describe('importCharacteristics — full IRI characteristic detection', { 'concurrency': true }, () => {
  const fullIriCases: Array<[string, string]> = [
    [
      'Asymmetric',
      OWL_ASYMMETRIC
    ],
    [
      'Functional',
      OWL_FUNCTIONAL
    ],
    [
      'InverseFunctional',
      OWL_INVERSE_FUNCTIONAL
    ],
    [
      'Irreflexive',
      OWL_IRREFLEXIVE
    ],
    [
      'Reflexive',
      OWL_REFLEXIVE
    ],
    [
      'Symmetric',
      OWL_SYMMETRIC
    ],
    [
      'Transitive',
      OWL_TRANSITIVE
    ]
  ];

  for (const [
    characteristicName,
    fullIri
  ] of fullIriCases) {
    void it(`detects ${characteristicName} from full IRI quad`, () => {
      const quads: QuadInterface[] = [typeQuad(PROPERTY_IRI, fullIri)];
      const ctx = makeCtx(undefined, quads);
      const fragment = Characteristics.dispatch(quads, ctx);

      assert.strictEqual(fragment.characteristics.length, 1);
      const char0 = fragment.characteristics.at(0);

      if (char0 === undefined) {
        throw new Error('expected characteristic at index 0');
      }
      assert.strictEqual(char0.propertyIri, PROPERTY_IRI);
      assert.strictEqual(char0.characteristic, characteristicName);
    });
  }
});

// ---------------------------------------------------------------------------
// Individual characteristic dispatching — curie form
// ---------------------------------------------------------------------------

void describe('importCharacteristics — curie IRI characteristic detection', { 'concurrency': true }, () => {
  const curieCases: Array<[string, string]> = [
    [
      'Asymmetric',
      OWL_ASYMMETRIC_CURIE
    ],
    [
      'Functional',
      OWL_FUNCTIONAL_CURIE
    ],
    [
      'InverseFunctional',
      OWL_INVERSE_FUNCTIONAL_CURIE
    ],
    [
      'Irreflexive',
      OWL_IRREFLEXIVE_CURIE
    ],
    [
      'Reflexive',
      OWL_REFLEXIVE_CURIE
    ],
    [
      'Symmetric',
      OWL_SYMMETRIC_CURIE
    ],
    [
      'Transitive',
      OWL_TRANSITIVE_CURIE
    ]
  ];

  for (const [
    characteristicName,
    curieIri
  ] of curieCases) {
    void it(`detects ${characteristicName} from curie form quad`, () => {
      const quads: QuadInterface[] = [typeQuad(PROPERTY_IRI, curieIri)];
      const ctx = makeCtx(undefined, quads);
      const fragment = Characteristics.dispatch(quads, ctx);

      assert.strictEqual(fragment.characteristics.length, 1);
      const curieChar0 = fragment.characteristics.at(0);

      if (curieChar0 === undefined) {
        throw new Error('expected characteristic at index 0');
      }
      assert.strictEqual(curieChar0.propertyIri, PROPERTY_IRI);
      assert.strictEqual(curieChar0.characteristic, characteristicName);
    });
  }
});

// ---------------------------------------------------------------------------
// Multiple characteristics on the same property
// ---------------------------------------------------------------------------

void describe('importCharacteristics — multiple characteristics on one property', () => {
  void it('emits one tuple per characteristic', () => {
    const quads: QuadInterface[] = [
      typeQuad(PROPERTY_IRI, OWL_SYMMETRIC),
      typeQuad(PROPERTY_IRI, OWL_REFLEXIVE)
    ];
    const ctx = makeCtx(undefined, quads);
    const fragment = Characteristics.dispatch(quads, ctx);

    assert.strictEqual(fragment.characteristics.length, 2);
    const chars = fragment.characteristics.map((entry) => {
      return entry.characteristic;
    }).sort();

    assert.deepEqual(chars, [
      'Reflexive',
      'Symmetric'
    ]);
  });
});

// ---------------------------------------------------------------------------
// Deduplication — same characteristic repeated
// ---------------------------------------------------------------------------

void describe('importCharacteristics — deduplication', () => {
  void it('does not emit duplicate tuples for the same (propertyIri, characteristic) pair', () => {
    const quads: QuadInterface[] = [
      typeQuad(PROPERTY_IRI, OWL_TRANSITIVE),
      typeQuad(PROPERTY_IRI, OWL_TRANSITIVE)
    ];
    const ctx = makeCtx(undefined, quads);
    const fragment = Characteristics.dispatch(quads, ctx);

    assert.strictEqual(fragment.characteristics.length, 1);
  });
});

// ---------------------------------------------------------------------------
// Unknown property IRI — reported as unsupported
// ---------------------------------------------------------------------------

void describe('importCharacteristics — unknown property IRI', () => {
  void it('reports unsupported when subject IRI is not in allPropertyIris', () => {
    const unknownProp = 'urn:test:UnknownClass#thing';
    const collectedUnsupported: Array<{
      'axiomIri': string;
      'subjectIri': null | string;
    }> = [];
    const quads: QuadInterface[] = [typeQuad(unknownProp, OWL_FUNCTIONAL)];
    const ctx: OwlImportContextType = {
      ...makeCtx(new Set<string>(), quads),
      'reportUnsupported': (axiomIri, subjectIri) => {
        collectedUnsupported.push({
          axiomIri,
          subjectIri
        });
      }
    };
    const fragment = Characteristics.dispatch(quads, ctx);

    assert.strictEqual(fragment.characteristics.length, 0);
    assert.strictEqual(collectedUnsupported.length, 1);
    const unsupported0 = collectedUnsupported.at(0);

    if (unsupported0 === undefined) {
      throw new Error('expected unsupported entry at index 0');
    }
    assert.ok(unsupported0.axiomIri.includes('FunctionalProperty'));
    assert.strictEqual(unsupported0.subjectIri, unknownProp);
  });
});

// ---------------------------------------------------------------------------
// Empty input
// ---------------------------------------------------------------------------

void describe('importCharacteristics — empty input', () => {
  void it('returns an empty fragment for zero quads', () => {
    const ctx = makeCtx();
    const fragment = Characteristics.dispatch([], ctx);

    assert.strictEqual(fragment.characteristics.length, 0);
    assert.strictEqual(fragment.invariants.length, 0);
    assert.strictEqual(fragment.individuals.length, 0);
    assert.strictEqual(fragment.sameAs.length, 0);
    assert.strictEqual(fragment.schemaDeltas.size, 0);
  });
});

// ---------------------------------------------------------------------------
// Non-type quads are ignored
// ---------------------------------------------------------------------------

void describe('importCharacteristics — non-type quads', () => {
  void it('ignores quads with predicates other than rdf:type', () => {
    const subClassOfQuad: QuadInterface = Terms.quad(
      Terms.iri(PROPERTY_IRI),
      Terms.iri('http://www.w3.org/2000/01/rdf-schema#subClassOf'),
      Terms.iri(OWL_FUNCTIONAL)
    );
    const quads: QuadInterface[] = [subClassOfQuad];
    const ctx = makeCtx(undefined, quads);
    const fragment = Characteristics.dispatch(quads, ctx);

    assert.strictEqual(fragment.characteristics.length, 0);
  });
});

// ---------------------------------------------------------------------------
// SchemaRegistry.addCharacteristic — apply characteristics to registered schemas
// ---------------------------------------------------------------------------

void describe('SchemaRegistry.addCharacteristic — apply to registered schema', () => {
  const ALL_CHARACTERISTICS: Array<[string, string]> = [
    [
      'Asymmetric',
      'asymmetric'
    ],
    [
      'Functional',
      'functional'
    ],
    [
      'InverseFunctional',
      'inverseFunctional'
    ],
    [
      'Irreflexive',
      'irreflexive'
    ],
    [
      'Reflexive',
      'reflexive'
    ],
    [
      'Symmetric',
      'symmetric'
    ],
    [
      'Transitive',
      'transitive'
    ]
  ];

  for (const [
    characteristicName,
    schemaKey
  ] of ALL_CHARACTERISTICS) {
    void it(`adds ${schemaKey}:true to the named property slot`, () => {
      const reg = registry();

      reg.set({
        '$id': CLASS_IRI,
        'properties': { 'rel': { 'type': 'string' } },
        'type': 'object'
      });
      reg.addCharacteristic(`${CLASS_IRI}#rel`, characteristicName);

      const patched = reg.get(CLASS_IRI);

      assert.ok(patched !== undefined);

      const properties = patched.properties as Record<string, unknown>;
      const propEntry = properties.rel as Record<string, unknown>;

      assert.strictEqual(propEntry[schemaKey], true);
    });
  }

  void it('is idempotent — adding the same characteristic twice does not throw', () => {
    const reg = registry();

    reg.set({
      '$id': CLASS_IRI,
      'properties': { 'rel': {} },
      'type': 'object'
    });
    reg.addCharacteristic(`${CLASS_IRI}#rel`, 'Functional');

    assert.doesNotThrow(() => {
      reg.addCharacteristic(`${CLASS_IRI}#rel`, 'Functional');
    });

    const patched = reg.get(CLASS_IRI);

    assert.ok(patched !== undefined);

    const properties = patched.properties as Record<string, unknown>;
    const prop = properties.rel as Record<string, unknown>;

    assert.strictEqual(prop.functional, true);
  });

  void it('is a no-op for unrecognised characteristic names', () => {
    const reg = registry();

    reg.set({
      '$id': CLASS_IRI,
      'properties': { 'rel': {} },
      'type': 'object'
    });

    assert.doesNotThrow(() => {
      reg.addCharacteristic(`${CLASS_IRI}#rel`, 'UnknownCharacteristic');
    });
  });

  void it('is a no-op when the owning class is not registered', () => {
    const reg = registry();

    assert.doesNotThrow(() => {
      reg.addCharacteristic('urn:test:UnregisteredClass#prop', 'Functional');
    });
  });

  void it('is a no-op when the property IRI has no # fragment', () => {
    const reg = registry();

    reg.set({
      '$id': CLASS_IRI,
      'properties': { 'rel': {} },
      'type': 'object'
    });

    assert.doesNotThrow(() => {
      reg.addCharacteristic('urn:test:nofragment', 'Functional');
    });
  });
});

// ---------------------------------------------------------------------------
// Bookstore round-trip patterns — dispatcher output
// ---------------------------------------------------------------------------

void describe('importCharacteristics — bookstore round-trip patterns', () => {
  void it('Review.customerId — Functional round-trips via fragment.characteristics', () => {
    const propIri = 'urn:bookstore:Review#customerId';
    const quads: QuadInterface[] = [typeQuad(propIri, OWL_FUNCTIONAL)];
    const ctx = makeCtx(new Set([propIri]), quads);
    const fragment = Characteristics.dispatch(quads, ctx);

    assert.strictEqual(fragment.characteristics.length, 1);
    const reviewChar0 = fragment.characteristics.at(0);

    if (reviewChar0 === undefined) {
      throw new Error('expected characteristic at index 0');
    }
    assert.strictEqual(reviewChar0.characteristic, 'Functional');
    assert.strictEqual(reviewChar0.propertyIri, propIri);
  });

  void it('Customer.id — InverseFunctional round-trips via fragment.characteristics', () => {
    const propIri = 'urn:bookstore:Customer#id';
    const quads: QuadInterface[] = [typeQuad(propIri, OWL_INVERSE_FUNCTIONAL)];
    const ctx = makeCtx(new Set([propIri]), quads);
    const fragment = Characteristics.dispatch(quads, ctx);

    assert.strictEqual(fragment.characteristics.length, 1);
    const custChar0 = fragment.characteristics.at(0);

    if (custChar0 === undefined) {
      throw new Error('expected characteristic at index 0');
    }
    assert.strictEqual(custChar0.characteristic, 'InverseFunctional');
  });

  void it('Order.placedAt — Transitive + Irreflexive round-trips', () => {
    const propIri = 'urn:bookstore:Order#placedAt';
    const quads: QuadInterface[] = [
      typeQuad(propIri, OWL_TRANSITIVE),
      typeQuad(propIri, OWL_IRREFLEXIVE)
    ];
    const ctx = makeCtx(new Set([propIri]), quads);
    const fragment = Characteristics.dispatch(quads, ctx);

    assert.strictEqual(fragment.characteristics.length, 2);
    const chars = fragment.characteristics.map((entry) => {
      return entry.characteristic;
    }).sort();

    assert.deepEqual(chars, [
      'Irreflexive',
      'Transitive'
    ]);
  });

  void it('SimilarBook.b — Symmetric + Reflexive round-trips', () => {
    const propIri = 'urn:bookstore:SimilarBook#b';
    const quads: QuadInterface[] = [
      typeQuad(propIri, OWL_SYMMETRIC),
      typeQuad(propIri, OWL_REFLEXIVE)
    ];
    const ctx = makeCtx(new Set([propIri]), quads);
    const fragment = Characteristics.dispatch(quads, ctx);

    assert.strictEqual(fragment.characteristics.length, 2);
    const chars = fragment.characteristics.map((entry) => {
      return entry.characteristic;
    }).sort();

    assert.deepEqual(chars, [
      'Reflexive',
      'Symmetric'
    ]);
  });

  void it('Sequel.predecessor — Asymmetric round-trips', () => {
    const propIri = 'urn:bookstore:Sequel#predecessor';
    const quads: QuadInterface[] = [typeQuad(propIri, OWL_ASYMMETRIC)];
    const ctx = makeCtx(new Set([propIri]), quads);
    const fragment = Characteristics.dispatch(quads, ctx);

    assert.strictEqual(fragment.characteristics.length, 1);
    const sequelChar0 = fragment.characteristics.at(0);

    if (sequelChar0 === undefined) {
      throw new Error('expected characteristic at index 0');
    }
    assert.strictEqual(sequelChar0.characteristic, 'Asymmetric');
  });
});

// ---------------------------------------------------------------------------
// SchemaRegistry.addCharacteristic — bookstore property re-registration
// ---------------------------------------------------------------------------

void describe('SchemaRegistry.addCharacteristic — bookstore property re-registration', () => {
  void it('Review.customerId re-registered with functional:true', () => {
    const reg = registry();
    const classId = 'urn:bookstore:Review';

    reg.set({
      '$id': classId,
      'properties': { 'customerId': { '$ref': 'urn:bookstore:CustomerId' } },
      'type': 'object'
    });

    reg.addCharacteristic(`${classId}#customerId`, 'Functional');

    const patched = reg.get(classId);

    assert.ok(patched !== undefined);

    const reviewProperties = patched.properties as Record<string, unknown>;
    const customerId = reviewProperties.customerId as Record<string, unknown>;

    assert.strictEqual(customerId.functional, true);
  });

  void it('Customer.id re-registered with inverseFunctional:true', () => {
    const reg = registry();
    const classId = 'urn:bookstore:Customer';

    reg.set({
      '$id': classId,
      'properties': { 'id': { '$ref': 'urn:bookstore:CustomerId' } },
      'type': 'object'
    });

    reg.addCharacteristic(`${classId}#id`, 'InverseFunctional');

    const patched = reg.get(classId);

    assert.ok(patched !== undefined);

    const customerProperties = patched.properties as Record<string, unknown>;
    const idProp = customerProperties.id as Record<string, unknown>;

    assert.strictEqual(idProp.inverseFunctional, true);
  });
});
