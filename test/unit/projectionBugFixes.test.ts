/**
 * Regression tests for three projection bug fixes:
 *
 *   Fix 1 — ShaclProjection: emitRestrictionPropertyShape collect-then-commit
 *     An invalid/unrecognised constraint value must not leave orphaned
 *     sh:PropertyShape bnodes in the shared quads array.
 *
 *   Fix 2 — ShaclProjection: emitNotTriggerBranch dead bnode removal
 *     The "trigger property absent" branch must produce only reachable bnodes.
 *     The previous implementation allocated innerBnode/complementBnode that
 *     were never wired into the return chain and never populated with quads.
 *
 *   Fix 3 — OwlProjection: emitClassRestrictionRelations invalid onProperty
 *     When predicateResolver is absent and meta.onProperty is absent/empty,
 *     emitRestriction must not receive '' as onProperty. Instead a GraphError
 *     with code INVALID_PREDICATE_IRI must be thrown.
 */

import assert from 'node:assert/strict';
import {
  describe, it
} from 'node:test';
import { SchemaGraph } from '../../src/modules/graph/SchemaGraph.js';
import { ShaclProjection } from '../../src/modules/rdf/ShaclProjection.js';
import { OwlProjection } from '../../src/modules/rdf/OwlProjection.js';
import { GraphError } from '../../src/errors/GraphError.js';
import { Compose } from '../../src/index.js';
import {
  OWL, RDF, SH
} from '../../src/constants/IRI.js';
import type { QuadInterface } from '../../src/interfaces/QuadInterface.js';
import type { SchemaGraphInterface } from '../../src/interfaces/SchemaGraphInterface.js';
import type { SchemaGraphRelationType } from '../../src/types/SchemaGraph.js';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function filterByPredicate(quads: QuadInterface[], predicate: string): QuadInterface[] {
  return quads.filter((quad) => {
    return quad.predicate.value === predicate;
  });
}

/** Return all bnode ids that appear as a subject in the quad set. */
function bnodeSubjects(quads: QuadInterface[]): Set<string> {
  const ids = new Set<string>();

  for (const quad of quads) {
    if (quad.subject.termType === 'BlankNode') {
      ids.add(quad.subject.value);
    }
  }

  return ids;
}

/** Return all bnode ids that appear as an object in the quad set. */
function bnodeObjects(quads: QuadInterface[]): Set<string> {
  const ids = new Set<string>();

  for (const quad of quads) {
    if (quad.object.termType === 'BlankNode') {
      ids.add(quad.object.value);
    }
  }

  return ids;
}

// ---------------------------------------------------------------------------
// Fix 1: emitRestrictionPropertyShape — collect-then-commit
// ---------------------------------------------------------------------------

void describe('Fix 1 — ShaclProjection: no orphaned sh:PropertyShape on abort', { 'concurrency': true }, () => {
  void it('abort path (NaN cardinality value) produces zero sh:PropertyShape quads', () => {
    // Construct a raw schema with a jt:restrictions entry whose value is NaN.
    // SchemaGraph.extractRestrictions will parse it (kind/onProperty present, value present)
    // but finiteNumber(NaN) === undefined, which triggers the abort return in
    // emitRestrictionPropertyShape. Pre-fix: 2 orphaned quads (type + path) were appended
    // before the guard; post-fix: collect-then-commit emits nothing on abort.
    const schema: Record<string, unknown> = {
      '$id': 'urn:example:Orphan',
      'jt:restrictions': [{
        'kind': 'minCardinality',
        'onProperty': 'urn:example:Orphan#count',
        'value': Number.NaN
      }],
      'type': 'object'
    };

    const quads = ShaclProjection.graph(new SchemaGraph(schema));

    // No sh:PropertyShape quads should appear (none emitted by property shapes either
    // since this schema has no declared properties).
    const psQuads = filterByPredicate(quads, RDF.type).filter((quad) => {
      return quad.object.termType === 'NamedNode' && quad.object.value === SH.PropertyShape;
    });

    assert.equal(
      psQuads.length,
      0,
      `abort path must emit zero sh:PropertyShape quads; got ${psQuads.length.toString()}`
    );
  });

  void it('abort path (allValuesFrom with empty string value) produces zero sh:PropertyShape quads', () => {
    // Construct a raw schema with an allValuesFrom restriction whose value is ''.
    // emitRestrictionPropertyShape checks: value !== '' for allValuesFrom; fails → abort.
    const schema: Record<string, unknown> = {
      '$id': 'urn:example:OrphanAllValues',
      'jt:restrictions': [{
        'kind': 'allValuesFrom',
        'onProperty': 'urn:example:OrphanAllValues#tag',
        'value': ''
      }],
      'type': 'object'
    };

    const quads = ShaclProjection.graph(new SchemaGraph(schema));

    const psQuads = filterByPredicate(quads, RDF.type).filter((quad) => {
      return quad.object.termType === 'NamedNode' && quad.object.value === SH.PropertyShape;
    });

    assert.equal(
      psQuads.length,
      0,
      `allValuesFrom with empty string value must emit zero sh:PropertyShape quads; got ${psQuads.length.toString()}`
    );
  });

  void it('success path (valid minCardinality restriction) emits at least one sh:PropertyShape', () => {
    // Sanity-check that the collect-then-commit path still emits on success.
    const schema = Compose.subClassOf(
      Compose.minCardinality('urn:example:Doc#title', 1),
      {
        '$id': 'urn:example:Doc',
        'properties': { 'title': { 'type': 'string' } },
        'type': 'object'
      }
    ) as Record<string, unknown>;

    const quads = ShaclProjection.graph(new SchemaGraph(schema));

    // The restriction emits a PropertyShape on urn:example:Doc#title.
    const pathQuads = filterByPredicate(quads, SH.path).filter((quad) => {
      return quad.object.termType === 'NamedNode'
        && quad.object.value === 'urn:example:Doc#title';
    });

    assert.ok(
      pathQuads.length > 0,
      'valid minCardinality restriction must emit at least one sh:path quad for the property'
    );
  });
});

// ---------------------------------------------------------------------------
// Fix 2: emitNotTriggerBranch — dead bnode removal
// ---------------------------------------------------------------------------

void describe('Fix 2 — ShaclProjection: emitNotTriggerBranch emits only reachable bnodes', { 'concurrency': true }, () => {
  void it('dependentRequired schema produces no unreachable bnodes', () => {
    // A schema with dependentRequired triggers emitNotTriggerBranch inside
    // emitDependentRequired. Pre-fix: two extra bnodes (innerBnode, complementBnode)
    // were allocated and one (complementBnode) was pushed with sh:not → innerBnode,
    // but neither appeared in the return chain or as an object referenced by a
    // reachable quad. Post-fix: those two bnodes are absent.
    const schema: Record<string, unknown> = {
      '$id': 'urn:example:Order',
      'dependentRequired': { 'creditCard': ['billingAddress'] },
      'properties': {
        'billingAddress': { 'type': 'string' },
        'creditCard': { 'type': 'string' }
      },
      'type': 'object'
    };

    const quads = ShaclProjection.graph(new SchemaGraph(schema));

    // Every bnode that appears as a subject must also appear as an object somewhere
    // (i.e., it is reachable from a named-node subject or from a reachable bnode).
    // We check the weaker invariant: every bnode subject must be referenced as an object.
    const subjects = bnodeSubjects(quads);
    const objects = bnodeObjects(quads);

    for (const id of subjects) {
      assert.ok(
        objects.has(id),
        `bnode _:${id} appears as a subject but is never referenced as an object — orphaned bnode`
      );
    }
  });

  void it('dependentRequired quads do not contain a sh:not → un-populated bnode pattern', () => {
    // More targeted: the dead complementBnode → sh:not → innerBnode triple meant
    // there was a bnode A such that (A, sh:not, _:B) but _:B had no quads with it
    // as subject. Post-fix this pattern must not exist.
    const schema: Record<string, unknown> = {
      '$id': 'urn:example:Order2',
      'dependentRequired': { 'creditCard': ['billingAddress'] },
      'properties': {
        'billingAddress': { 'type': 'string' },
        'creditCard': { 'type': 'string' }
      },
      'type': 'object'
    };

    const quads = ShaclProjection.graph(new SchemaGraph(schema));
    const subjects = bnodeSubjects(quads);
    const shaclNotQuads = filterByPredicate(quads, SH.not);

    for (const notQuad of shaclNotQuads) {
      if (notQuad.object.termType !== 'BlankNode') {
        continue;
      }

      const targetId = notQuad.object.value;

      // The target bnode must itself appear as a subject (has outgoing quads).
      assert.ok(
        subjects.has(targetId),
        `sh:not target _:${targetId} has no outgoing quads — empty dangling bnode`
      );
    }
  });
});

// ---------------------------------------------------------------------------
// Fix 3: OwlProjection — missing onProperty throws GraphError
// ---------------------------------------------------------------------------

void describe('Fix 3 — OwlProjection: missing onProperty throws INVALID_PREDICATE_IRI', { 'concurrency': true }, () => {
  void it('throws GraphError with INVALID_PREDICATE_IRI when OWL.Restriction has no onProperty', () => {
    // We need to inject a relation with predicate OWL.Restriction and metadata that
    // has no onProperty (and no propertyName), while the entry has OWL.Class type.
    // We do this by wrapping a real SchemaGraph and overriding allRelations() to
    // inject one extra relation.
    const baseSchema = {
      '$id': 'urn:example:RestrictedClass',
      'properties': { 'name': { 'type': 'string' } },
      'required': ['name'],
      'type': 'object'
    };

    const realGraph = new SchemaGraph(baseSchema);

    // Build the injected relation with OWL.Restriction predicate, OWL.Class type,
    // and metadata that is missing both propertyName and onProperty.
    const rootNode = realGraph.rootNode;
    const injectedRelation: SchemaGraphRelationType = {
      'metadata': {
        // no onProperty, no propertyName — triggers the throw in emitClassRestrictionRelations
        'minCardinality': 1
      },
      'predicate': OWL.Restriction,
      'source': rootNode,
      'target': rootNode
    };

    const wrappedGraph: SchemaGraphInterface = {
      allRelations(): SchemaGraphRelationType[] {
        return [
          ...realGraph.allRelations(),
          injectedRelation
        ];
      },
      child(node, key) {
        return realGraph.child(node, key);
      },
      collectList(head) {
        return realGraph.collectList(head);
      },
      domainOf(node) {
        return realGraph.domainOf(node);
      },
      embeddedNode(id) {
        return realGraph.embeddedNode(id);
      },
      embeddedSchemaIds() {
        return realGraph.embeddedSchemaIds();
      },
      entries(node, key) {
        return realGraph.entries(node, key);
      },
      getNormIR() {
        return realGraph.getNormIR();
      },
      indexedChildren(node, key) {
        return realGraph.indexedChildren(node, key);
      },
      keywordValue(node, key) {
        return realGraph.keywordValue(node, key);
      },
      node(nodeSchema) {
        return realGraph.node(nodeSchema);
      },
      nodes() {
        return realGraph.nodes();
      },
      relations(node) {
        return realGraph.relations(node);
      },
      relationsForSubject(subjectIri) {
        return realGraph.relationsForSubject(subjectIri);
      },
      resolveFragment(fragment) {
        return realGraph.resolveFragment(fragment);
      },
      resolvePointer(pointer) {
        return realGraph.resolvePointer(pointer);
      },
      resolveRefId(ref) {
        return realGraph.resolveRefId(ref);
      },
      'rootNode': realGraph.rootNode,
      'rootSchema': realGraph.rootSchema,
      semantics(node) {
        return realGraph.semantics(node);
      },
      validateStructure() {
        return realGraph.validateStructure();
      }
    };

    assert.throws(
      () => {
        OwlProjection.graph(wrappedGraph);
      },
      (err: unknown) => {
        assert.ok(err instanceof GraphError, `expected GraphError, got: ${String(err)}`);
        assert.equal(
          err.code,
          'INVALID_PREDICATE_IRI',
          `expected INVALID_PREDICATE_IRI, got: ${err.code}`
        );

        return true;
      }
    );
  });

  void it('does NOT throw when predicateResolver resolves the property IRI', () => {
    // Sanity-check: with a valid schema, a predicateResolver should work without error.
    const schema = {
      '$id': 'urn:example:WithResolver',
      'properties': { 'name': { 'type': 'string' } },
      'required': ['name'],
      'type': 'object'
    };

    assert.doesNotThrow(() => {
      OwlProjection.graph(new SchemaGraph(schema), {
        'predicateResolver': ({
          classId, propertyName
        }) => {
          return `${classId}#${propertyName}`;
        }
      });
    });
  });
});
