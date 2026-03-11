import type { FromSchema, JSONSchema } from 'json-schema-to-ts';

/**
 * Derive a TypeScript type from a JSON Schema.
 *
 * @deprecated Use `Infer<T>` instead.
 * @example
 * type User = InferSchema<typeof UserSchema>; // prefer: Infer<typeof UserSchema>
 */
export type InferSchema<TSchema extends JSONSchema> = FromSchema<TSchema>;

/**
 * Primary type alias — derive a TypeScript type from a JSON Schema.
 *
 * @example
 * type User = Infer<typeof UserSchema>;
 */
export type Infer<TSchema extends JSONSchema> = FromSchema<TSchema>;
