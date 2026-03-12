/**
 * Types Module
 *
 * Exports base types, container interfaces, schema factory functions,
 * and all type aliases used across the library.
 */

// Keep existing BaseTypes
export {
  BaseTypes, makePageSchema, makeResponseSchema, makeResultSchema
} from './BaseTypes.js';
export type * from './brand.js';
export type * from './compose.js';
export type * from './errors.js';
export type * from './json-schema.js';
export type * from './infer.js';
export type * from './schema.js';

export type * from './transform.js';
