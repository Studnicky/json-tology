import type { RelationStructureType } from './SchemaGraph.js';

/**
 * Extracted annotated-edge variant of the RelationStructureType discriminated union.
 *
 * @remarks
 * Represents an RDF 1.2 triple-term relation. Used by ABox projection and
 * Lift to detect and process annotated edge properties.
 */
export type AnnotatedEdgeStructureType = Extract<RelationStructureType, { 'kind': 'annotatedEdge' }>;
