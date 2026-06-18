import type { RelationStructure } from './SchemaGraph.js';

/**
 * Extracted annotated-edge variant of the RelationStructure discriminated union.
 *
 * @remarks
 * Represents an RDF 1.2 triple-term relation. Used by ABox projection and
 * Lift to detect and process annotated edge properties.
 */
export type AnnotatedEdgeStructureType = Extract<RelationStructure, { 'kind': 'annotatedEdge' }>;
