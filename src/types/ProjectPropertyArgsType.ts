import type { SchemaGraphNodeType } from './SchemaGraph.js';
import type { ProjectBaseArgsType } from './ProjectBaseArgs.js';

/**
 * Arguments passed to the property-level ABox projection entry point.
 *
 * @remarks
 * Composes {@link ProjectBaseArgsType} with the fields specific to projecting a
 * single property value of an ABox individual into one or more RDF quads. The
 * `propertySemantics` object pre-computes format, iriRef, itemsNode, language,
 * and schemaTypes so the inner loop avoids repeated graph lookups. `lookupGraph`
 * (on the base) enables $ref resolution across schema boundaries.
 *
 * @example
 * ```ts
 * const args: ProjectPropertyArgsType = {
 *   curie, depth: 1, graph, graphTerm, instanceIri, minter, path: '/name',
 *   predicateResolver, propertyIRI, propertyNode, propertySemantics,
 *   quadOpts, quads, value, visited,
 * };
 * ```
 *
 * @category Projection
 * @since 0.10.0
 * @see {@link ProjectInstanceArgsType}
 * @group ABox
 */
export type ProjectPropertyArgsType = {
  readonly 'instanceIri': string;
  /** Single predicate-derivation authority — forwarded to the recursive nested-instance projection. */
  readonly 'propertyIRI': string;
  readonly 'propertyNode': SchemaGraphNodeType;
  readonly 'propertySemantics': { 'format': string | undefined;
    'iriRef': boolean;
    'itemsNode': SchemaGraphNodeType | undefined;
    'language': string | undefined;
    'schemaTypes': string[] };
  readonly 'value': unknown;
} & ProjectBaseArgsType;
