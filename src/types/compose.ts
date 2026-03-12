import type { JSONSchema } from './json-schema.js';

/** Extract the union of required field names from a schema's `required` array. */
export type ExtractRequired<T>
  = T extends { readonly 'required': ReadonlyArray<infer R extends string> } ? R : never;

/** Extract the properties map from a schema, or an empty record if absent. */
export type ExtractProperties<T>
  = T extends { readonly 'properties': infer P extends Record<string, unknown> }
    ? P
    : Record<string, never>;

export type ExtendSchema<
  TSchema extends JSONSchema,
  TAdditional extends Record<string, JSONSchema>,
  TId extends string
> = Omit<TSchema, '$id' | 'properties'> & {
  readonly '$id': TId;
  readonly 'properties': ExtractProperties<TSchema> & { readonly [K in keyof TAdditional]: TAdditional[K] };
};

export interface IntersectionSchema<
  TSchemas extends readonly JSONSchema[],
  TId extends string
> {
  readonly '$id': TId;
  readonly 'allOf': TSchemas;
}

export interface DiscriminatedUnionSchema<
  TDiscriminator extends string,
  TVariants extends readonly JSONSchema[],
  TId extends string
> {
  readonly '$id': TId;
  readonly 'discriminator': { readonly 'propertyName': TDiscriminator };
  readonly 'oneOf': TVariants;
}

export type PartialSchema<TSchema, TId extends string>
  = Omit<TSchema, '$id' | 'required'> & { readonly '$id': TId };

export type RequiredSchema<TSchema, TId extends string>
  = Omit<TSchema, '$id' | 'required'> & {
    readonly '$id': TId;
    readonly 'required': ReadonlyArray<keyof ExtractProperties<TSchema>>;
  };

export interface PickSchema<
  TSchema,
  TKeys extends string,
  TId extends string
> {
  readonly '$id': TId;
  readonly 'properties': Pick<ExtractProperties<TSchema>, keyof ExtractProperties<TSchema> & TKeys>;
  readonly 'required': ReadonlyArray<ExtractRequired<TSchema> & TKeys>;
  readonly 'type': 'object';
}

export interface OmitSchema<
  TSchema,
  TKeys extends string,
  TId extends string
> {
  readonly '$id': TId;
  readonly 'properties': Omit<ExtractProperties<TSchema>, TKeys>;
  readonly 'required': ReadonlyArray<Exclude<ExtractRequired<TSchema>, TKeys>>;
  readonly 'type': 'object';
}
