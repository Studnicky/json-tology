import type { InferSchemaType } from './infer.js';

/**
 * Derive the TypeScript wire type from a JSON Schema.
 *
 * @example
 * type User = InferType<typeof UserSchema>;
 */
// eslint-disable-next-line @typescript-eslint/no-empty-object-type
export type InferType<TSchema, TReferences = {}> = InferSchemaType<TSchema, TSchema, TReferences>;

export type JsonSchemaType = boolean | Record<string, unknown>;
