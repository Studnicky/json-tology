import type {
  FromSchema, JSONSchema
} from 'json-schema-to-ts';

/**
 * Derive a TypeScript type from a JSON Schema.
 *
 * @deprecated Use `Infer<T>` instead.
 * @example
 * type User = InferSchema<typeof UserSchema>; // prefer: Infer<typeof UserSchema>
 */
export type InferSchema<TSchema extends JSONSchema> = FromSchema<TSchema>;

/** Detect `any` — produces `true` when T is `any`, `false` otherwise. */
type IsAny<T> = 0 extends (1 & T) ? true : false;

/**
 * Primary type alias — derive a TypeScript type from a JSON Schema.
 *
 * Falls back to `unknown` when the schema type is too broad to infer
 * a concrete type (e.g., the generic `JSONSchema` union), ensuring
 * implementations never accidentally return `any`.
 *
 * @example
 * type User = Infer<typeof UserSchema>;
 */
export type Infer<TSchema extends JSONSchema>
  = IsAny<FromSchema<TSchema>> extends true ? unknown : FromSchema<TSchema>;
