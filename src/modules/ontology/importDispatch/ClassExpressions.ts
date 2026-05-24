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
// OWL namespace constants — full IRIs for quad-level matching
// ---------------------------------------------------------------------------

const OWL_NS = 'http://www.w3.org/2002/07/owl#';
const RDF_NS = 'http://www.w3.org/1999/02/22-rdf-syntax-ns#';

/** Predicate values emitted by JsonLdToQuads (full IRI) and QuadFactory (prefixed). */
const INTERSECTION_OF_IRIS: ReadonlySet<string> = new Set([
  `${OWL_NS}intersectionOf`,
  'owl:intersectionOf'
]);
const UNION_OF_IRIS: ReadonlySet<string> = new Set([
  `${OWL_NS}unionOf`,
  'owl:unionOf'
]);
const DISJOINT_UNION_OF_IRIS: ReadonlySet<string> = new Set([
  `${OWL_NS}disjointUnionOf`,
  'owl:disjointUnionOf'
]);
const ONE_OF_IRIS: ReadonlySet<string> = new Set([
  `${OWL_NS}oneOf`,
  'owl:oneOf'
]);
const HAS_VALUE_IRIS: ReadonlySet<string> = new Set([
  `${OWL_NS}hasValue`,
  'owl:hasValue'
]);
const ON_PROPERTY_IRIS: ReadonlySet<string> = new Set([
  `${OWL_NS}onProperty`,
  'owl:onProperty'
]);
const TYPE_IRIS: ReadonlySet<string> = new Set([
  `${RDF_NS}type`,
  'rdf:type'
]);
const RESTRICTION_IRIS: ReadonlySet<string> = new Set([
  `${OWL_NS}Restriction`,
  'owl:Restriction'
]);

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
  return graph.relationsForSubject(subject).filter((rel) => {
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
function resolveClassExpressionMember(
  item: ListItemType,
  graph: SchemaGraphInterface,
  allClassIris: ReadonlySet<string>,
  depth: number
): JsonSchemaDocumentObjectType | undefined {
  if (depth > 20) {
    return undefined;
  }

  if (item.termType === 'NamedNode') {
    return { '$ref': item.target };
  }

  if (item.termType === 'BlankNode') {
    return resolveBlankNodeExpression(item.target, graph, allClassIris, depth + 1);
  }

  return undefined;
}

/**
 * Resolve a blank-node class expression to a JSON Schema fragment by
 * inspecting its outgoing relations.
 */
function resolveBlankNodeExpression(
  bnodeId: string,
  graph: SchemaGraphInterface,
  allClassIris: ReadonlySet<string>,
  depth: number
): JsonSchemaDocumentObjectType | undefined {
  const intersection = relationsByPredicate(graph, bnodeId, INTERSECTION_OF_IRIS);

  if (intersection.length > 0) {
    const members = resolveListMembers(targetValue(intersection[0]), graph, allClassIris, depth);

    if (members.length === 0) {
      return undefined;
    }

    return { 'allOf': members };
  }

  const union = relationsByPredicate(graph, bnodeId, UNION_OF_IRIS);

  if (union.length > 0) {
    const members = resolveListMembers(targetValue(union[0]), graph, allClassIris, depth);

    if (members.length === 0) {
      return undefined;
    }

    return { 'oneOf': members };
  }

  // owl:Restriction blank node — skip (PropertyRestrictions handles this).
  const typeRelations = relationsByPredicate(graph, bnodeId, TYPE_IRIS);
  const isRestriction = typeRelations.some((rel) => {
    return rel.termType === 'NamedNode' && RESTRICTION_IRIS.has(targetValue(rel));
  });

  if (isRestriction) {
    return undefined;
  }

  // Has onProperty → also restriction-shaped.
  if (relationsByPredicate(graph, bnodeId, ON_PROPERTY_IRIS).length > 0) {
    return undefined;
  }

  return undefined;
}

/**
 * Walk an RDF list rooted at `listHead` and resolve each member into a JSON
 * Schema fragment. Filters out undefined results (blank nodes we cannot
 * resolve).
 */
function resolveListMembers(
  listHead: string,
  graph: SchemaGraphInterface,
  allClassIris: ReadonlySet<string>,
  depth: number
): JsonSchemaDocumentObjectType[] {
  const items = graph.collectList(listHead);
  const result: JsonSchemaDocumentObjectType[] = [];

  for (const item of items) {
    const fragment = resolveClassExpressionMember(item, graph, allClassIris, depth);

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
  const allSameProperty = memberDiscriminators.every((disc) => {
    return disc.property === firstProp;
  });

  if (!allSameProperty) {
    return undefined;
  }

  const values = memberDiscriminators.map((disc) => {
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
 */
export function importClassExpressions(
  _quads: QuadInterface[],
  ctx: OwlImportContext
): OwlImportFragment {
  const schemaDeltas = new Map<string, Partial<JsonSchemaDocumentObjectType>>();
  const graph = ctx.graph;

  for (const subjectId of ctx.allClassIris) {
    if (subjectId.startsWith('_:')) {
      continue;
    }

    // owl:intersectionOf → allOf
    const intersection = relationsByPredicate(graph, subjectId, INTERSECTION_OF_IRIS);

    for (const iq of intersection) {
      const members = resolveListMembers(targetValue(iq), graph, ctx.allClassIris, 0);

      if (members.length > 0) {
        const existing = schemaDeltas.get(subjectId) ?? {};

        schemaDeltas.set(subjectId, {
          ...existing,
          'allOf': members
        });
      }
    }

    // owl:unionOf → anyOf (with discriminator detection)
    const union = relationsByPredicate(graph, subjectId, UNION_OF_IRIS);

    for (const uq of union) {
      const listHead = targetValue(uq);
      const listItems = graph.collectList(listHead);
      const discriminatorProp = detectDiscriminatorProperty(listItems, graph);

      if (discriminatorProp !== undefined) {
        ctx.reportUnsupported(
          `discriminator:${discriminatorProp}`,
          subjectId
        );
      }

      const members = resolveListMembers(listHead, graph, ctx.allClassIris, 0);

      if (members.length > 0) {
        const existing = schemaDeltas.get(subjectId) ?? {};

        schemaDeltas.set(subjectId, {
          ...existing,
          'oneOf': members
        });
      }
    }

    // owl:disjointUnionOf → oneOf
    const disjointUnion = relationsByPredicate(graph, subjectId, DISJOINT_UNION_OF_IRIS);

    for (const duq of disjointUnion) {
      const members = resolveListMembers(targetValue(duq), graph, ctx.allClassIris, 0);

      if (members.length > 0) {
        const existing = schemaDeltas.get(subjectId) ?? {};

        schemaDeltas.set(subjectId, {
          ...existing,
          'oneOf': members
        });
      }
    }

    // owl:oneOf → enum (skip when unionOf / disjointUnionOf already covers the subject).
    const oneOf = relationsByPredicate(graph, subjectId, ONE_OF_IRIS);

    if (oneOf.length > 0 && union.length === 0 && disjointUnion.length === 0) {
      for (const oq of oneOf) {
        const enumValues = extractEnumValues(targetValue(oq), graph);

        if (enumValues.length > 0) {
          const existing = schemaDeltas.get(subjectId) ?? {};

          schemaDeltas.set(subjectId, {
            ...existing,
            'enum': enumValues
          });
        }
      }
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
