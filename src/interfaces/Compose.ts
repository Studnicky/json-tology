import type {
  ExtractPropertiesType, ExtractRequiredType
} from '../types/Compose.js';

/**
 * Schema shape produced by `Compose.annotatedEdge`.
 *
 * Carries the edge predicate IRI, a `$ref` to the target class, and a map of
 * annotation property names to their `$ref`-valued subschemas. The `jt:annotatedEdge`
 * keyword signals to the graph translator and ABox projector that this property
 * is an annotated edge — i.e. a base triple plus one quad per annotation where
 * the subject is a triple term (RDF 1.2 `<< s p o >>`).
 *
 * Literal field types are preserved as the narrowest literal string so that
 * `$ref` resolution, graph keying, and type inference all operate on the concrete
 * IRI rather than widened `string`.
 */
export interface AnnotatedEdgeSchemaInterface<
  TPredicate extends string,
  TTargetRef extends string,
  TAnnotations extends Record<string, { readonly '$ref': string }>
> {
  readonly '$id'?: string;
  readonly 'jt:annotatedEdge': {
    readonly 'annotations': TAnnotations;
    readonly 'predicate': TPredicate;
    readonly 'targetRef': TTargetRef;
  };
}

export interface IntersectionSchemaInterface<
  TSchemas extends ReadonlyArray<Record<string, unknown>>,
  TId extends string
> {
  readonly '$id': TId;
  readonly 'allOf': TSchemas;
}

export interface DiscriminatedUnionSchemaInterface<
  TDiscriminator extends string,
  TVariants extends ReadonlyArray<Record<string, unknown>>,
  TId extends string
> {
  readonly '$id': TId;
  readonly 'discriminator': { readonly 'propertyName': TDiscriminator };
  readonly 'oneOf': TVariants;
}

export interface PickSchemaInterface<
  TSchema,
  TKeys extends string,
  TId extends string
> {
  readonly '$id': TId;
  readonly 'properties': Pick<ExtractPropertiesType<TSchema>, keyof ExtractPropertiesType<TSchema> & TKeys>;
  readonly 'required': ReadonlyArray<ExtractRequiredType<TSchema> & TKeys>;
  readonly 'type': 'object';
}

export interface OmitSchemaInterface<
  TSchema,
  TKeys extends string,
  TId extends string
> {
  readonly '$id': TId;
  readonly 'properties': Omit<ExtractPropertiesType<TSchema>, TKeys>;
  readonly 'required': ReadonlyArray<Exclude<ExtractRequiredType<TSchema>, TKeys>>;
  readonly 'type': 'object';
}

type SubClassOfAllOfType<TParent, TBody>
  = TParent extends ReadonlyArray<infer TItem>
    ? readonly [...readonly TItem[], Omit<TBody, '$id'>]
    : TParent extends { readonly '$id': string }
      ? readonly [TParent, Omit<TBody, '$id'>]
      : ReadonlyArray<Record<string, unknown>>;

export type SubClassOfSchemaInterface<
  TParent,
  TBody extends Record<string, unknown> & { readonly '$id': string }
>
  = Omit<TBody, '$id'> & {
    readonly '$id': TBody['$id'];
    readonly 'allOf': SubClassOfAllOfType<TParent, TBody>;
  };

export type DisjointWithSchemaInterface<
  TOther extends { readonly '$id': string },
  TBody extends Record<string, unknown> & { readonly '$id': string }
>
  = Omit<TBody, '$id' | 'disjointWith'> & {
    readonly '$id': TBody['$id'];
    readonly 'disjointWith': TOther['$id'];
  };

export type ComplementOfSchemaInterface<
  TOther extends { readonly '$id': string },
  TBody extends Record<string, unknown> & { readonly '$id': string }
>
  = Omit<TBody, '$id' | 'not'> & {
    readonly '$id': TBody['$id'];
    readonly 'not': { readonly '$ref': TOther['$id'] };
  };
