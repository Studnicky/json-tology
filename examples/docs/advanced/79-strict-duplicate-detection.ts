/**
 * enableDuplicateDetection — auto-run findDuplicates after each registration.
 *
 * With `enableDuplicateDetection: true`, the registry runs `findDuplicates()`
 * after each schema is registered and emits `logger.warn` if duplicates are
 * found. Useful for continuous detection of regressions after some schemas
 * have already been extracted to named types.
 *
 * Demonstrates: two structurally identical ISBN shapes cause a duplicate
 * warning; `findDuplicates()` returns the pair.
 */

import { SchemaRegistry } from '../../../src/modules/registry/SchemaRegistry.js';

// The canonical named ISBN primitive
const IsbnSchema = {
  '$id': 'urn:bookstore:Isbn',
  'pattern': '^\\d{13}$',
  'type': 'string'
} as const;

// A schema that inlines the same ISBN constraint instead of $ref-ing IsbnSchema
const BookWithInlineIsbn = {
  '$id': 'urn:bookstore:BookDuplicateDetection',
  'properties': {
    'isbn': {
      // structurally identical to IsbnSchema
      'pattern': '^\\d{13}$',
      'type': 'string'
    },
    'title': { 'type': 'string' }
  },
  'type': 'object'
} as const;

const warnings: string[] = [];

const noop = (): void => {
  /* ignore */
};

// enableStrictGraph: false — this example demonstrates duplicate-detection warn
// mode where inline shapes are accepted (not thrown); strict checking is off
// so the duplicate-detection warning path is exercised instead of throwing.
const registry = new SchemaRegistry({
  'enableDuplicateDetection': true,
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

registry.set(IsbnSchema);
// triggers duplicate detection
registry.set(BookWithInlineIsbn);

// At least one warning was emitted for the duplicated inline shape
console.assert(
  warnings.length > 0,
  'duplicate detection emits logger.warn for structurally identical inline shape'
);

// Manual findDuplicates() confirms the same result
const duplicates = registry.findDuplicates();

console.assert(duplicates.length > 0, 'findDuplicates returns the inline duplicate pair');
console.assert(
  duplicates[0].equivalentTo === IsbnSchema.$id,
  'duplicate points back to the named IsbnSchema'
);
