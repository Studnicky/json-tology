/**
 * Unit tests for the per-instance invariant fn bodies produced by
 * importIndividuals for OWL constraints:
 *   - owl:NegativePropertyAssertion (class-keyed, identity-guarded)
 *   - owl:hasKey (per-object key well-formedness; array-uniqueness is a
 *     collection-level concern surfaced via the jt:hasKey annotation)
 *
 * owl:differentFrom no longer produces invariants — it flows through
 * result.differentFrom pairs. See owlImport.individuals.test.ts for those.
 *
 * Each invariant is extracted from a real importIndividuals call (using
 * inline quad fixtures) and its fn is exercised directly.
 */

import assert from 'node:assert/strict';
import {
  describe, it
} from 'node:test';
import type { QuadInterface } from '../../src/interfaces/QuadInterface.js';
import type { OwlImportContextInterface } from '../../src/interfaces/OwlImportContextInterface.js';
import type { OwlImportFragmentInterface } from '../../src/interfaces/OwlImportFragmentInterface.js';
import type { InvariantType } from '../../src/types/Invariant.js';
import { Individuals } from '../../src/modules/ontology/importDispatch/Individuals.js';
import { Terms } from '../../src/modules/quads/Terms.js';
import { SchemaGraph } from '../../src/modules/graph/SchemaGraph.js';
import { listQuad } from '../helpers/listQuad.js';

// ---------------------------------------------------------------------------
// Quad construction helpers
// ---------------------------------------------------------------------------

const RDF_TYPE = 'http://www.w3.org/1999/02/22-rdf-syntax-ns#type';
const OWL_NS = 'http://www.w3.org/2002/07/owl#';

function makeIriQuad(subject: string, predicate: string, object: string): QuadInterface {
  return Terms.quad(Terms.iri(subject), Terms.iri(predicate), Terms.iri(object));
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
// importIndividuals runner (real graph-backed context)
// ---------------------------------------------------------------------------

function runIndividuals(
  quads: QuadInterface[],
  allClassIris: string[] = [],
  allPropertyIris: string[] = []
): OwlImportFragmentInterface {
  const ctx: OwlImportContextInterface = {
    'allClassIris': new Set<string>(allClassIris),
    'allPropertyIris': new Set<string>(allPropertyIris),
    'baseIri': 'urn:test',
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
    'graph': SchemaGraph.fromQuads(quads, { 'baseIri': 'urn:test' }),
    'isDatatype': () => {
      return false;
    },
    'prefixes': {},
    'reportUnsupported': () => { /* no-op */ }
  };

  return Individuals.dispatch(quads, ctx);
}

/**
 * Extract the first invariant from the fragment whose name includes `tag`.
 */
function findInvariant(fragment: OwlImportFragmentInterface, tag: string): InvariantType {
  const entry = fragment.invariants.find((inv) => {
    return inv.invariant.name.includes(tag);
  });

  assert.ok(entry, `invariant containing "${tag}" not found`);

  return entry.invariant;
}

// ---------------------------------------------------------------------------
// owl:NegativePropertyAssertion — fn enforcement
// ---------------------------------------------------------------------------

void describe('negativePropertyAssertionInvariant fn', () => {
  const classIri = 'urn:test:Person';
  const sourceIri = 'urn:test:alice';
  const propIri = 'urn:test:age';
  const forbiddenValue = 99;

  function getInvariant(): InvariantType {
    const quads: QuadInterface[] = [
      // Individual declaration with class type — required for NPA to emit invariant
      Terms.quad(Terms.iri(sourceIri), Terms.iri(RDF_TYPE), Terms.iri(`${OWL_NS}NamedIndividual`)),
      Terms.quad(Terms.iri(sourceIri), Terms.iri(RDF_TYPE), Terms.iri(classIri)),
      // NPA blank-node pattern
      Terms.quad(Terms.blank('npa1'), Terms.iri(RDF_TYPE), Terms.iri(`${OWL_NS}NegativePropertyAssertion`)),
      Terms.quad(Terms.blank('npa1'), Terms.iri(`${OWL_NS}sourceIndividual`), Terms.iri(sourceIri)),
      Terms.quad(Terms.blank('npa1'), Terms.iri(`${OWL_NS}assertionProperty`), Terms.iri(propIri)),
      Terms.quad(Terms.blank('npa1'), Terms.iri(`${OWL_NS}targetValue`), Terms.literal(forbiddenValue))
    ];
    const fragment = runIndividuals(quads, [classIri], []);

    return findInvariant(fragment, 'negativePropertyAssertion');
  }

  void it('invariant is keyed to class IRI, not individual IRI', () => {
    const quads: QuadInterface[] = [
      Terms.quad(Terms.iri(sourceIri), Terms.iri(RDF_TYPE), Terms.iri(`${OWL_NS}NamedIndividual`)),
      Terms.quad(Terms.iri(sourceIri), Terms.iri(RDF_TYPE), Terms.iri(classIri)),
      Terms.quad(Terms.blank('npa1'), Terms.iri(RDF_TYPE), Terms.iri(`${OWL_NS}NegativePropertyAssertion`)),
      Terms.quad(Terms.blank('npa1'), Terms.iri(`${OWL_NS}sourceIndividual`), Terms.iri(sourceIri)),
      Terms.quad(Terms.blank('npa1'), Terms.iri(`${OWL_NS}assertionProperty`), Terms.iri(propIri)),
      Terms.quad(Terms.blank('npa1'), Terms.iri(`${OWL_NS}targetValue`), Terms.literal(forbiddenValue))
    ];
    const fragment = runIndividuals(quads, [classIri], []);

    assert.equal(fragment.invariants.length, 1);
    const inv0 = fragment.invariants.at(0);

    if (inv0 === undefined) {
      throw new Error('expected invariants[0] to exist');
    }
    assert.equal(inv0.schemaId, classIri, 'invariant is keyed to class IRI');
  });

  void it('returns an error string when value carries sourceIri identity and the forbidden property value matches', () => {
    const fn = getInvariant().fn;
    // Identity guard: value must carry '$id': sourceIri to fire
    const result = fn({
      '$id': sourceIri,
      [propIri]: forbiddenValue
    });

    assert.equal(typeof result, 'string', 'should return error string');
    assert.ok((result as string).length > 0, 'error string is non-empty');
    assert.ok((result as string).includes(sourceIri), 'error names sourceIri');
    assert.ok((result as string).includes(propIri), 'error names property IRI');
  });

  void it('returns an error string when sourceIri identity matches and forbidden value appears in a property array', () => {
    const fn = getInvariant().fn;
    const result = fn({
      '$id': sourceIri,
      [propIri]: [
        50,
        forbiddenValue,
        100
      ]
    });

    assert.equal(typeof result, 'string', 'array containing forbidden value should fail');
  });

  void it('returns null (identity guard) when value has a different $id (different individual)', () => {
    const fn = getInvariant().fn;
    const result = fn({
      '$id': 'urn:test:bob',
      [propIri]: forbiddenValue
    });

    assert.equal(result, null, 'different individual identity should pass due to identity guard');
  });

  void it('returns null (identity guard) when value has no $id or @id', () => {
    const fn = getInvariant().fn;
    const result = fn({ [propIri]: forbiddenValue });

    assert.equal(result, null, 'missing $id should pass due to identity guard (id !== sourceIri)');
  });

  void it('returns null when the property has a different value (matching $id)', () => {
    const fn = getInvariant().fn;
    const result = fn({
      '$id': sourceIri,
      [propIri]: 42
    });

    assert.equal(result, null, 'different value should pass');
  });

  void it('returns null when the property is absent (matching $id)', () => {
    const fn = getInvariant().fn;
    const result = fn({
      '$id': sourceIri,
      'name': 'Alice'
    });

    assert.equal(result, null, 'missing property should pass');
  });

  void it('returns null when value is not a record', () => {
    const fn = getInvariant().fn;

    assert.equal(fn(null), null, 'null should pass');
    assert.equal(fn('string'), null, 'string should pass');
    assert.equal(fn([forbiddenValue]), null, 'bare array should pass');
  });
});

// ---------------------------------------------------------------------------
// owl:NegativePropertyAssertion — fn enforcement (object/IRI target)
// ---------------------------------------------------------------------------

void describe('negativePropertyAssertionInvariant fn — object target', () => {
  const classIri = 'urn:test:Person';
  const sourceIri = 'urn:test:alice';
  const propIri = 'urn:test:knows';
  const targetIri = 'urn:test:bob';

  function getInvariant(): InvariantType {
    const quads: QuadInterface[] = [
      Terms.quad(Terms.iri(sourceIri), Terms.iri(RDF_TYPE), Terms.iri(`${OWL_NS}NamedIndividual`)),
      Terms.quad(Terms.iri(sourceIri), Terms.iri(RDF_TYPE), Terms.iri(classIri)),
      Terms.quad(Terms.blank('npa2'), Terms.iri(RDF_TYPE), Terms.iri(`${OWL_NS}NegativePropertyAssertion`)),
      Terms.quad(Terms.blank('npa2'), Terms.iri(`${OWL_NS}sourceIndividual`), Terms.iri(sourceIri)),
      Terms.quad(Terms.blank('npa2'), Terms.iri(`${OWL_NS}assertionProperty`), Terms.iri(propIri)),
      Terms.quad(Terms.blank('npa2'), Terms.iri(`${OWL_NS}targetIndividual`), Terms.iri(targetIri))
    ];
    const fragment = runIndividuals(quads, [classIri], []);

    return findInvariant(fragment, 'negativePropertyAssertion');
  }

  void it('returns an error string when the property holds the forbidden IRI (matching $id)', () => {
    const fn = getInvariant().fn;
    const result = fn({
      '$id': sourceIri,
      [propIri]: targetIri
    });

    assert.equal(typeof result, 'string', 'should return error string');
  });

  void it('returns null when the property holds a different IRI (matching $id)', () => {
    const fn = getInvariant().fn;
    const result = fn({
      '$id': sourceIri,
      [propIri]: 'urn:test:carol'
    });

    assert.equal(result, null, 'different IRI should pass');
  });

  void it('returns null (identity guard) for different individual even with forbidden value', () => {
    const fn = getInvariant().fn;
    const result = fn({
      '$id': 'urn:test:bob',
      [propIri]: targetIri
    });

    assert.equal(result, null, 'different individual should pass due to identity guard');
  });
});

// ---------------------------------------------------------------------------
// owl:hasKey — fn enforcement (well-formedness only, no array-uniqueness)
// ---------------------------------------------------------------------------

void describe('hasKeyInvariant fn — single object (well-formedness check)', () => {
  const classIri = 'urn:test:Person';
  const prop1 = 'urn:test:firstName';
  const prop2 = 'urn:test:lastName';

  function getInvariant(): InvariantType {
    const fragment = runIndividuals(makeListQuad(classIri, `${OWL_NS}hasKey`, [
      prop1,
      prop2
    ]));

    return findInvariant(fragment, 'hasKey');
  }

  void it('returns an error string when a key property is an array (ill-formed key)', () => {
    const fn = getInvariant().fn;
    const result = fn({
      [prop1]: [
        'Alice',
        'Alicia'
      ],
      [prop2]: 'Smith'
    });

    assert.equal(typeof result, 'string', 'array-valued key property should fail');
    assert.ok((result as string).includes(prop1), 'error names the ill-formed property');
  });

  void it('returns an error string when a key property is an object (ill-formed key)', () => {
    const fn = getInvariant().fn;
    const result = fn({
      [prop1]: { 'nested': true },
      [prop2]: 'Smith'
    });

    assert.equal(typeof result, 'string', 'object-valued key property should fail');
  });

  void it('returns null when all key properties are scalar', () => {
    const fn = getInvariant().fn;

    assert.equal(fn({
      [prop1]: 'Alice',
      [prop2]: 'Smith'
    }), null, 'scalar keys should pass');
    assert.equal(fn({
      [prop1]: 42,
      [prop2]: true
    }), null, 'numeric and boolean keys should pass');
  });

  void it('returns null when key properties are absent on a single object', () => {
    const fn = getInvariant().fn;

    assert.equal(fn({ 'unrelated': 'value' }), null, 'absent keys are fine for single object');
  });
});

void describe('hasKeyInvariant fn — array input (collection-level uniqueness not enforced here)', () => {
  const classIri = 'urn:test:Person';
  const prop1 = 'urn:test:firstName';
  const prop2 = 'urn:test:lastName';

  function getInvariant(): InvariantType {
    const fragment = runIndividuals(makeListQuad(classIri, `${OWL_NS}hasKey`, [
      prop1,
      prop2
    ]));

    return findInvariant(fragment, 'hasKey');
  }

  void it('returns null for an array input (uniqueness is a collection-level concern, not per-object)', () => {
    const fn = getInvariant().fn;
    // Arrays are not records — per-object well-formedness does not apply here.
    // Cross-instance uniqueness is surfaced via the jt:hasKey annotation.
    const duplicateArray = [
      {
        [prop1]: 'Alice',
        [prop2]: 'Smith'
      },
      {
        [prop1]: 'Alice',
        [prop2]: 'Smith'
      }
    ];
    const result = fn(duplicateArray);

    assert.equal(result, null, 'array input returns null — uniqueness check is collection-level via jt:hasKey annotation');
  });

  void it('returns null for an empty array', () => {
    const fn = getInvariant().fn;

    assert.equal(fn([]), null, 'empty array should pass');
  });
});

function makeNonRecordHasKeyInvariant(): InvariantType {
  const classIri = 'urn:test:Foo';
  const propIri = 'urn:test:p1';
  const fragment = runIndividuals(makeListQuad(classIri, `${OWL_NS}hasKey`, [propIri]));

  return findInvariant(fragment, 'hasKey');
}

void describe('hasKeyInvariant fn — non-record/non-array value', () => {
  void it('returns null for null', () => {
    assert.equal(makeNonRecordHasKeyInvariant().fn(null), null);
  });

  void it('returns null for a string', () => {
    assert.equal(makeNonRecordHasKeyInvariant().fn('hello'), null);
  });

  void it('returns null for a number', () => {
    assert.equal(makeNonRecordHasKeyInvariant().fn(99), null);
  });
});

// ---------------------------------------------------------------------------
// owl:differentFrom — no longer produces invariants
// ---------------------------------------------------------------------------

void describe('importIndividuals — differentFrom produces pairs, not invariants', () => {
  void it('produces a differentFrom pair (not an invariant) for owl:differentFrom', () => {
    const iriA = 'urn:test:alice';
    const iriB = 'urn:test:bob';

    const fragment = runIndividuals([makeIriQuad(iriA, `${OWL_NS}differentFrom`, iriB)]);

    assert.equal(fragment.invariants.length, 0, 'differentFrom must NOT produce invariants');
    assert.equal(fragment.differentFrom.length, 1, 'differentFrom must produce one pair');
    const pair = fragment.differentFrom.at(0);

    assert.ok(pair, 'pair present');
    assert.ok((pair[0] === iriA && pair[1] === iriB) || (pair[0] === iriB && pair[1] === iriA), 'pair contains both IRIs');
  });
});
