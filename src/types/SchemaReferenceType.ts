/**
 * SchemaReferenceType — universal schema reference accepted by every facade method.
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
// `keyof TReferences & string` is a compile-time-only generic key lookup over a
// type parameter — a type-level computation with no runtime shape, so it cannot
// be expressed as schema-derived data or as a behavioral interface (interfaces
// cannot declare a union type).
export type SchemaReferenceType<TReferences = Record<never, never>>
  = | (keyof TReferences & string)
  | (Record<string, unknown> & { '$id': string });
