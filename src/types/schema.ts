import type { InferSchema } from './infer.js';

export type { JSONSchema } from './json-schema.js';
export type { InferSchema } from './infer.js';

/**
 * Primary type alias — derive a TypeScript type from a JSON Schema.
 *
 * @example
 * type User = Infer<typeof UserSchema>;
 */
export type Infer<TSchema> = InferSchema<TSchema>;
