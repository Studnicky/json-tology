/**
 * Curie anti-pattern — expanding a prefix that is not registered.
 *
 * `expand` on an unknown prefix returns the input unchanged rather than
 * throwing. This silently produces a syntactically invalid IRI. Always
 * register every prefix you intend to expand.
 *
 * Demonstrates: unknown-prefix expand returns input unchanged (anti-pattern
 * vs. correct pattern).
 */

import { Curie } from '../../../src/index.js';

// Anti-pattern: only the bk prefix is registered
const curieMissingSchema = new Curie({ 'bk': 'https://bookstore.example/' });
const unexpanded = curieMissingSchema.expand('schema:Book');

// expand returns the input unchanged — not a valid IRI
console.assert(
  unexpanded === 'schema:Book',
  'unknown prefix: expand returns input unchanged (not a valid IRI)'
);

// Correct pattern: register all prefixes before expanding
const curieWithSchema = new Curie({
  'bk': 'https://bookstore.example/',
  'schema': 'https://schema.org/'
});

console.assert(
  curieWithSchema.expand('schema:Book') === 'https://schema.org/Book',
  'registered prefix: expand resolves to full IRI'
);
