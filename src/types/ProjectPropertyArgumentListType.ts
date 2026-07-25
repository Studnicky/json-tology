import type { SchemaGraphNodeType } from './SchemaGraph.js';
import type { ProjectBaseArgumentListType } from './ProjectBaseArgumentListType.js';

/**
 * Arguments passed to the property-level ABox projection entry point.
 *
 * @remarks
 * Composes {@link ProjectBaseArgumentListType} with the fields specific to projecting a
 * single property value of an ABox individual into one or more RDF quads. The
 * `propertySemantics` object pre-computes format, iriRef, itemsNode, language,
 * and schemaTypes so the inner loop avoids repeated graph lookups. `lookupGraph`
 * (on the base) enables $ref resolution across schema boundaries.
 *
 * @example
 * ```ts
 * const args: ProjectPropertyArgumentListType = {
 *   curie, depth: 1, graph, graphTerm, instanceIri, minter, path: '/name',
 *   predicateResolver, propertyIri, propertyNode, propertySemantics,
 *   quadOpts, quads, value, visited,
 * };
 * ```
 *
 * @category Projection
 * @since 0.10.0
 * @see {@link ProjectInstanceArgumentListType}
 * @group ABox
 */
export type ProjectPropertyArgumentListType = {
  'instanceIri': string;
  /** Single predicate-derivation authority — forwarded to the recursive nested-instance projection. */
  'propertyIri': string;
  'propertyNode': SchemaGraphNodeType;
  'propertySemantics': { 'format': string | undefined;
    'iriRef': boolean;
    'itemsNode': SchemaGraphNodeType | undefined;
    'language': string | undefined;
    'schemaTypes': string[] };
  'value': unknown;
} & ProjectBaseArgumentListType;
