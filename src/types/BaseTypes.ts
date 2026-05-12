/**
 * Base Types — type aliases only.
 *
 * Runtime schema data and factory methods live in `src/modules/data/BaseTypes.ts`.
 */

// Re-export the runtime `BaseTypes` object so existing consumers of
// `src/types/BaseTypes.js` that import the value still work.
export { BaseTypes } from '../modules/data/BaseTypes.js';
