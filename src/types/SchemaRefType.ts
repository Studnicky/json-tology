/**
 * SchemaRefType — universal schema reference accepted by every facade method.
 *
 * Methods that previously accepted only an ID string or only a schema object
 * now accept both forms. Resolution: if string, look up in the registry;
 * if object, register-and-use directly.
 *
 * @example
 * // String ID form
 * entities.instantiate(UserSchema.$id, data);
 *
 * // Schema object form
 * entities.instantiate(UserSchema, data);
 */
export type SchemaRefType<TRefs = Record<never, never>>
  = | (keyof TRefs & string)
  | (Record<string, unknown> & { readonly '$id': string });
