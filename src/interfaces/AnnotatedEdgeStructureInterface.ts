import type { JsonSchemaType } from '../types/Schema.js';
import type { AnnotatedEdgeKindEntity } from '../entities/AnnotatedEdgeKindEntity.js';
import type { StringValueEntity } from '../entities/StringValueEntity.js';

/**
 * Extracted annotated-edge variant of the `RelationStructureType` discriminated
 * union declared in `SchemaGraph.ts`.
 *
 * @remarks
 * Represents an RDF 1.2 triple-term relation. Used by ABox projection and
 * Lift to detect and process annotated edge properties.
 *
 * Authored as an interface rather than a schema-derived entity: `edgeAnnotations`
 * carries `propertySchema: JsonSchemaType`, a schema-of-schema shape that cannot
 * itself be expressed as a JSON Schema without infinite regress.
 */
export interface AnnotatedEdgeStructureInterface {
  readonly 'edgeAnnotations': ReadonlyArray<{
    'propertyName': StringValueEntity.Type;
    'propertySchema': JsonSchemaType;
    'rangeRef': StringValueEntity.Type;
  }>;
  'edgePredicate': StringValueEntity.Type;
  'edgeTarget': StringValueEntity.Type;
  'kind': AnnotatedEdgeKindEntity.Type;
}
