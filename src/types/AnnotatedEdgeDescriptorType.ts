import type { JsonSchemaType } from '../types/Schema.js';

/**
 * AnnotatedEdgeDescriptorType — raw descriptor parsed from
 * `node.schema['jt:annotatedEdge']` by `extractSemantics`.
 *
 * Captures the three authored fields before IRI resolution so that
 * `pushAnnotatedEdgeRelations` can resolve them once via `graph.resolveRefId`
 * and build the `RelationStructureType` without re-reading `node.schema`.
 *
 * Each annotation is carried as its full authored sub-schema (a `JsonSchemaType`
 * with a required range `$ref` plus optional predicate-binding keywords such as
 * `x-jt-predicate` / `$id`), so the annotation predicate IRI can be resolved
 * late via `PredicateResolver` — consistent with every other predicate.
 */

export type AnnotatedEdgeDescriptorType = {
  readonly 'annotations': Record<string, JsonSchemaType>;
  readonly 'predicate': string;
  readonly 'targetRef': string;
};
