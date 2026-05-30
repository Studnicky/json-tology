/**
 * enableInlineWarnings — gentle nudges at registration time.
 *
 * With `enableInlineWarnings: true`, the registry emits `logger.warn` when
 * an inline-object or inline-primitive shape is found. No throws — registration
 * still succeeds. Requires a logger to be set.
 *
 * Use when you want passive feedback during development without breaking builds.
 *
 * Demonstrates: inline shape registers silently without a logger; with a
 * logger the warning fires but registration succeeds.
 */

import { SchemaRegistry } from '../../../src/modules/registry/SchemaRegistry.js';

// A schema with an inline constrained shape on `isbn`
const BookWithInlineIsbn = {
  '$id': 'urn:bookstore:BookInlineWarning',
  'properties': {
    'isbn': {
      // inline constraint — would warn
      'pattern': '^\\d{13}$',
      'type': 'string'
    },
    'title': { 'type': 'string' }
  },
  'type': 'object'
} as const;

const warnings: string[] = [];

// Provide a minimal logger to capture warn calls
const noop = (): void => {
  /* ignore */
};

// enableStrictGraph: false — this example demonstrates warn-only mode where
// inline shapes are accepted (not thrown); strict checking is off so the
// warning path is exercised instead.
const registry = new SchemaRegistry({
  'enableInlineWarnings': true,
  'enableStrictGraph': false,
  'logger': {
    'debug': noop,
    'error': noop,
    'fatal': noop,
    'info': noop,
    'trace': noop,
    'warn': (msg: string) => {
      warnings.push(msg);
    }
  }
});

// Registration succeeds — no throw in warning mode
registry.set(BookWithInlineIsbn);

console.assert(
  registry.has(BookWithInlineIsbn.$id),
  'schema registered despite inline shape (warn-only mode)'
);

// At least one warning was emitted for the inline isbn shape
console.assert(
  warnings.length > 0,
  'logger.warn was called for the inline constrained shape'
);

console.log('enableInlineWarnings: registered:', registry.has(BookWithInlineIsbn.$id), '| warnings emitted:', warnings.length);
