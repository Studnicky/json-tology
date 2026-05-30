/**
 * ProjectionHelpers — shared utility functions for OwlProjection and ShaclProjection.
 *
 * Extracted to avoid duplicating byte-identical helpers across the two projection
 * modules. Callers import directly from this file, not from a barrel.
 */

import type { SchemaGraphInterface } from '../../interfaces/SchemaGraphImpl.js';
import type { PredicateResolverFnType } from '../../types/PredicateResolverFn.js';
import { SchemaIri } from '../graph/SchemaIri.js';
import { isRecord } from '../data/DataTypes.js';

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
  } catch {
    return {};
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
