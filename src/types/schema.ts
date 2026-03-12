import type { InferSchemaType } from './infer.js';

export type { JSONSchema7Definition as JSONSchemaType } from 'json-schema';
export type { InferSchemaType } from './infer.js';

/**
 * Primary type alias — derive a TypeScript type from a JSON Schema.
 *
 * @example
 * type User = Infer<typeof UserSchema>;
 */
export type InferType<TSchema> = InferSchemaType<TSchema>;
