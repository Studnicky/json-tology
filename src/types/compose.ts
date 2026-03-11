import type { JSONSchema } from 'json-schema-to-ts';

/** Extract the union of required field names from a schema's `required` array. */
export type ExtractRequired<T> =
  T extends { readonly required: ReadonlyArray<infer R extends string> } ? R : never;

/** Extract the properties map from a schema, or an empty record if absent. */
export type ExtractProperties<T> =
  T extends { readonly properties: infer P extends Record<string, unknown> }
    ? P
    : Record<string, never>;

export type ExtendSchema<
  TSchema extends JSONSchema,
  TAdditional extends Record<string, JSONSchema>,
  TId extends string,
> = Omit<TSchema, '$id' | 'properties'> & {
  readonly $id: TId;
  readonly properties: ExtractProperties<TSchema> & { readonly [K in keyof TAdditional]: TAdditional[K] };
};

export type IntersectionSchema<
  TSchemas extends ReadonlyArray<JSONSchema>,
  TId extends string,
> = {
  readonly $id: TId;
  readonly allOf: TSchemas;
};

export type DiscriminatedUnionSchema<
  TDiscriminator extends string,
  TVariants extends ReadonlyArray<JSONSchema>,
  TId extends string,
> = {
  readonly $id: TId;
  readonly oneOf: TVariants;
  readonly discriminator: { readonly propertyName: TDiscriminator };
};

export type PartialSchema<TSchema, TId extends string> =
  Omit<TSchema, '$id' | 'required'> & { readonly $id: TId };

export type RequiredSchema<TSchema, TId extends string> =
  Omit<TSchema, '$id' | 'required'> & {
    readonly $id: TId;
    readonly required: ReadonlyArray<keyof ExtractProperties<TSchema>>;
  };

export type PickSchema<
  TSchema,
  TKeys extends string,
  TId extends string,
> = {
  readonly $id: TId;
  readonly type: 'object';
  readonly properties: Pick<ExtractProperties<TSchema>, TKeys & keyof ExtractProperties<TSchema>>;
  readonly required: ReadonlyArray<TKeys & ExtractRequired<TSchema>>;
};

export type OmitSchema<
  TSchema,
  TKeys extends string,
  TId extends string,
> = {
  readonly $id: TId;
  readonly type: 'object';
  readonly properties: Omit<ExtractProperties<TSchema>, TKeys>;
  readonly required: ReadonlyArray<Exclude<ExtractRequired<TSchema>, TKeys>>;
};
