/**
 * ClassExpressions dispatcher — OWL 2 §8 / §9.1 Class Expressions
 *
 * Responsible for:
 *   owl:intersectionOf  — conjunction class expressions  → allOf
 *   owl:unionOf         — disjunction class expressions  → anyOf
 *                         (discriminated variant when all members share a
 *                         distinct hasValue on the same property)
 *   owl:disjointUnionOf — disjoint union class expressions → oneOf
 *   owl:oneOf           — enumerated class expressions   → enum
 *
 * Anonymous (blank-node) class expressions are resolved recursively so they
 * never leak into the output as _: IRIs.
 *
 * Bucket strategy: structural — populates schemaDeltas with allOf/oneOf/enum
 * patches merged into the subject class by the orchestrator.
 *
 * Graph-native traversal:
 * - Subject relations are read from `ctx.graph.relationsForSubject(subject)`.
 * - RDF lists (`owl:intersectionOf`, `owl:unionOf`, `owl:disjointUnionOf`,
 *   `owl:oneOf` member lists) are walked via `ctx.graph.collectList(head)`.
 * - Blank-node class expressions are resolved recursively by treating their
 *   bnode id as a subject and re-entering the same per-subject helpers.
 * - Literal list items carry their typed JS value via `ListItemType.datatype`,
 *   so `decodeLiteral` semantics survive through `Terms.literal` reconstruction.
 */

import type { QuadInterface } from '../../../interfaces/Quad.js';
import type {
  OwlImportContext, OwlImportFragment
} from '../../../interfaces/OwlImport.js';
import type {
  ListItemType,
  SchemaGraphRelationInterface
} from '../../../interfaces/SchemaGraph.js';
import type { SchemaGraphInterface } from '../../../interfaces/SchemaGraphImpl.js';
import type { JsonSchemaDocumentObjectType } from '../../../types/Schema.js';
import { Terms } from '../../rdf/Terms.js';
import { decodeLiteral } from '../../rdf/Terms.js';

// ---------------------------------------------------------------------------
// OWL / RDF IRI constants — full IRIs for quad-level matching
// ---------------------------------------------------------------------------

const OWL_VOCAB = 'http://www.w3.org/2002/07/owl#';
const RDF_VOCAB = 'http://www.w3.org/1999/02/22-rdf-syntax-ns#';

/** Maximum recursion depth for blank-node class expression resolution. */
const MAX_BNODE_DEPTH = 20;

/** Predicate values emitted by JsonLdToQuads (full IRI) and QuadFactory (prefixed). */
const INTERSECTION_OF_IRIS: ReadonlySet<string> = new Set([
  `${OWL_VOCAB}intersectionOf`,
  'owl:intersectionOf'
]);
const UNION_OF_IRIS: ReadonlySet<string> = new Set([
  `${OWL_VOCAB}unionOf`,
  'owl:unionOf'
]);
const DISJOINT_UNION_OF_IRIS: ReadonlySet<string> = new Set([
  `${OWL_VOCAB}disjointUnionOf`,
  'owl:disjointUnionOf'
]);
const ONE_OF_IRIS: ReadonlySet<string> = new Set([
  `${OWL_VOCAB}oneOf`,
  'owl:oneOf'
]);
const HAS_VALUE_IRIS: ReadonlySet<string> = new Set([
  `${OWL_VOCAB}hasValue`,
  'owl:hasValue'
]);
const ON_PROPERTY_IRIS: ReadonlySet<string> = new Set([
  `${OWL_VOCAB}onProperty`,
  'owl:onProperty'
]);
const TYPE_IRIS: ReadonlySet<string> = new Set([
  `${RDF_VOCAB}type`,
  'rdf:type'
]);
const RESTRICTION_IRIS: ReadonlySet<string> = new Set([
  `${OWL_VOCAB}Restriction`,
  'owl:Restriction'
]);

// ---------------------------------------------------------------------------
// Options interfaces
// ---------------------------------------------------------------------------

/** Options for resolving a list item into a JSON Schema fragment. */
interface ResolveItemOptions {
  'allClassIris': ReadonlySet<string>;
  'depth': number;
  'graph': SchemaGraphInterface;
  'item': ListItemType;
}

/** Options for resolving a blank-node class expression. */
interface ResolveBnodeOptions {
  'allClassIris': ReadonlySet<string>;
  'bnodeId': string;
  'depth': number;
  'graph': SchemaGraphInterface;
}

/** Options for walking an RDF list and resolving each member. */
interface ResolveListOptions {
  'allClassIris': ReadonlySet<string>;
  'depth': number;
  'graph': SchemaGraphInterface;
  'listHead': string;
}

/** Shared context for per-subject class expression handlers. */
interface ClassExprContext {
  readonly 'allClassIris': ReadonlySet<string>;
  readonly 'graph': SchemaGraphInterface;
  readonly 'reportUnsupported': (axiomIri: string, subjectIri: string) => void;
  readonly 'schemaDeltas': Map<string, Partial<JsonSchemaDocumentObjectType>>;
}

// ---------------------------------------------------------------------------
// Graph-native helpers
// ---------------------------------------------------------------------------

/** Resolve the IRI / bnode-id form of a relation target. */
function targetValue(relation: SchemaGraphRelationInterface): string {
  return typeof relation.target === 'string' ? relation.target : relation.target.id;
}

/** Filter outgoing relations on a subject by predicate set. */
function relationsByPredicate(
  graph: SchemaGraphInterface,
  subject: string,
  predicates: ReadonlySet<string>
): readonly SchemaGraphRelationInterface[] {
  return graph.relationsForSubject(subject).filter((rel: SchemaGraphRelationInterface): boolean => {
    return predicates.has(rel.predicate);
  });
}

/**
 * Decode a Literal ListItemType back to its typed JS value via the canonical
 * Terms.literal / decodeLiteral round-trip. Preserves XSD-typed integers,
 * booleans, Dates, etc.
 */
function decodeListItemLiteral(item: ListItemType): unknown {
  const literalTerm = Terms.literal(item.target, {
    'datatype': Terms.iri(item.datatype ?? ''),
    'language': item.language ?? ''
  });

  return decodeLiteral(literalTerm);
}

// ---------------------------------------------------------------------------
// Blank-node restriction detection
// ---------------------------------------------------------------------------

/** Return true when the blank node is an owl:Restriction or has onProperty. */
function isBnodeRestriction(bnodeId: string, graph: SchemaGraphInterface): boolean {
  const typeRelations = relationsByPredicate(graph, bnodeId, TYPE_IRIS);
  const isRestrictionType = typeRelations.some((rel: SchemaGraphRelationInterface): boolean => {
    return rel.termType === 'NamedNode' && RESTRICTION_IRIS.has(targetValue(rel));
  });

  if (isRestrictionType) {
    return true;
  }

  return relationsByPredicate(graph, bnodeId, ON_PROPERTY_IRIS).length > 0;
}

// ---------------------------------------------------------------------------
// Blank-node class expression resolution
// ---------------------------------------------------------------------------

/**
 * Resolve a single list item (NamedNode IRI or BlankNode id) into a JSON
 * Schema fragment.
 *
 * - NamedNode → `{ $ref: <iri> }`
 * - BlankNode typed as owl:Class with owl:intersectionOf → nested allOf
 * - BlankNode typed as owl:Class with owl:unionOf       → nested anyOf
 * - BlankNode typed as owl:Restriction                  → undefined (skipped;
 *   PropertyRestrictions dispatcher owns these)
 * - BlankNode that cannot be resolved → undefined (skipped)
 * - Literal at the member level → undefined (not a class expression)
 */
function resolveClassExpressionMember(options: ResolveItemOptions): JsonSchemaDocumentObjectType | undefined {
  const {
    allClassIris, depth, graph, item
  } = options;

  if (depth > MAX_BNODE_DEPTH) {
    return undefined;
  }

  if (item.termType === 'NamedNode') {
    return { '$ref': item.target };
  }

  if (item.termType === 'BlankNode') {
    return resolveBlankNodeExpression({
      allClassIris,
      'bnodeId': item.target,
      'depth': depth + 1,
      graph
    });
  }

  return undefined;
}

/**
 * Resolve a blank-node class expression to a JSON Schema fragment by
 * inspecting its outgoing relations.
 */
function resolveBlankNodeExpression(options: ResolveBnodeOptions): JsonSchemaDocumentObjectType | undefined {
  const {
    allClassIris, bnodeId, depth, graph
  } = options;

  const intersection = relationsByPredicate(graph, bnodeId, INTERSECTION_OF_IRIS);

  if (intersection.length > 0) {
    return resolveIntersectionBnode({
      allClassIris,
      depth,
      graph,
      'listHead': targetValue(intersection[0])
    });
  }

  const union = relationsByPredicate(graph, bnodeId, UNION_OF_IRIS);

  if (union.length > 0) {
    return resolveUnionBnode({
      allClassIris,
      depth,
      graph,
      'listHead': targetValue(union[0])
    });
  }

  // owl:Restriction blank node — skip (PropertyRestrictions handles this).
  if (isBnodeRestriction(bnodeId, graph)) {
    return undefined;
  }

  return undefined;
}

/** Resolve an owl:intersectionOf bnode into `{ allOf: members }`. */
function resolveIntersectionBnode(options: ResolveListOptions): JsonSchemaDocumentObjectType | undefined {
  const members = resolveListMembers(options);

  return members.length === 0 ? undefined : { 'allOf': members };
}

/** Resolve an owl:unionOf bnode into `{ oneOf: members }`. */
function resolveUnionBnode(options: ResolveListOptions): JsonSchemaDocumentObjectType | undefined {
  const members = resolveListMembers(options);

  return members.length === 0 ? undefined : { 'oneOf': members };
}

/**
 * Walk an RDF list rooted at `listHead` and resolve each member into a JSON
 * Schema fragment. Filters out undefined results (blank nodes we cannot
 * resolve).
 */
function resolveListMembers(options: ResolveListOptions): JsonSchemaDocumentObjectType[] {
  const {
    allClassIris, depth, graph, listHead
  } = options;
  const items = graph.collectList(listHead);
  const result: JsonSchemaDocumentObjectType[] = [];

  for (const item of items) {
    const fragment = resolveClassExpressionMember({
      allClassIris,
      depth,
      graph,
      item
    });

    if (fragment !== undefined) {
      result.push(fragment);
    }
  }

  return result;
}

// ---------------------------------------------------------------------------
// Discriminator detection for unionOf
// ---------------------------------------------------------------------------

/**
 * Detect whether all union members share a common `owl:hasValue` on the same
 * `owl:onProperty`, with pairwise-distinct values.
 *
 * Returns the property local name if a discriminator is found, or undefined.
 */
function detectDiscriminatorProperty(
  memberItems: readonly ListItemType[],
  graph: SchemaGraphInterface
): string | undefined {
  if (memberItems.length < 2) {
    return undefined;
  }

  const memberDiscriminators: Array<{ 'property': string;
    'value': string }> = [];

  for (const item of memberItems) {
    if (item.termType !== 'BlankNode') {
      return undefined;
    }
    const disc = extractHasValueDiscriminator(item.target, graph);

    if (disc === undefined) {
      return undefined;
    }
    memberDiscriminators.push(disc);
  }

  const firstProp = memberDiscriminators[0]?.property;
  const allSameProperty = memberDiscriminators.every((disc: { 'property': string;
    'value': string }): boolean => {
    return disc.property === firstProp;
  });

  if (!allSameProperty) {
    return undefined;
  }

  const values = memberDiscriminators.map((disc: { 'property': string;
    'value': string }): string => {
    return disc.value;
  });
  const valueSet = new Set(values);

  if (valueSet.size !== values.length) {
    return undefined;
  }

  return firstProp;
}

/**
 * Extract the `owl:hasValue` discriminator from a blank node that should be
 * an owl:Restriction on a single property.
 */
function extractHasValueDiscriminator(
  bnodeId: string,
  graph: SchemaGraphInterface
): undefined | { 'property': string;
  'value': string } {
  const hasValueRelations = relationsByPredicate(graph, bnodeId, HAS_VALUE_IRIS);

  if (hasValueRelations.length === 0) {
    return undefined;
  }
  const onPropertyRelations = relationsByPredicate(graph, bnodeId, ON_PROPERTY_IRIS);

  if (onPropertyRelations.length === 0) {
    return undefined;
  }

  const propertyRel = onPropertyRelations[0];

  if (propertyRel.termType !== 'NamedNode') {
    return undefined;
  }
  const propertyIri = targetValue(propertyRel);
  const localName = propertyIri.includes('#')
    ? propertyIri.split('#').pop() ?? propertyIri
    : propertyIri.split('/').pop() ?? propertyIri;

  const valueRel = hasValueRelations[0];

  if (valueRel.termType !== 'NamedNode' && valueRel.termType !== 'BlankNode' && valueRel.termType !== 'Literal') {
    return undefined;
  }

  return {
    'property': localName,
    'value': targetValue(valueRel)
  };
}

// ---------------------------------------------------------------------------
// owl:oneOf → enum extraction
// ---------------------------------------------------------------------------

/**
 * Extract enum values from an owl:oneOf list where members are named
 * individuals or literals.
 *
 * - Literal item → typed JS value via decodeLiteral.
 * - NamedNode item → IRI string.
 * - BlankNode item with owl:hasValue → the hasValue literal / IRI.
 */
function extractEnumValues(
  listHead: string,
  graph: SchemaGraphInterface
): unknown[] {
  const items = graph.collectList(listHead);
  const values: unknown[] = [];

  for (const item of items) {
    switch (item.termType) {
      case 'BlankNode': {
        // Blank-node individual with owl:hasValue.
        const hvRelations = relationsByPredicate(graph, item.target, HAS_VALUE_IRIS);

        if (hvRelations.length > 0) {
          const hv = hvRelations[0];

          if (hv.termType === 'Literal') {
            const literalTerm = Terms.literal(targetValue(hv), {
              'datatype': Terms.iri(hv.datatype ?? ''),
              'language': hv.language ?? ''
            });

            values.push(decodeLiteral(literalTerm));
          } else {
            values.push(targetValue(hv));
          }
        }
        break;
      }
      case 'Literal':
        values.push(decodeListItemLiteral(item));
        break;
      case 'NamedNode':
        values.push(item.target);
        break;
    }
  }

  return values;
}

// ---------------------------------------------------------------------------
// Per-subject class expression handlers
// ---------------------------------------------------------------------------

/**
 * Apply `owl:intersectionOf` relations for a single class subject.
 */
function applyIntersectionOf(
  subjectId: string,
  ctx: ClassExprContext
): void {
  const intersection = relationsByPredicate(ctx.graph, subjectId, INTERSECTION_OF_IRIS);

  for (const iq of intersection) {
    const members = resolveListMembers({
      'allClassIris': ctx.allClassIris,
      'depth': 0,
      'graph': ctx.graph,
      'listHead': targetValue(iq)
    });

    if (members.length > 0) {
      const existing = ctx.schemaDeltas.get(subjectId) ?? {};

      ctx.schemaDeltas.set(subjectId, {
        ...existing,
        'allOf': members
      });
    }
  }
}

/**
 * Apply `owl:unionOf` relations for a single class subject (with discriminator detection).
 */
function applyUnionOf(subjectId: string, ctx: ClassExprContext): boolean {
  const union = relationsByPredicate(ctx.graph, subjectId, UNION_OF_IRIS);

  for (const uq of union) {
    const listHead = targetValue(uq);
    const listItems = ctx.graph.collectList(listHead);
    const discriminatorProp = detectDiscriminatorProperty(listItems, ctx.graph);

    if (discriminatorProp !== undefined) {
      ctx.reportUnsupported(
        `discriminator:${discriminatorProp}`,
        subjectId
      );
    }

    const members = resolveListMembers({
      'allClassIris': ctx.allClassIris,
      'depth': 0,
      'graph': ctx.graph,
      listHead
    });

    if (members.length > 0) {
      const existing = ctx.schemaDeltas.get(subjectId) ?? {};

      ctx.schemaDeltas.set(subjectId, {
        ...existing,
        'oneOf': members
      });
    }
  }

  return union.length > 0;
}

/**
 * Apply `owl:disjointUnionOf` relations for a single class subject.
 */
function applyDisjointUnionOf(subjectId: string, ctx: ClassExprContext): boolean {
  const disjointUnion = relationsByPredicate(ctx.graph, subjectId, DISJOINT_UNION_OF_IRIS);

  for (const duq of disjointUnion) {
    const members = resolveListMembers({
      'allClassIris': ctx.allClassIris,
      'depth': 0,
      'graph': ctx.graph,
      'listHead': targetValue(duq)
    });

    if (members.length > 0) {
      const existing = ctx.schemaDeltas.get(subjectId) ?? {};

      ctx.schemaDeltas.set(subjectId, {
        ...existing,
        'oneOf': members
      });
    }
  }

  return disjointUnion.length > 0;
}

/**
 * Apply `owl:oneOf` (enum) relations for a single class subject.
 * Only call when no unionOf / disjointUnionOf already covers the subject.
 */
function applyOneOf(subjectId: string, ctx: ClassExprContext): void {
  const oneOf = relationsByPredicate(ctx.graph, subjectId, ONE_OF_IRIS);

  for (const oq of oneOf) {
    const enumValues = extractEnumValues(targetValue(oq), ctx.graph);

    if (enumValues.length > 0) {
      const existing = ctx.schemaDeltas.get(subjectId) ?? {};

      ctx.schemaDeltas.set(subjectId, {
        ...existing,
        'enum': enumValues
      });
    }
  }
}

// ---------------------------------------------------------------------------
// Empty fragment helper
// ---------------------------------------------------------------------------

function emptyFragment(): OwlImportFragment {
  return {
    'characteristics': [],
    'individuals': [],
    'invariants': [],
    'sameAs': [],
    'schemaDeltas': new Map()
  };
}

// ---------------------------------------------------------------------------
// Public dispatcher
// ---------------------------------------------------------------------------

/**
 * Process OWL 2 class expression axioms (intersectionOf, unionOf, oneOf) and
 * return a partial import fragment with schemaDeltas populated.
 *
 * Graph-native: walks `ctx.graph.relationsForSubject(classIri)` for each
 * named class and uses `ctx.graph.collectList(head)` to resolve the
 * `owl:intersectionOf` / `owl:unionOf` / `owl:disjointUnionOf` / `owl:oneOf`
 * RDF lists.
 *
 * @param _quads - Retained for back-compat with the dispatcher signature; the
 *                 implementation reads exclusively from `ctx.graph`.
 * @param ctx   - Shared import context (graph, curie, IRI sets, reporting).
 * @returns OwlImportFragment with schemaDeltas for class expression subjects.
 *
 * @remarks
 * Processes OWL 2 §8 / §9.1 class expressions: intersection, union, disjoint
 * union, and enumeration. Blank-node members are resolved recursively up to
 * `MAX_BNODE_DEPTH` levels. Discriminated unions detected via `owl:hasValue`
 * are reported as unsupported and emitted as plain `oneOf` arrays.
 *
 * @example
 * ```ts
 * const fragment = importClassExpressions(quads, ctx);
 * // fragment.schemaDeltas contains allOf / oneOf / enum patches per class IRI
 * ```
 *
 * @category OWL Import
 * @since 0.1.0
 * @see OwlImportContext
 * @group importDispatch
 */
export function importClassExpressions(
  _quads: QuadInterface[],
  ctx: OwlImportContext
): OwlImportFragment {
  const schemaDeltas = new Map<string, Partial<JsonSchemaDocumentObjectType>>();
  const exprCtx: ClassExprContext = {
    'allClassIris': ctx.allClassIris,
    'graph': ctx.graph,
    'reportUnsupported': ctx.reportUnsupported,
    schemaDeltas
  };

  for (const subjectId of ctx.allClassIris) {
    if (subjectId.startsWith('_:')) {
      continue;
    }

    applyIntersectionOf(subjectId, exprCtx);

    const hasUnion = applyUnionOf(subjectId, exprCtx);
    const hasDisjointUnion = applyDisjointUnionOf(subjectId, exprCtx);

    if (!hasUnion && !hasDisjointUnion) {
      applyOneOf(subjectId, exprCtx);
    }
  }

  if (schemaDeltas.size === 0) {
    return emptyFragment();
  }

  return {
    'characteristics': [],
    'individuals': [],
    'invariants': [],
    'sameAs': [],
    schemaDeltas
  };
}
