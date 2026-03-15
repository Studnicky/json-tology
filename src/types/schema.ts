import type { InferSchemaType } from './infer.js';

export type { InferSchemaType } from './infer.js';
export type { JSONSchema7Definition as JSONSchemaType } from 'json-schema';

/**
 * Primary type alias — derive a TypeScript type from a JSON Schema.
 *
 * @example
 * type User = Infer<typeof UserSchema>;
 */
export type InferType<TSchema, TReferences = {}> = InferSchemaType<TSchema, TSchema, TReferences>;

/** Alias kept for backward compatibility with BaseTypes and older code. */
export type Infer<TSchema, TReferences = {}> = InferSchemaType<TSchema, TSchema, TReferences>;
