import type { ExtractPropertiesType, ExtractRequiredType } from '../types/compose.js';

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
