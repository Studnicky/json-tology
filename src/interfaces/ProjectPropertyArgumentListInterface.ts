import type { SchemaGraphNodeInterface } from './SchemaGraphNodeInterface.js';
import type { ProjectBaseArgumentListInterface } from './ProjectBaseArgumentListInterface.js';
import type { StringValueEntity } from '../entities/StringValueEntity.js';

/**
 * Arguments passed to the property-level ABox projection entry point.
 *
 * @remarks
 * Composes {@link ProjectBaseArgumentListInterface} with the fields specific to projecting a
 * single property value of an ABox individual into one or more RDF quads. The
 * `propertySemantics` object pre-computes format, iriRef, itemsNode, language,
 * and schemaTypes so the inner loop avoids repeated graph lookups. `lookupGraph`
 * (on the base) enables $ref resolution across schema boundaries.
 *
 * @example
 * ```ts
 * const args: ProjectPropertyArgumentListInterface = {
 *   curie, depth: 1, graph, graphTerm, instanceIri, minter, path: '/name',
 *   predicateResolver, propertyIri, propertyNode, propertySemantics,
 *   quadOpts, quads, value, visited,
 * };
 * ```
 *
 * @category Projection
 * @since 0.10.0
 * @see {@link ProjectInstanceArgumentListInterface}
 * @group ABox
 */
export interface ProjectPropertyArgumentListInterface extends ProjectBaseArgumentListInterface {
  'instanceIri': StringValueEntity.Type;
  /** Single predicate-derivation authority — forwarded to the recursive nested-instance projection. */
  'propertyIri': StringValueEntity.Type;
  'propertyNode': SchemaGraphNodeInterface;
  'propertySemantics': { 'format': string | undefined;
    'iriRef': boolean;
    'itemsNode': SchemaGraphNodeInterface | undefined;
    'language': string | undefined;
    'schemaTypes': string[] };
  'value': unknown;
}
