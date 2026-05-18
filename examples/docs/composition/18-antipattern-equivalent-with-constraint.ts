/**
 * Compose.equivalent — Anti-pattern 1: Adding a constraint to an alias
 *
 * Equivalent expresses class identity. Adding a constraint makes the
 * new schema structurally different from the source, so equivalent is
 * semantically wrong. Use `Compose.extend` (or a standalone schema)
 * when the alias adds a constraint.
 */

import { Compose } from '../../../src/index.js';
import { IsbnSchema } from '../bookstore/index.js';

// ✓ Do this — extend layers the additional pattern on top of Isbn.
const Isbn978Schema = Compose.extend(
  IsbnSchema,
  { 'pattern': '^978' } as const,
  'https://bookstore.example/Isbn978'
);

const isbn978Id: string = Isbn978Schema.$id;

console.assert(isbn978Id.endsWith('Isbn978'));
