/**
 * ProjectionHelpers — shared utility functions for OwlProjection and ShaclProjection.
 *
 * Extracted to avoid duplicating byte-identical helpers across the two projection
 * modules. Callers import directly from this file, not from a barrel.
 */

import type { SchemaGraphInterface } from '../../interfaces/SchemaGraphImpl.js';
import type { SchemaGraphNodeType } from '../../types/SchemaGraph.js';
import type { RelationIndexType } from '../../types/RelationIndex.js';
import type { OptionalAnnotatedEdgeType } from '../../types/OptionalAnnotatedEdgeType.js';
import type { PredicateResolverFnType } from '../../types/PredicateResolverFn.js';
import { SchemaIri } from '../graph/SchemaIri.js';
import { isRecord } from '../data/DataTypes.js';
import { GraphError } from '../../errors/GraphError.js';
import { ProjectionIndex } from './ProjectionIndex.js';
import { RDFS } from '../../constants/IRI.js';

/**
 * Parse `value` to a finite number, returning `undefined` when the result is
 * `NaN`, `Infinity`, or `-Infinity`.
 *
 * Used by both OwlProjection and ShaclProjection to validate cardinality values
 * before emitting typed literals. Callers are responsible for the surrounding
 * emission — OWL emits `xsd:nonNegativeInteger`; SHACL emits `xsd:integer`
 * and branches to `sh:minCount` / `sh:maxCount`.
 */
export function finiteNumber(value: unknown): number | undefined {
  const n = typeof value === 'number' ? value : Number(value);

  return Number.isFinite(n) ? n : undefined;
}

/**
 * Build the property subject IRI for `propertyName` on the class `classId`.
 *
 * The canonical property subject is a JSON-pointer fragment under the class:
 * `<base>#/properties/<name>` for a root class, or
 * `<base>#<pointer>/properties/<name>` for a nested ($defs / pointer) class.
 * This is the form `resolvePropertySchema` resolves via `graph.resolvePointer`.
 */
export function propertySubjectIri(classId: string, propertyName: string): string {
  const {
    base, fragment
  } = SchemaIri.splitSubject(classId);

  if (fragment === null || fragment === '') {
    return `${base}#/properties/${propertyName}`;
  }

  return `${base}#${fragment}/properties/${propertyName}`;
}

/**
 * Resolve the raw JSON Schema object for a property subject IRI.
 * Returns an empty record when the pointer cannot be resolved.
 */
export function resolvePropertySchema(graph: SchemaGraphInterface, subject: string): Record<string, unknown> {
  const { fragment } = SchemaIri.splitSubject(subject);

  if (fragment === null) {
    const rootSchema = graph.rootNode.schema;

    return isRecord(rootSchema) ? rootSchema : {};
  }

  try {
    const node = graph.resolvePointer(fragment);

    return isRecord(node.schema) ? node.schema : {};
  } catch (error) {
    if (error instanceof GraphError && error.code === 'POINTER_NOT_FOUND') {
      return {};
    }

    throw error;
  }
}

/**
 * Resolve a restriction `owl:onProperty` IRI to the flat canonical predicate IRI.
 *
 * User-declared restrictions (`jt:restrictions`) and required-cardinality
 * restrictions carry a class-scoped onProperty of the form
 * `<ClassIRI>#<propertyName>` (e.g. `urn:bookstore:Book#authors`). The flat
 * predicate declared via rdfs:domain/range and used by the ABox is derived from
 * the base IRI (e.g. `https://bookstore.example/authors`). To keep restrictions
 * connected to instances, the onProperty must use the same flat IRI.
 *
 * Splits the class-scoped IRI into classId + propertyName, looks up the property
 * schema (for explicit `x-jt-predicate` / `$id` binding precedence), and resolves
 * via `predicateResolver`. When no resolver is available, or the onProperty is not
 * a bare class-scoped fragment (already flat, a pointer path, or an `rdf:_N`
 * container member), returns it as-is.
 */
export function resolveRestrictionOnProperty(
  onProperty: string,
  graph: SchemaGraphInterface,
  predicateResolver: PredicateResolverFnType | undefined
): string {
  if (predicateResolver === undefined) {
    return onProperty;
  }

  const {
    base, fragment
  } = SchemaIri.splitSubject(onProperty);

  if (fragment === null || fragment === '' || fragment.includes('/')) {
    return onProperty;
  }

  const propSubject = propertySubjectIri(base, fragment);
  const propertySchema = resolvePropertySchema(graph, propSubject);

  return predicateResolver({
    'classId': base,
    'propertyName': fragment,
    'propertySchema': propertySchema
  });
}

/**
 * Find the `annotatedEdge` structure relation attached to a property node, if any.
 *
 * Iterates `graph.relations(propertyNode)` and returns the first relation whose
 * `structure.kind` is `'annotatedEdge'`. Returns `undefined` when no such
 * relation is present.
 */
export function findAnnotatedEdgeStructure(
  graph: SchemaGraphInterface,
  propertyNode: SchemaGraphNodeType
): OptionalAnnotatedEdgeType {
  for (const relation of graph.relations(propertyNode)) {
    if (relation.structure?.kind === 'annotatedEdge') {
      return relation.structure;
    }
  }

  return undefined;
}

/**
 * Resolve the flat predicate IRI for `propertyName` anchored on `classId`.
 *
 * Builds the canonical property subject from `classId` + `propertyName`
 * (`propertySubjectIri`), resolves the raw property schema (for `x-jt-predicate` /
 * `$id` binding precedence), and invokes `predicateResolver`. When no resolver is
 * supplied, falls back to the class-scoped form `SchemaIri.propertyIri(classId, propertyName)`.
 *
 * This is the canonical resolver-call path for callers that already hold a
 * `(classId, propertyName)` pair — notably `VocabProjection.resolvePredicateIri`
 * (dependent-required / conditional emission). The property-emission paths, which
 * derive `classId` from `rdfs:domain` / structural parent and resolve the schema off
 * the existing property-subject IRI, use `resolveCanonicalPropertyIri` instead.
 */
export function resolvePredicateIriForClass(
  graph: SchemaGraphInterface | undefined,
  classId: string,
  propertyName: string,
  predicateResolver: PredicateResolverFnType | undefined
): string {
  if (predicateResolver === undefined || graph === undefined) {
    return SchemaIri.propertyIri(classId, propertyName);
  }

  const propSubject = propertySubjectIri(classId, propertyName);
  const propertySchema = resolvePropertySchema(graph, propSubject);

  return predicateResolver({
    classId,
    propertyName,
    'propertySchema': propertySchema
  });
}

/**
 * Resolve the canonical property IRI for a property subject, with an optional fallback.
 *
 * When `predicateResolver` is provided, delegates to it (using the domain class ID,
 * short property name, and resolved property schema). When no resolver is available,
 * falls back to `fallback(propSubject)`.
 *
 * The domain class ID is taken from the first `rdfs:domain` relation on `propEntry`
 * when present; otherwise it is derived via `SchemaIri.structuralParent`. The short
 * property name is extracted via `SchemaIri.lastSegment`. The property schema is
 * resolved off the incoming `propSubject` directly (a pointer fragment), which is why
 * this path is distinct from `resolvePredicateIriForClass`.
 *
 * This function merges the copies that previously appeared in
 * `OwlProjection.emitPropertyQuads` and `OwlProjection.resolveArrayPropertyCanonicalId`.
 */
export function resolveCanonicalPropertyIri(args: {
  readonly 'fallback': (propSubject: string) => string;
  readonly 'graph': SchemaGraphInterface;
  readonly 'predicateResolver': PredicateResolverFnType | undefined;
  readonly 'propEntry': RelationIndexType;
  readonly 'propSubject': string;
}): string {
  const {
    fallback, graph, predicateResolver, propEntry, propSubject
  } = args;

  if (predicateResolver === undefined) {
    return fallback(propSubject);
  }

  const domainRels = propEntry.byPredicate.get(RDFS.domain) ?? [];
  const classId = domainRels.length > 0
    ? ProjectionIndex.relationTargetId(domainRels[0])
    : SchemaIri.structuralParent(propSubject);
  const propName = SchemaIri.lastSegment(propSubject);
  const propertySchema = resolvePropertySchema(graph, propSubject);

  return predicateResolver({
    'classId': classId,
    'propertyName': propName,
    'propertySchema': propertySchema
  });
}
