import type { StringValueEntity } from '../entities/StringValueEntity.js';

interface AnnotatedEdgeDescriptorShapeInterface<
  TPredicate extends string,
  TTargetReference extends string,
  TAnnotations extends Record<string, { '$ref': string }>
> {
  readonly 'annotatedEdgeDescriptorShapeBrand'?: unique symbol;
  'annotations': TAnnotations;
  'predicate': TPredicate;
  'targetRef': TTargetReference;
}

/**
 * Schema shape produced by `Compose.annotatedEdge` — an RDF 1.2 triple-term
 * annotated edge with a predicate, target reference, and annotation map.
 *
 * @remarks
 * `TPredicate`/`TTargetReference`/`TAnnotations` are the caller's own literal
 * type arguments, propagated verbatim into the shape at each
 * `Compose.annotatedEdge` call site — a static JSON Schema constant cannot
 * parameterize over them, so this is declared as a generic interface (a
 * behavioral/type-level contract) rather than schema-derived data. Carries a
 * `unique symbol` brand member so it has real contract evidence per
 * `@studnicky/interface-must-be-contract` without disturbing the generic
 * literal narrowing that is the entire point of this type.
 *
 * @typeParam TPredicate - The RDF predicate IRI as a string literal.
 * @typeParam TTargetReference - The edge's target reference as a string literal.
 * @typeParam TAnnotations - Map of annotation predicate to `$ref` target.
 * @category Compose
 * @since 0.1.0
 * @see {@link https://www.w3.org/TR/rdf12-concepts/#section-triple-terms RDF 1.2 Triple Terms}
 * @group Compose
 */
export interface AnnotatedEdgeSchemaInterface<
  TPredicate extends string,
  TTargetReference extends string,
  TAnnotations extends Record<string, { '$ref': string }>
> {
  '$id'?: StringValueEntity.Type;
  readonly 'annotatedEdgeSchemaBrand'?: unique symbol;
  'jt:annotatedEdge': AnnotatedEdgeDescriptorShapeInterface<TPredicate, TTargetReference, TAnnotations>;
}
