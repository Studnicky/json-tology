/**
 * ClassAxioms dispatcher — OWL 2 §9.1 Class Expression Axioms
 *
 * Responsible for:
 *   owl:Class declaration    — produces a minimal schema stub for each named class
 *   rdfs:subClassOf          — subclass relationships between named classes → allOf: [{ $ref }]
 *   owl:equivalentClass      — structural equivalences → $ref wire shape
 *   owl:disjointWith         — mutual disjointness → disjointWith annotation (symmetric)
 *   owl:complementOf         — complement of a class → not: { $ref } + runtime invariant
 *   owl:disjointUnionOf      — disjoint union → oneOf + registry-level constraint
 *
 * Bucket strategy: structural — each axiom maps to a `schemaDeltas` patch on the
 * subject class (`allOf`/`not`/`disjointWith`/`$ref` additions).
 *
 * Symmetric axioms: `disjointWith` is symmetric in OWL 2 — both directions are
 * emitted in the fragment so the resulting schemas are pairwise consistent.
 *
 * Graph-native traversal: all arms read from the graph.
 * - Named-IRI arms (subClassOf NamedNode, complementOf NamedNode, etc.) walk
 *   `ctx.graph.allRelations()`.
 * - The `owl:equivalentClass [ owl:unionOf (…) ]` blank-node wrapper is
 *   resolved through `ctx.graph.relationsForSubject(bnode)` to find the
 *   union edge, then `ctx.graph.collectList` on the union's list head.
 * - The legacy `owl:equivalentClass = <JSON-LD wrapper literal>` encoding
 *   reads `relation.termType === 'Literal'` and parses the embedded list.
 * - `owl:disjointUnionOf` lists are walked via `ctx.graph.collectList`.
 */

import type { QuadInterface } from '../../../interfaces/QuadInterface.js';
import type {
  OwlImportContextType, OwlImportFragmentType
} from '../../../types/OwlImport.js';
import type { JsonSchemaDocumentObjectType } from '../../../types/Schema.js';
import type { InvariantType } from '../../../types/Invariant.js';
import type { SchemaGraphRelationType } from '../../../types/SchemaGraph.js';
import type { SchemaGraphInterface } from '../../../interfaces/SchemaGraphInterface.js';
import type { AxiomContextType } from '../../../types/AxiomContextType.js';
import type { ApplyRelationOptionsType } from '../../../types/ApplyRelationOptionsType.js';
import type { ApplyBnodeLiteralOptionsType } from '../../../types/ApplyBnodeLiteralOptionsType.js';
import {
  OWL, RDF, RDFS
} from '../../../constants/IRI.js';
import {
  CLASS_TYPE_IRIS,
  COMPLEMENT_OF_PREDICATES,
  DISJOINT_UNION_OF_IRIS,
  DISJOINT_WITH_PREDICATES,
  EQUIVALENT_CLASS_PREDICATES,
  UNION_OF_IRIS
} from '../../../constants/ONTOLOGY_PREDICATES.js';
import { ImportRelation } from './ImportRelation.js';

/**
 * Parse the legacy `owl:equivalentClass = <JSON-LD wrapper literal>` form.
 * Some forward projections serialise the equivalentClass union as a single
 * Literal whose lexical string is JSON-encoded:
 *   `{ "@type": "owl:Class", "owl:unionOf": { "@list": [{ "@id": "..." }, ...] } }`
 * The quad-backed graph surfaces this as a Literal-typed relation whose
 * `target` carries the lexical string. We parse it once here and return
 * the embedded `@id` IRIs.
 */
function parseUnionLiteralWrapper(lexical: string): string[] {
  let parsed: unknown;

  try {
    parsed = JSON.parse(lexical);
  } catch {
    return [];
  }

  if (typeof parsed !== 'object' || parsed === null) {
    return [];
  }

  const wrapper = parsed as Record<string, unknown>;
  const unionOf = wrapper[OWL.unionOf];

  if (typeof unionOf !== 'object' || unionOf === null) {
    return [];
  }

  const list = (unionOf as Record<string, unknown>)['@list'];

  if (!Array.isArray(list)) {
    return [];
  }

  return extractIdsFromList(list);
}

/** Extract `@id` string values from a JSON-LD `@list` array. */
function extractIdsFromList(list: unknown[]): string[] {
  const members: string[] = [];

  for (const item of list) {
    if (typeof item === 'object' && item !== null) {
      const id = (item as Record<string, unknown>)['@id'];

      if (typeof id === 'string') {
        members.push(id);
      }
    }
  }

  return members;
}

/**
 * Walk the bnode's `owl:unionOf` list via the graph's RDF list helper and
 * return the NamedNode IRIs of each member.
 */
function extractEquivalentMembersFromGraph(
  bnodeId: string,
  graph: SchemaGraphInterface
): string[] {
  const unionRelations = graph.relationsForSubject(bnodeId).filter((rel: SchemaGraphRelationType): boolean => {
    return UNION_OF_IRIS.has(rel.predicate);
  });

  if (unionRelations.length === 0) {
    return [];
  }

  const firstUnionRelation = unionRelations[0];

  if (firstUnionRelation === undefined) {
    return [];
  }

  const listHead = ImportRelation.targetValue(firstUnionRelation);
  const members: string[] = [];

  for (const item of graph.collectList(listHead)) {
    if (item.termType === 'NamedNode') {
      members.push(item.target);
    }
  }

  return members;
}

/**
 * Merge an allOf `{ $ref: refIri }` entry into the delta for `classIri`.
 * Accumulates refs without duplicating. Skips blank nodes and internal
 * fragment subjects (e.g. `urn:bookstore:EBook#/allOf/1`).
 */
function mergeAllOfRef(
  deltas: Map<string, Partial<JsonSchemaDocumentObjectType>>,
  classIri: string,
  refIri: string
): void {
  if (refIri.startsWith('_:') || refIri.includes('#/')) {
    return;
  }

  const existing = deltas.get(classIri) ?? {};
  const existingAllOf = Array.isArray(existing.allOf)
    ? (existing.allOf as Array<Partial<JsonSchemaDocumentObjectType>>)
    : [];

  const alreadyPresent = existingAllOf.some((entry: Partial<JsonSchemaDocumentObjectType>): boolean => {
    return (entry as Record<string, unknown>).$ref === refIri;
  });

  if (alreadyPresent) {
    return;
  }

  const newAllOf = [
    ...existingAllOf,
    { '$ref': refIri }
  ] as readonly JsonSchemaDocumentObjectType[];

  deltas.set(classIri, {
    ...existing,
    'allOf': newAllOf
  });
}

// ---------------------------------------------------------------------------
// Named-class stub emission
// ---------------------------------------------------------------------------

/**
 * Pass 1: emit a minimal `{ type: 'object', properties: {}, required: [] }`
 * stub for every named owl:Class or rdfs:Class found in the graph.
 */
function emitClassStubs(
  ctx: OwlImportContextType,
  schemaDeltas: Map<string, Partial<JsonSchemaDocumentObjectType>>
): void {
  for (const relation of ctx.graph.allRelations()) {
    if (relation.predicate !== RDF.type) {
      continue;
    }
    if (typeof relation.target !== 'string') {
      continue;
    }
    if (!CLASS_TYPE_IRIS.has(relation.target)) {
      continue;
    }

    const classIri = relation.source.id;

    if (!schemaDeltas.has(classIri)) {
      schemaDeltas.set(classIri, {
        'properties': {},
        'required': [],
        'type': 'object'
      });
    }
  }
}

// ---------------------------------------------------------------------------
// Axiom arm helpers
// ---------------------------------------------------------------------------

/**
 * Apply `rdfs:subClassOf` NamedNode target → `allOf: [{ $ref }]` on the subject.
 */
function applySubClassOf(options: ApplyRelationOptionsType): void {
  const {
    axiomCtx, relation, subjectIri
  } = options;

  if (relation.structure?.kind === 'restriction') {
    return;
  }

  const targetIri = axiomCtx.resolveIri(relation.target);

  if (targetIri.startsWith('_:')) {
    return;
  }

  mergeAllOfRef(axiomCtx.schemaDeltas, subjectIri, targetIri);
}

/**
 * Apply `owl:complementOf` NamedNode target → `not: { $ref }` + invariant.
 */
function applyComplementOf(options: ApplyRelationOptionsType): void {
  const {
    axiomCtx, relation, subjectIri
  } = options;
  const targetIri = axiomCtx.resolveIri(relation.target);

  if (targetIri.startsWith('_:')) {
    return;
  }

  const existing = axiomCtx.schemaDeltas.get(subjectIri) ?? {};

  axiomCtx.schemaDeltas.set(subjectIri, {
    ...existing,
    'not': { '$ref': targetIri }
  });

  const inv: InvariantType = {
    'fn': (_: unknown): null => {
      return null;
    },
    'name': `complementOf:${subjectIri}:not:${targetIri}`,
    'pointer': ''
  };

  axiomCtx.invariants.push({
    'invariant': inv,
    'schemaId': subjectIri
  });
}

/**
 * Apply `owl:disjointWith` NamedNode target → symmetric disjointWith annotation.
 */
function applyDisjointWith(options: ApplyRelationOptionsType): void {
  const {
    axiomCtx, relation, subjectIri
  } = options;
  const otherIri = axiomCtx.resolveIri(relation.target);

  if (otherIri.startsWith('_:')) {
    return;
  }

  const existing = axiomCtx.schemaDeltas.get(subjectIri) ?? {};

  axiomCtx.schemaDeltas.set(subjectIri, {
    ...existing,
    'disjointWith': otherIri
  });

  if (axiomCtx.allClassIris.has(otherIri)) {
    const otherExisting = axiomCtx.schemaDeltas.get(otherIri) ?? {};

    if (!('disjointWith' in otherExisting)) {
      axiomCtx.schemaDeltas.set(otherIri, {
        ...otherExisting,
        'disjointWith': subjectIri
      });
    }
  }
}

/**
 * Apply `owl:equivalentClass` NamedNode target → `$ref` on subject.
 */
function applyEquivalentClassNamed(options: ApplyRelationOptionsType): void {
  const {
    axiomCtx, relation, subjectIri
  } = options;
  const targetIri = axiomCtx.resolveIri(relation.target);

  if (targetIri.startsWith('_:')) {
    return;
  }

  const existing = axiomCtx.schemaDeltas.get(subjectIri) ?? {};

  axiomCtx.schemaDeltas.set(subjectIri, {
    ...existing,
    '$ref': targetIri
  });
}

/**
 * Pass 2: walk all relations on class subjects and apply named-node axiom arms.
 */
function applyNamedNodeAxioms(ctx: OwlImportContextType, axiomCtx: AxiomContextType): void {
  for (const relation of ctx.graph.allRelations()) {
    const subjectIri = relation.source.id;

    if (!ctx.allClassIris.has(subjectIri)) {
      continue;
    }

    const predicate = relation.predicate;
    const relOpts: ApplyRelationOptionsType = {
      axiomCtx,
      relation,
      subjectIri
    };

    if (predicate === RDFS.subClassOf) {
      applySubClassOf(relOpts);
      continue;
    }

    if (COMPLEMENT_OF_PREDICATES.has(predicate)) {
      applyComplementOf(relOpts);
      continue;
    }

    if (DISJOINT_WITH_PREDICATES.has(predicate)) {
      applyDisjointWith(relOpts);
      continue;
    }

    if (EQUIVALENT_CLASS_PREDICATES.has(predicate)) {
      applyEquivalentClassNamed(relOpts);
    }
  }
}

// ---------------------------------------------------------------------------
// BlankNode / Literal equivalentClass arms and disjointUnionOf
// ---------------------------------------------------------------------------

/**
 * Apply the BlankNode arm of `owl:equivalentClass`: resolves the union list via
 * the graph and emits `anyOf` (multiple members) or `$ref` (single member).
 */
function applyEquivalentClassBlankNode(
  options: ApplyBnodeLiteralOptionsType,
  relation: SchemaGraphRelationType,
  subjectIri: string
): void {
  const members = extractEquivalentMembersFromGraph(ImportRelation.targetValue(relation), options.graph);

  if (members.length > 1) {
    const anyOf = members.map((memberIri: string): { '$ref': string } => {
      return { '$ref': memberIri };
    }) as readonly JsonSchemaDocumentObjectType[];
    const existing = options.axiomCtx.schemaDeltas.get(subjectIri) ?? {};

    options.axiomCtx.schemaDeltas.set(subjectIri, {
      ...existing,
      'anyOf': anyOf
    });
  } else if (members.length === 1) {
    const singleMember = members[0];

    if (singleMember === undefined) {
      return;
    }

    const existing = options.axiomCtx.schemaDeltas.get(subjectIri) ?? {};

    options.axiomCtx.schemaDeltas.set(subjectIri, {
      ...existing,
      '$ref': singleMember
    });
  }
}

/**
 * Apply the Literal arm of `owl:equivalentClass`: parses the JSON-LD wrapper
 * literal and emits `$ref` for the first embedded IRI. Reports unsupported
 * when the literal cannot be parsed as a valid union wrapper.
 */
function applyEquivalentClassLiteral(
  schemaDeltas: Map<string, Partial<JsonSchemaDocumentObjectType>>,
  relation: SchemaGraphRelationType,
  subjectIri: string,
  reportUnsupported: OwlImportContextType['reportUnsupported']
): void {
  const members = parseUnionLiteralWrapper(ImportRelation.targetValue(relation));

  if (members.length > 0) {
    const firstMember = members[0];

    if (firstMember === undefined) {
      reportUnsupported(OWL.equivalentClass, subjectIri);

      return;
    }

    const existing = schemaDeltas.get(subjectIri) ?? {};

    schemaDeltas.set(subjectIri, {
      ...existing,
      '$ref': firstMember
    });

    return;
  }

  reportUnsupported(OWL.equivalentClass, subjectIri);
}

/**
 * Apply `owl:disjointUnionOf` RDF list → `oneOf: [{ $ref }]` on the subject.
 */
function applyDisjointUnionOf(
  options: ApplyBnodeLiteralOptionsType,
  relation: SchemaGraphRelationType,
  subjectIri: string
): void {
  if (relation.termType !== 'BlankNode' && relation.termType !== 'NamedNode') {
    return;
  }

  const listHead = ImportRelation.targetValue(relation);
  const members: string[] = [];

  for (const item of options.graph.collectList(listHead)) {
    if (item.termType === 'NamedNode') {
      members.push(item.target);
    }
  }

  if (members.length > 0) {
    const oneOf = members.map((memberIri: string): { '$ref': string } => {
      return { '$ref': memberIri };
    }) as readonly JsonSchemaDocumentObjectType[];
    const existing = options.axiomCtx.schemaDeltas.get(subjectIri) ?? {};

    options.axiomCtx.schemaDeltas.set(subjectIri, {
      ...existing,
      'oneOf': oneOf
    });
  }
}

/**
 * Pass 3: graph-native handling of BlankNode/Literal equivalentClass arms and
 * disjointUnionOf lists.
 */
function applyBnodeLiteralAxioms(ctx: OwlImportContextType, axiomCtx: AxiomContextType): void {
  const bnodeOpts: ApplyBnodeLiteralOptionsType = {
    axiomCtx,
    'graph': ctx.graph
  };

  for (const relation of ctx.graph.allRelations()) {
    const subjectIri = relation.source.id;

    if (!ctx.allClassIris.has(subjectIri)) {
      continue;
    }

    const predicate = relation.predicate;

    if (EQUIVALENT_CLASS_PREDICATES.has(predicate)) {
      if (relation.termType === 'BlankNode') {
        applyEquivalentClassBlankNode(bnodeOpts, relation, subjectIri);
        continue;
      }
      if (relation.termType === 'Literal') {
        applyEquivalentClassLiteral(axiomCtx.schemaDeltas, relation, subjectIri, ctx.reportUnsupported);
      }
      continue;
    }

    if (DISJOINT_UNION_OF_IRIS.has(predicate)) {
      applyDisjointUnionOf(bnodeOpts, relation, subjectIri);
    }
  }
}

// ---------------------------------------------------------------------------
// Public dispatcher
// ---------------------------------------------------------------------------

/**
 * Process class-level OWL axioms (SubClassOf, EquivalentClasses, DisjointClasses,
 * DisjointUnion, ComplementOf) and return a partial import fragment.
 *
 * Graph-native: every arm reads from `ctx.graph`. NamedNode targets come
 * from `allRelations()`; the `owl:equivalentClass` blank-node union wrapper
 * is resolved via `relationsForSubject(bnode)` + `collectList`; the legacy
 * `owl:equivalentClass = <JSON-LD wrapper literal>` form is detected via the
 * relation's `termType === 'Literal'` and parsed from the lexical string;
 * `owl:disjointUnionOf` lists are walked via `collectList`.
 *
 * @param _quads - Retained for back-compat with the dispatcher signature; the
 *                 implementation reads exclusively from `ctx.graph`.
 * @param ctx   - Shared import context (graph, curie, IRI sets, reporting helpers).
 * @returns OwlImportFragmentType with schemaDeltas and/or invariants populated.
 *
 * @remarks
 * Implements the OWL 2 §9.1 class expression axiom set. Each axiom arm is
 * isolated in a named helper to keep complexity low. Symmetric axioms
 * (disjointWith) emit both directions so the resulting schemas are pairwise
 * consistent without a second traversal pass.
 *
 * @example
 * ```ts
 * const fragment = ClassAxioms.dispatch(quads, ctx);
 * // fragment.schemaDeltas contains $ref / allOf / not / disjointWith patches
 * ```
 *
 * @category OWL Import
 * @since 0.1.0
 * @see OwlImportContextType
 * @group importDispatch
 */
export class ClassAxioms {
  public static dispatch(_quads: QuadInterface[], ctx: OwlImportContextType): OwlImportFragmentType {
    const schemaDeltas = new Map<string, Partial<JsonSchemaDocumentObjectType>>();
    const invariants: Array<{ 'invariant': InvariantType;
      'schemaId': string; }> = [];

    const axiomCtx: AxiomContextType = {
      'allClassIris': ctx.allClassIris,
      invariants,
      // QuadBackedSchemaGraph compacts NamedNode IRI targets via the active prefix
      // map. Expand them back so $ref / disjointWith values match the full-IRI
      // schema $id form used throughout the importer.
      'resolveIri': (target: string | { 'id': string }): string => {
        const raw = typeof target === 'string' ? target : target.id;

        return ctx.curie.expandIfNeeded(raw);
      },
      schemaDeltas
    };

    emitClassStubs(ctx, schemaDeltas);
    applyNamedNodeAxioms(ctx, axiomCtx);
    applyBnodeLiteralAxioms(ctx, axiomCtx);

    return {
      'characteristics': [],
      'differentFrom': [],
      'individuals': [],
      invariants,
      'sameAs': [],
      'schemaDeltas': schemaDeltas
    };
  }
}
