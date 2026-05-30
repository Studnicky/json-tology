/**
 * Per-entity file convention — one file per $id segment.
 *
 * The bookstore entities directory follows the one-file-per-schema convention:
 * each `$id` segment maps to a single file. Imports always reference the
 * defining file directly, never a barrel. This makes the schema graph explicit
 * at the import level.
 *
 * Demonstrates: using the per-entity imports from the bookstore to construct
 * a minimal registry — each entity comes from its own canonical file.
 */

import { SchemaRegistry } from '../../../src/modules/registry/SchemaRegistry.js';
import { AuthorNameSchema } from '../bookstore/entities/AuthorName.js';
import { IsbnSchema } from '../bookstore/entities/Isbn.js';
import { TitleSchema } from '../bookstore/entities/Title.js';
import { BookSchema } from '../bookstore/entities/Book.js';

// Each entity is imported from its canonical file — one schema per file
const registry = new SchemaRegistry();

registry.set(IsbnSchema);
registry.set(AuthorNameSchema);
registry.set(TitleSchema);
registry.set(BookSchema);

// The registry has all four named entities
console.assert(registry.has(IsbnSchema.$id), 'Isbn registered from its own file');
console.assert(registry.has(TitleSchema.$id), 'Title registered from its own file');
console.assert(registry.has(BookSchema.$id), 'Book registered from its own file');

// No inline duplicates — all refs point at named schemas
const duplicates = registry.findDuplicates();

console.assert(
  duplicates.length === 0,
  'per-entity file convention produces zero inline duplicates'
);

console.log('Per-entity file: registry size:', registry.size, '| duplicates:', duplicates.length);
