import type {
  ExtractPropertiesType, ExtractRequiredType
} from '../types/Compose.js';

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

type SubClassOfAllOfType<TParent>
  = TParent extends ReadonlyArray<{ readonly '$id': string }>
    ? ReadonlyArray<Record<string, unknown>>
    : TParent extends { readonly '$id': string }
      ? ReadonlyArray<Record<string, unknown>>
      : ReadonlyArray<Record<string, unknown>>;

export type SubClassOfSchemaInterface<
  TParent,
  TBody extends Record<string, unknown> & { readonly '$id': string }
>
  = Omit<TBody, '$id'> & {
    readonly '$id': TBody['$id'];
    readonly 'allOf': SubClassOfAllOfType<TParent>;
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
