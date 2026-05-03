import type { InferSchemaType } from './Infer.js';

/**
 * Derive the TypeScript wire type from a JSON Schema.
 *
 * @example
 * type User = InferType<typeof UserSchema>;
 */
export type InferType<TSchema, TReferences = Record<never, never>> = InferSchemaType<TSchema, TSchema, TReferences>;

export type JsonSchemaType = boolean | Record<string, unknown>;
