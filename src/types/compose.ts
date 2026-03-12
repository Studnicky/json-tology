import type { JSONSchema7Definition as JSONSchemaType } from 'json-schema';

/** Extract the union of required field names from a schema's `required` array. */
export type ExtractRequiredType<T>
  = T extends { readonly 'required': ReadonlyArray<infer R extends string> } ? R : never;

/** Extract the properties map from a schema, or an empty record if absent. */
export type ExtractPropertiesType<T>
  = T extends { readonly 'properties': infer P extends Record<string, unknown> }
    ? P
    : Record<string, never>;

export type ExtendSchemaType<
  TSchema extends JSONSchemaType,
  TAdditional extends Record<string, JSONSchemaType>,
  TId extends string
> = Omit<TSchema, '$id' | 'properties'> & {
  readonly '$id': TId;
  readonly 'properties': ExtractPropertiesType<TSchema> & { readonly [K in keyof TAdditional]: TAdditional[K] };
};

export interface IntersectionSchemaInterface<
  TSchemas extends readonly JSONSchemaType[],
  TId extends string
> {
  readonly '$id': TId;
  readonly 'allOf': TSchemas;
}

export interface DiscriminatedUnionSchemaInterface<
  TDiscriminator extends string,
  TVariants extends readonly JSONSchemaType[],
  TId extends string
> {
  readonly '$id': TId;
  readonly 'discriminator': { readonly 'propertyName': TDiscriminator };
  readonly 'oneOf': TVariants;
}

export type PartialSchemaType<TSchema, TId extends string>
  = Omit<TSchema, '$id' | 'required'> & { readonly '$id': TId };

export type RequiredSchemaType<TSchema, TId extends string>
  = Omit<TSchema, '$id' | 'required'> & {
    readonly '$id': TId;
    readonly 'required': ReadonlyArray<keyof ExtractPropertiesType<TSchema>>;
  };

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
