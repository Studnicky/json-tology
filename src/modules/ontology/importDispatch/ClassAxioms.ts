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

import type { SchemaGraphRelationInterface } from '../../../interfaces/SchemaGraphRelationInterface.js';
import type { QuadInterface } from '../../../interfaces/QuadInterface.js';
import type { LoggerInterface } from '../../../interfaces/LoggerInterface.js';
import type { OwlImportContextInterface } from '../../../interfaces/OwlImportContextInterface.js';
import type { OwlImportFragmentInterface } from '../../../interfaces/OwlImportFragmentInterface.js';
import type { JsonSchemaDocumentObjectType } from '../../../types/Schema.js';
import type { InvariantType } from '../../../types/Invariant.js';
import type { SchemaGraphInterface } from '../../../interfaces/SchemaGraphInterface.js';
import type { AxiomContextInterface } from '../../../interfaces/AxiomContextInterface.js';
import type { ApplyRelationOptionsInterface } from '../../../interfaces/ApplyRelationOptionsInterface.js';
import type { ApplyBnodeLiteralOptionsInterface } from '../../../interfaces/ApplyBnodeLiteralOptionsInterface.js';
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
import { LogScope } from '../../data/LogScope.js';
import { SILENT_LOGGER } from '../../../constants/LOGGER.js';

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
 * @returns OwlImportFragmentInterface with schemaDeltas and/or invariants populated.
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
 * @see OwlImportContextInterface
 * @group importDispatch
 */
export class ClassAxioms {
  /**
   * Pass 3: graph-native handling of BlankNode/Literal equivalentClass arms and
   * disjointUnionOf lists.
   */
  private static applyBnodeLiteralAxioms(context: OwlImportContextInterface, axiomContext: AxiomContextInterface): void {
    const bnodeOptions: ApplyBnodeLiteralOptionsInterface = {
      'axiomCtx': axiomContext,
      'graph': context.graph
    };

    for (const relation of ClassAxioms.classSubjectRelations(context)) {
      const subjectIri = relation.source.id;
      const predicate = relation.predicate;

      if (EQUIVALENT_CLASS_PREDICATES.has(predicate)) {
        if (relation.termType === 'BlankNode') {
          ClassAxioms.applyEquivalentClassBlankNode(bnodeOptions, relation, subjectIri);
          continue;
        }
        if (relation.termType === 'Literal') {
          ClassAxioms.applyEquivalentClassLiteral(axiomContext.schemaDeltas, relation, subjectIri, context.reportUnsupported, context.logger ?? SILENT_LOGGER);
        }
        continue;
      }

      if (DISJOINT_UNION_OF_IRIS.has(predicate)) {
        ClassAxioms.applyDisjointUnionOf(bnodeOptions, relation, subjectIri);
      }
    }
  }

  /**
   * Apply `owl:complementOf` NamedNode target → `not: { $ref }` + invariant.
   */
  private static applyComplementOf(options: ApplyRelationOptionsInterface): void {
    const {
      'axiomCtx': axiomContext, relation, subjectIri
    } = options;
    const targetIri = ClassAxioms.resolveNamedTargetIri(axiomContext, relation);

    if (targetIri === undefined) {
      return;
    }

    ImportRelation.mergeSchemaDelta(axiomContext.schemaDeltas, subjectIri, { 'not': { '$ref': targetIri } });

    const inv: InvariantType = {
      'fn': ClassAxioms.complementOfInvariantFunction,
      'name': `complementOf:${subjectIri}:not:${targetIri}`,
      'pointer': ''
    };

    axiomContext.invariants.push({
      'invariant': inv,
      'schemaId': subjectIri
    });
  }

  /**
   * Apply `owl:disjointUnionOf` RDF list → `oneOf: [{ $ref }]` on the subject.
   */
  private static applyDisjointUnionOf(
    options: ApplyBnodeLiteralOptionsInterface,
    relation: SchemaGraphRelationInterface,
    subjectIri: string
  ): void {
    if (relation.termType !== 'BlankNode' && relation.termType !== 'NamedNode') {
      return;
    }

    const listHead = ImportRelation.targetValue(relation);
    const members = ImportRelation.collectNamedNodeIris(options.graph, listHead);

    if (members.length > 0) {
      const oneOf: JsonSchemaDocumentObjectType[] = members.map((memberIri: string): JsonSchemaDocumentObjectType => {
        return { '$ref': memberIri };
      });

      ImportRelation.mergeSchemaDelta(options.axiomCtx.schemaDeltas, subjectIri, { 'oneOf': oneOf });
    }
  }

  /**
   * Apply `owl:disjointWith` NamedNode target → symmetric disjointWith annotation.
   */
  private static applyDisjointWith(options: ApplyRelationOptionsInterface): void {
    const {
      'axiomCtx': axiomContext, relation, subjectIri
    } = options;
    const otherIri = ClassAxioms.resolveNamedTargetIri(axiomContext, relation);

    if (otherIri === undefined) {
      return;
    }

    ImportRelation.mergeSchemaDelta(axiomContext.schemaDeltas, subjectIri, { 'disjointWith': otherIri });

    if (axiomContext.allClassIris.has(otherIri)) {
      const otherExisting = axiomContext.schemaDeltas.get(otherIri) ?? {};

      if (!('disjointWith' in otherExisting)) {
        axiomContext.schemaDeltas.set(otherIri, {
          ...otherExisting,
          'disjointWith': subjectIri
        });
      }
    }
  }

  /**
   * Apply the BlankNode arm of `owl:equivalentClass`: resolves the union list via
   * the graph and emits `anyOf` (multiple members) or `$ref` (single member).
   */
  private static applyEquivalentClassBlankNode(
    options: ApplyBnodeLiteralOptionsInterface,
    relation: SchemaGraphRelationInterface,
    subjectIri: string
  ): void {
    const members = ClassAxioms.extractEquivalentMembersFromGraph(ImportRelation.targetValue(relation), options.graph);

    if (members.length > 1) {
      const anyOf: JsonSchemaDocumentObjectType[] = members.map((memberIri: string): JsonSchemaDocumentObjectType => {
        return { '$ref': memberIri };
      });

      ImportRelation.mergeSchemaDelta(options.axiomCtx.schemaDeltas, subjectIri, { 'anyOf': anyOf });
    } else if (members.length === 1) {
      const singleMember = members[0];

      if (singleMember === undefined) {
        return;
      }

      ImportRelation.mergeSchemaDelta(options.axiomCtx.schemaDeltas, subjectIri, { '$ref': singleMember });
    }
  }

  /**
   * Apply the Literal arm of `owl:equivalentClass`: parses the JSON-LD wrapper
   * literal and emits `$ref` for the first embedded IRI. Reports unsupported
   * when the literal cannot be parsed as a valid union wrapper.
   */
  private static applyEquivalentClassLiteral(
    schemaDeltas: Map<string, JsonSchemaDocumentObjectType>,
    relation: SchemaGraphRelationInterface,
    subjectIri: string,
    reportUnsupported: OwlImportContextInterface['reportUnsupported'],
    logger: LoggerInterface
  ): void {
    const members = ClassAxioms.parseUnionLiteralWrapper(ImportRelation.targetValue(relation), logger);

    if (members.length > 0) {
      const firstMember = members[0];

      if (firstMember === undefined) {
        reportUnsupported(OWL.equivalentClass, subjectIri);

        return;
      }

      ImportRelation.mergeSchemaDelta(schemaDeltas, subjectIri, { '$ref': firstMember });

      return;
    }

    reportUnsupported(OWL.equivalentClass, subjectIri);
  }

  /**
   * Apply `owl:equivalentClass` NamedNode target → `$ref` on subject.
   */
  private static applyEquivalentClassNamed(options: ApplyRelationOptionsInterface): void {
    const {
      'axiomCtx': axiomContext, relation, subjectIri
    } = options;
    const targetIri = ClassAxioms.resolveNamedTargetIri(axiomContext, relation);

    if (targetIri === undefined) {
      return;
    }

    ImportRelation.mergeSchemaDelta(axiomContext.schemaDeltas, subjectIri, { '$ref': targetIri });
  }

  /**
   * Pass 2: walk all relations on class subjects and apply named-node axiom arms.
   */
  private static applyNamedNodeAxioms(context: OwlImportContextInterface, axiomContext: AxiomContextInterface): void {
    for (const relation of ClassAxioms.classSubjectRelations(context)) {
      const subjectIri = relation.source.id;
      const predicate = relation.predicate;
      const relationOptions: ApplyRelationOptionsInterface = {
        'axiomCtx': axiomContext,
        relation,
        subjectIri
      };

      if (predicate === RDFS.subClassOf) {
        ClassAxioms.applySubClassOf(relationOptions);
        continue;
      }

      if (COMPLEMENT_OF_PREDICATES.has(predicate)) {
        ClassAxioms.applyComplementOf(relationOptions);
        continue;
      }

      if (DISJOINT_WITH_PREDICATES.has(predicate)) {
        ClassAxioms.applyDisjointWith(relationOptions);
        continue;
      }

      if (EQUIVALENT_CLASS_PREDICATES.has(predicate)) {
        ClassAxioms.applyEquivalentClassNamed(relationOptions);
      }
    }
  }

  /**
   * Apply `rdfs:subClassOf` NamedNode target → `allOf: [{ $ref }]` on the subject.
   */
  private static applySubClassOf(options: ApplyRelationOptionsInterface): void {
    const {
      'axiomCtx': axiomContext, relation, subjectIri
    } = options;

    if (relation.structure?.kind === 'restriction') {
      return;
    }

    const targetIri = ClassAxioms.resolveNamedTargetIri(axiomContext, relation);

    if (targetIri === undefined) {
      return;
    }

    ClassAxioms.mergeAllOfReference(axiomContext.schemaDeltas, subjectIri, targetIri);
  }

  /**
   * Relations from `context.graph.allRelations()` whose subject is a known
   * class IRI. Shared by the named-node and blank-node/literal axiom passes,
   * which both walk the full relation set but dispatch on different
   * predicate groups.
   */
  private static classSubjectRelations(context: OwlImportContextInterface): SchemaGraphRelationInterface[] {
    const result: SchemaGraphRelationInterface[] = [];

    for (const relation of context.graph.allRelations()) {
      if (context.allClassIris.has(relation.source.id)) {
        result.push(relation);
      }
    }

    return result;
  }

  /**
   * Placeholder invariant function for `owl:complementOf`. The complement
   * constraint is enforced structurally via the `not: { $ref }` schema patch;
   * this invariant records the axiom without adding a runtime check.
   */
  private static complementOfInvariantFunction(_value: unknown): null {
    const result = null;

    return result;
  }

  public static dispatch(_quads: QuadInterface[], context: OwlImportContextInterface): OwlImportFragmentInterface {
    const schemaDeltas = new Map<string, JsonSchemaDocumentObjectType>();
    const invariants: Array<{ 'invariant': InvariantType;
      'schemaId': string; }> = [];

    // QuadBackedSchemaGraph compacts NamedNode IRI targets via the active prefix
    // map. Expand them back so $ref / disjointWith values match the full-IRI
    // schema $id form used throughout the importer.
    const resolveIri = (target: string | { 'id': string }): string => {
      const raw = typeof target === 'string' ? target : target.id;

      return context.curie.expandIfNeeded(raw);
    };

    const axiomContext: AxiomContextInterface = {
      'allClassIris': context.allClassIris,
      invariants,
      resolveIri,
      schemaDeltas
    };

    ClassAxioms.emitClassStubs(context, schemaDeltas);
    ClassAxioms.applyNamedNodeAxioms(context, axiomContext);
    ClassAxioms.applyBnodeLiteralAxioms(context, axiomContext);

    return {
      'characteristics': [],
      'differentFrom': [],
      'individuals': [],
      invariants,
      'sameAs': [],
      'schemaDeltas': schemaDeltas
    };
  }

  /**
   * Pass 1: emit a minimal `{ type: 'object', properties: {}, required: [] }`
   * stub for every named owl:Class or rdfs:Class found in the graph.
   */
  private static emitClassStubs(
    context: OwlImportContextInterface,
    schemaDeltas: Map<string, JsonSchemaDocumentObjectType>
  ): void {
    for (const relation of context.graph.allRelations()) {
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

  /**
   * Walk the bnode's `owl:unionOf` list via the graph's RDF list helper and
   * return the NamedNode IRIs of each member.
   */
  private static extractEquivalentMembersFromGraph(
    bnodeId: string,
    graph: SchemaGraphInterface
  ): string[] {
    const unionRelations = graph.relationsForSubject(bnodeId).filter((rel: SchemaGraphRelationInterface): boolean => {
      const result = UNION_OF_IRIS.has(rel.predicate);

      return result;
    });

    if (unionRelations.length === 0) {
      return [];
    }

    const firstUnionRelation = unionRelations[0];

    if (firstUnionRelation === undefined) {
      return [];
    }

    const listHead = ImportRelation.targetValue(firstUnionRelation);

    return ImportRelation.collectNamedNodeIris(graph, listHead);
  }

  /** Extract `@id` string values from a JSON-LD `@list` array. */
  private static extractIdsFromList(list: unknown[]): string[] {
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
   * Merge an allOf `{ $ref: refIri }` entry into the delta for `classIri`.
   * Accumulates refs without duplicating. Skips blank nodes and internal
   * fragment subjects (e.g. `urn:bookstore:EBook#/allOf/1`).
   */
  private static mergeAllOfReference(
    deltas: Map<string, JsonSchemaDocumentObjectType>,
    classIri: string,
    referenceIri: string
  ): void {
    if (referenceIri.startsWith('_:') || referenceIri.includes('#/')) {
      return;
    }

    const existing = deltas.get(classIri) ?? {};
    const existingAllOf = Array.isArray(existing.allOf)
      ? (existing.allOf as JsonSchemaDocumentObjectType[])
      : [];

    const alreadyPresent = existingAllOf.some((entry: JsonSchemaDocumentObjectType): boolean => {
      return (entry as Record<string, unknown>).$ref === referenceIri;
    });

    if (alreadyPresent) {
      return;
    }

    const newAllOf: JsonSchemaDocumentObjectType[] = [
      ...existingAllOf,
      { '$ref': referenceIri }
    ];

    ImportRelation.mergeSchemaDelta(deltas, classIri, { 'allOf': newAllOf });
  }

  /**
   * Parse the legacy `owl:equivalentClass = <JSON-LD wrapper literal>` form.
   * Some forward projections serialise the equivalentClass union as a single
   * Literal whose lexical string is JSON-encoded:
   *   `{ "@type": "owl:Class", "owl:unionOf": { "@list": [{ "@id": "..." }, ...] } }`
   * The quad-backed graph surfaces this as a Literal-typed relation whose
   * `target` carries the lexical string. We parse it once here and return
   * the embedded `@id` IRIs.
   */
  private static parseUnionLiteralWrapper(lexical: string, logger: LoggerInterface): string[] {
    let parsed: unknown;

    try {
      parsed = JSON.parse(lexical);
    } catch {
      logger.debug(LogScope.format('ClassAxioms', 'parseUnionLiteralWrapper', 'JSON.parse failed for union-literal wrapper; treating as empty'));

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

    return ClassAxioms.extractIdsFromList(list);
  }

  /**
   * Resolve a relation's target to a full IRI via `axiomCtx.resolveIri`,
   * returning undefined when the target is a blank node — the shared
   * "named target or skip" guard for the complementOf / disjointWith /
   * equivalentClass / subClassOf axiom arms.
   */
  private static resolveNamedTargetIri(
    axiomContext: AxiomContextInterface,
    relation: SchemaGraphRelationInterface
  ): string | undefined {
    const targetIri = axiomContext.resolveIri(relation.target);

    return targetIri.startsWith('_:') ? undefined : targetIri;
  }
}
