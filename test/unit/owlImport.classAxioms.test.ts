/**
 * Unit tests for importClassAxioms — OWL 2 §9.1
 *
 * One assertion per axiom kind:
 *   - owl:Class declaration   → minimal stub { type: 'object', properties: {}, required: [] }
 *   - rdfs:subClassOf (one)   → allOf: [{ $ref: parent }]
 *   - rdfs:subClassOf (multi) → allOf: [{ $ref: P1 }, { $ref: P2 }]
 *   - owl:equivalentClass     → $ref: equivalentIri
 *   - owl:disjointWith        → disjointWith annotation (symmetric closure)
 *   - owl:disjointUnionOf     → oneOf: [{ $ref: C1 }, { $ref: C2 }]
 *   - owl:complementOf        → not: { $ref: C } + runtime invariant
 *
 * Inputs are synthetic minimal quads. The bookstore round-trip assertions live
 * in the integration scaffold (test/integration/owlRoundTripScaffold.test.ts).
 */

import assert from 'node:assert/strict';
import {
  describe, it
} from 'node:test';
import { ClassAxioms } from '../../src/modules/ontology/importDispatch/ClassAxioms.js';
import type { OwlImportContextType } from '../../src/types/OwlImport.js';
import type { QuadInterface } from '../../src/interfaces/QuadInterface.js';
import { SchemaGraph } from '../../src/modules/graph/SchemaGraph.js';
import { Curie } from '../../src/modules/quads/Curie.js';
import { STANDARD_PREFIXES } from '../../src/constants/STANDARD_PREFIXES.js';
import { Terms } from '../../src/modules/quads/Terms.js';
import { listQuad } from '../helpers/listQuad.js';

// ---------------------------------------------------------------------------
// Full IRI constants matching what jsonLdNodesToQuads produces after expansion
// ---------------------------------------------------------------------------

const RDF_TYPE = 'http://www.w3.org/1999/02/22-rdf-syntax-ns#type';
const OWL_CLASS = 'http://www.w3.org/2002/07/owl#Class';
const OWL_COMPLEMENT_OF = 'http://www.w3.org/2002/07/owl#complementOf';
const OWL_DISJOINT_UNION_OF = 'http://www.w3.org/2002/07/owl#disjointUnionOf';
const OWL_DISJOINT_WITH = 'http://www.w3.org/2002/07/owl#disjointWith';
const OWL_EQUIVALENT_CLASS = 'http://www.w3.org/2002/07/owl#equivalentClass';
const OWL_UNION_OF = 'http://www.w3.org/2002/07/owl#unionOf';
const RDFS_SUBCLASSOF = 'http://www.w3.org/2000/01/rdf-schema#subClassOf';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const CLASS_A = 'urn:example:A';
const CLASS_B = 'urn:example:B';
const CLASS_C = 'urn:example:C';

/** Produce a minimal type quad: `<subject> rdf:type owl:Class`. */
function typeQuad(subjectIri: string): QuadInterface {
  return Terms.quad(
    Terms.iri(subjectIri),
    Terms.iri(RDF_TYPE),
    Terms.iri(OWL_CLASS)
  );
}

/** Produce a quad with a NamedNode object. */
function namedQuad(subjectIri: string, predicateIri: string, objectIri: string): QuadInterface {
  return Terms.quad(
    Terms.iri(subjectIri),
    Terms.iri(predicateIri),
    Terms.iri(objectIri)
  );
}

/**
 * Build a minimal OwlImportContextType backed by the given quads.
 * Derives allClassIris by scanning rdf:type owl:Class quads.
 */
function makeCtx(quads: QuadInterface[]): OwlImportContextType {
  const allClassIris = new Set<string>();

  for (const quad of quads) {
    if (
      quad.predicate.value === RDF_TYPE
      && quad.object.termType === 'NamedNode'
      && quad.object.value === OWL_CLASS
      && quad.subject.termType === 'NamedNode'
    ) {
      allClassIris.add(quad.subject.value);
    }
  }

  const graph = SchemaGraph.fromQuads(quads, { 'baseIri': 'urn:example' });
  const curie = new Curie(STANDARD_PREFIXES);

  return {
    allClassIris,
    'allPropertyIris': new Set(),
    'baseIri': 'urn:example',
    curie,
    graph,
    'isDatatype': () => {
      return false;
    },
    'prefixes': STANDARD_PREFIXES,
    'reportUnsupported': () => {
      // no-op
    }
  };
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

void describe('importClassAxioms', () => {
  void describe('owl:Class declaration', () => {
    void it('produces a minimal object stub for each named class', () => {
      const quads = [typeQuad(CLASS_A)];
      const ctx = makeCtx(quads);
      const fragment = ClassAxioms.dispatch(quads, ctx);

      const delta = fragment.schemaDeltas.get(CLASS_A);

      assert.ok(delta !== undefined, 'delta for CLASS_A must exist');
      assert.equal(delta.type, 'object', 'type must be "object"');
      assert.deepEqual(delta.properties, {}, 'properties must be empty');
      assert.deepEqual(delta.required, [], 'required must be empty');
    });
  });

  void describe('rdfs:subClassOf — single parent', () => {
    void it('adds allOf: [{ $ref: parent }] on the child', () => {
      const quads = [
        typeQuad(CLASS_B),
        typeQuad(CLASS_A),
        namedQuad(CLASS_B, RDFS_SUBCLASSOF, CLASS_A)
      ];
      const ctx = makeCtx(quads);
      const fragment = ClassAxioms.dispatch(quads, ctx);

      const delta = fragment.schemaDeltas.get(CLASS_B);

      assert.ok(Array.isArray(delta?.allOf), 'allOf must be present');

      const allOf = delta.allOf as Array<Record<string, unknown>>;

      assert.equal(allOf.length, 1, 'exactly one allOf entry');
      const allOf0 = allOf.at(0);

      if (allOf0 === undefined) {
        throw new Error('expected allOf entry at index 0');
      }
      assert.equal(allOf0.$ref, CLASS_A, '$ref must point to parent CLASS_A');
    });
  });

  void describe('rdfs:subClassOf — multiple parents', () => {
    void it('accumulates allOf entries for each parent', () => {
      const quads = [
        typeQuad(CLASS_C),
        typeQuad(CLASS_A),
        typeQuad(CLASS_B),
        namedQuad(CLASS_C, RDFS_SUBCLASSOF, CLASS_A),
        namedQuad(CLASS_C, RDFS_SUBCLASSOF, CLASS_B)
      ];
      const ctx = makeCtx(quads);
      const fragment = ClassAxioms.dispatch(quads, ctx);

      const delta = fragment.schemaDeltas.get(CLASS_C);
      const allOf = delta?.allOf as Array<Record<string, unknown>> | undefined;

      assert.ok(Array.isArray(allOf), 'allOf must be present');
      assert.equal(allOf.length, 2, 'two allOf entries for two parents');

      const refs = new Set(allOf.map((entry) => {
        return entry.$ref;
      }));

      assert.ok(refs.has(CLASS_A), 'allOf must include CLASS_A');
      assert.ok(refs.has(CLASS_B), 'allOf must include CLASS_B');
    });
  });

  void describe('owl:equivalentClass', () => {
    void it('sets $ref pointing to the equivalent class IRI', () => {
      // Direct NamedNode equivalence (no bnode wrapper)
      const quads = [
        typeQuad(CLASS_B),
        typeQuad(CLASS_A),
        namedQuad(CLASS_B, OWL_EQUIVALENT_CLASS, CLASS_A)
      ];
      const ctx = makeCtx(quads);
      const fragment = ClassAxioms.dispatch(quads, ctx);

      const delta = fragment.schemaDeltas.get(CLASS_B);

      assert.equal(delta?.$ref, CLASS_A, '$ref must point to CLASS_A');
    });

    void it('extracts $ref from owl:unionOf bnode-wrapped equivalent (forward path format)', () => {
      // OwlProjection emits equivalentClass as a real anonymous bnode class
      // node whose owl:unionOf points to the equivalent IRI list:
      //   CLASS_B owl:equivalentClass _:b0 .
      //   _:b0 rdf:type owl:Class .
      //   _:b0 owl:unionOf ( CLASS_A ) .
      const equivBnode = 'b0';
      const RDF_TYPE_IRI = 'http://www.w3.org/1999/02/22-rdf-syntax-ns#type';

      const quads: QuadInterface[] = [
        typeQuad(CLASS_B),
        typeQuad(CLASS_A),
        Terms.quad(
          Terms.iri(CLASS_B),
          Terms.iri(OWL_EQUIVALENT_CLASS),
          Terms.blank(equivBnode),
          Terms.defaultGraph()
        ),
        Terms.quad(
          Terms.blank(equivBnode),
          Terms.iri(RDF_TYPE_IRI),
          Terms.iri(OWL_CLASS),
          Terms.defaultGraph()
        ),
        ...listQuad(
          Terms.blank(equivBnode),
          Terms.iri(OWL_UNION_OF),
          [Terms.iri(CLASS_A)]
        )
      ];
      const ctx = makeCtx(quads);
      const fragment = ClassAxioms.dispatch(quads, ctx);

      const delta = fragment.schemaDeltas.get(CLASS_B);

      assert.equal(delta?.$ref, CLASS_A, '$ref must equal CLASS_A extracted from unionOf wrapper');
    });
  });

  void describe('owl:disjointWith', () => {
    void it('sets disjointWith on the subject and emits symmetric closure on the other class', () => {
      const quads = [
        typeQuad(CLASS_A),
        typeQuad(CLASS_B),
        namedQuad(CLASS_A, OWL_DISJOINT_WITH, CLASS_B)
      ];
      const ctx = makeCtx(quads);
      const fragment = ClassAxioms.dispatch(quads, ctx);

      const deltaA = fragment.schemaDeltas.get(CLASS_A);
      const deltaB = fragment.schemaDeltas.get(CLASS_B);

      assert.equal(deltaA?.disjointWith, CLASS_B, 'CLASS_A.disjointWith must be CLASS_B');
      assert.equal(deltaB?.disjointWith, CLASS_A, 'CLASS_B.disjointWith must be CLASS_A (symmetric)');
    });
  });

  void describe('owl:disjointUnionOf', () => {
    void it('produces oneOf: [{ $ref: C1 }, { $ref: C2 }] for the union root', () => {
      const quads: QuadInterface[] = [
        typeQuad(CLASS_A),
        typeQuad(CLASS_B),
        typeQuad(CLASS_C),
        ...listQuad(
          Terms.iri(CLASS_A),
          Terms.iri(OWL_DISJOINT_UNION_OF),
          [
            Terms.iri(CLASS_B),
            Terms.iri(CLASS_C)
          ]
        )
      ];
      const ctx = makeCtx(quads);
      const fragment = ClassAxioms.dispatch(quads, ctx);

      const delta = fragment.schemaDeltas.get(CLASS_A);
      const oneOf = delta?.oneOf as Array<Record<string, unknown>> | undefined;

      assert.ok(Array.isArray(oneOf), 'oneOf must be present');
      assert.equal(oneOf.length, 2, 'two oneOf entries');

      const refs = new Set(oneOf.map((entry) => {
        return entry.$ref;
      }));

      assert.ok(refs.has(CLASS_B), 'oneOf must include CLASS_B');
      assert.ok(refs.has(CLASS_C), 'oneOf must include CLASS_C');
    });
  });

  void describe('owl:complementOf', () => {
    void it('sets not: { $ref: C } on the subject', () => {
      const quads = [
        typeQuad(CLASS_A),
        typeQuad(CLASS_B),
        namedQuad(CLASS_A, OWL_COMPLEMENT_OF, CLASS_B)
      ];
      const ctx = makeCtx(quads);
      const fragment = ClassAxioms.dispatch(quads, ctx);

      const delta = fragment.schemaDeltas.get(CLASS_A);
      const notSchema = delta?.not as Record<string, unknown> | undefined;

      assert.ok(notSchema !== undefined, 'not must be present');
      assert.equal(notSchema.$ref, CLASS_B, 'not.$ref must be CLASS_B');
    });

    void it('emits a runtime invariant carrying the complementOf signature', () => {
      const quads = [
        typeQuad(CLASS_A),
        typeQuad(CLASS_B),
        namedQuad(CLASS_A, OWL_COMPLEMENT_OF, CLASS_B)
      ];
      const ctx = makeCtx(quads);
      const fragment = ClassAxioms.dispatch(quads, ctx);

      const inv = fragment.invariants.find((entry) => {
        return entry.schemaId === CLASS_A;
      });

      assert.ok(inv !== undefined, 'invariant must be emitted for complementOf');
      assert.ok(inv.invariant.name.includes('complementOf'), 'invariant name must contain complementOf');
      assert.ok(inv.invariant.name.includes(CLASS_B), 'invariant name must include the complement target');

      // The invariant fn must return null (structural not keyword handles validation)
      const result = inv.invariant.fn({ 'someField': 'someValue' });

      assert.equal(result, null, 'invariant fn must return null (no violation)');
    });
  });

  void describe('empty arrays for non-class-axiom fragment fields', () => {
    void it('characteristics, sameAs, and individuals are always empty', () => {
      const quads = [typeQuad(CLASS_A)];
      const ctx = makeCtx(quads);
      const fragment = ClassAxioms.dispatch(quads, ctx);

      assert.deepEqual([...fragment.characteristics], [], 'characteristics must be empty');
      assert.deepEqual([...fragment.sameAs], [], 'sameAs must be empty');
      assert.deepEqual([...fragment.individuals], [], 'individuals must be empty');
    });
  });
});
