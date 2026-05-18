/**
 * Loaders.fetch — universal HTTP loader with base URL and header options.
 *
 * `Loaders.fetch` uses `globalThis.fetch` and works in Node ≥ 18, Bun,
 * Deno, and browsers. Options:
 * - No options: fetches the IRI directly.
 * - `base`: resolves relative IRIs against the base URL.
 * - `init`: passes RequestInit overrides (headers, credentials, etc.).
 *
 * Demonstrates: Loaders.fetch is callable with all three option shapes;
 * all three return a valid LoaderType function.
 */

import { Loaders } from '../../../src/index.js';

// No options — fetch from the IRI directly
const direct = Loaders.fetch();

// With base URL — resolve relative IRIs against the base
const withBase = Loaders.fetch({ 'base': 'https://schemas.example/v1/' });

// With RequestInit — add auth headers
const withHeaders = Loaders.fetch({ 'init': { 'headers': { 'X-Api-Key': 'demo-key' } } });

// All three produce LoaderType functions
console.assert(typeof direct === 'function', 'Loaders.fetch() returns a function');
console.assert(typeof withBase === 'function', 'Loaders.fetch({ base }) returns a function');
console.assert(typeof withHeaders === 'function', 'Loaders.fetch({ init }) returns a function');
