/**
 * AnnotatedEdgeDescriptorInterface — raw descriptor parsed from
 * `node.schema['jt:annotatedEdge']` by `extractSemantics`.
 *
 * Captures the three authored fields before IRI resolution so that
 * `pushAnnotatedEdgeRelations` can resolve them once via `graph.resolveRefId`
 * and build the `RelationStructure` without re-reading `node.schema`.
 */

export interface AnnotatedEdgeDescriptorInterface {
  readonly 'annotations': Record<string, { readonly '$ref': string }>;
  readonly 'predicate': string;
  readonly 'targetRef': string;
}
