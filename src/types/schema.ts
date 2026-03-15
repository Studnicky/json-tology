import type { InferSchemaType } from './infer.js';

export type { InferSchemaType } from './infer.js';
export type { JSONSchema7Definition as JSONSchemaType } from 'json-schema';

/**
 * Primary type alias — derive a TypeScript type from a JSON Schema.
 *
 * @example
 * type User = Infer<typeof UserSchema>;
 */
// eslint-disable-next-line @typescript-eslint/no-empty-object-type
export type InferType<TSchema, TReferences = {}> = InferSchemaType<TSchema, TSchema, TReferences>;

/** Alias kept for backward compatibility with BaseTypes and older code. */
// eslint-disable-next-line @typescript-eslint/no-empty-object-type
export type Infer<TSchema, TReferences = {}> = InferSchemaType<TSchema, TSchema, TReferences>;
