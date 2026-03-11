/**
 * Types Module
 *
 * Exports base types, container interfaces, schema factory functions,
 * and all type aliases used across the library.
 */

export * from './schema.js';
export * from './transform.js';
export * from './brand.js';
export * from './compose.js';
export * from './errors.js';

// Keep existing BaseTypes
export { BaseTypes, makeResponseSchema, makeResultSchema, makePageSchema } from './BaseTypes.js';
