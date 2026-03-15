/** Extract the union of required field names from a schema's `required` array. */
export type ExtractRequiredType<T>
  = T extends { readonly 'required': ReadonlyArray<infer R extends string> } ? R : never;

/** Extract the properties map from a schema, or an empty record if absent. */
export type ExtractPropertiesType<T>
  = T extends { readonly 'properties': infer P extends Record<string, unknown> }
    ? P
    : Record<string, never>;

export type ExtendSchemaType<
  TSchema extends Record<string, unknown>,
  TAdditional extends Record<string, unknown>,
  TId extends string
> = Omit<TSchema, '$id' | 'properties'> & {
  readonly '$id': TId;
  readonly 'properties': ExtractPropertiesType<TSchema> & { readonly [K in keyof TAdditional]: TAdditional[K] };
};

export type PartialSchemaType<TSchema, TId extends string>
  = Omit<TSchema, '$id' | 'required'> & { readonly '$id': TId };

export type RequiredSchemaType<TSchema, TId extends string>
  = Omit<TSchema, '$id' | 'required'> & {
    readonly '$id': TId;
    readonly 'required': ReadonlyArray<keyof ExtractPropertiesType<TSchema>>;
  };
