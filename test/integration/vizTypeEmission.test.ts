/**
 * End-to-end integration test: TypeStringEmitter real emission through VizDataCollector.
 *
 * Exercises the full public path: JsonTology.create → VizDataCollector.collect() →
 * payload.schemas[].typescript — asserting that TypeStringEmitter.emit() derives
 * real structural types, not the old stub form `Record<string, unknown>`.
 */

import assert from 'node:assert/strict';
import {
  describe, it
} from 'node:test';
import { JsonTology } from '../../src/index.js';
import { VizDataCollector } from '../../src/modules/viz/VizDataCollector.js';

// ---------------------------------------------------------------------------
// Fixture: bookstore Book schema
//   - required string property: title
//   - optional property: subtitle (string)
//   - array property: tags (string[])
//   - enum property: format ('hardcover' | 'paperback' | 'ebook')
// ---------------------------------------------------------------------------

const BookSchema = {
  '$id': 'https://bookstore.io/Book',
  'properties': {
    'format': {
      'enum': [
        'hardcover',
        'paperback',
        'ebook'
      ]
    },
    'subtitle': { 'type': 'string' },
    'tags': {
      'items': { 'type': 'string' },
      'type': 'array'
    },
    'title': { 'type': 'string' }
  },
  'required': ['title'],
  'type': 'object'
} as const;

function makeBookTology(): ReturnType<typeof JsonTology.create> {
  return JsonTology.create({
    'baseIri': 'https://bookstore.io',
    'schemas': [BookSchema]
  });
}

function findBookEntry(tology: ReturnType<typeof JsonTology.create>) {
  const collector = new VizDataCollector(tology.registry);
  const payload = collector.collect();

  return payload.schemas.find((schemaEntry) => {
    return schemaEntry.id === 'https://bookstore.io/Book';
  });
}

void describe('VizDataCollector → TypeStringEmitter real emission', () => {
  void it('renders required string property with its primitive type', () => {
    const entry = findBookEntry(makeBookTology());

    assert.ok(entry !== undefined, 'Book schema entry should be present');

    const { typescript } = entry;

    assert.ok(
      typescript.includes('Book'),
      `typescript should contain the derived type name "Book"; got:\n${typescript}`
    );

    // Required property must appear without `?`
    assert.ok(
      /title:\s*string/u.test(typescript),
      `required "title" should render as "title: string"; got:\n${typescript}`
    );
  });

  void it('renders optional property with ? modifier', () => {
    const entry = findBookEntry(makeBookTology());

    assert.ok(entry !== undefined, 'Book schema entry should be present');

    const { typescript } = entry;

    // Optional property must include `?:`
    assert.ok(
      typescript.includes('subtitle?:'),
      `optional "subtitle" should render with "subtitle?:"; got:\n${typescript}`
    );
  });

  void it('renders array property as T[]', () => {
    const entry = findBookEntry(makeBookTology());

    assert.ok(entry !== undefined, 'Book schema entry should be present');

    const { typescript } = entry;

    // Array property must render as string[]
    assert.ok(
      /tags\?:\s*string\[\]/u.test(typescript),
      `optional array "tags" should render as "tags?: string[]"; got:\n${typescript}`
    );
  });

  void it('renders enum property as a union of string literals', () => {
    const entry = findBookEntry(makeBookTology());

    assert.ok(entry !== undefined, 'Book schema entry should be present');

    const { typescript } = entry;

    // Enum renders as union of quoted string literals
    assert.ok(
      typescript.includes('"hardcover"'),
      `enum should include literal "hardcover"; got:\n${typescript}`
    );
    assert.ok(
      typescript.includes('"paperback"'),
      `enum should include literal "paperback"; got:\n${typescript}`
    );
    assert.ok(
      typescript.includes('"ebook"'),
      `enum should include literal "ebook"; got:\n${typescript}`
    );
    assert.ok(
      typescript.includes('|'),
      `enum should render as union (|); got:\n${typescript}`
    );
  });

  void it('does not emit the old stub form for a structured schema', () => {
    const entry = findBookEntry(makeBookTology());

    assert.ok(entry !== undefined, 'Book schema entry should be present');

    const { typescript } = entry;

    // The old stub returned `type X = Record<string, unknown>;` for everything.
    // A structured schema with declared properties must NOT match the stub form.
    assert.ok(
      typescript !== 'type Book = Record<string, unknown>;',
      `typescript must not equal the old stub output; got:\n${typescript}`
    );
    assert.ok(
      !typescript.includes('Record<string, unknown>'),
      `structured schema must not contain "Record<string, unknown>"; got:\n${typescript}`
    );
  });
});

// ---------------------------------------------------------------------------
// Fixture: $ref to nested schema — verifies termination and structural render
// ---------------------------------------------------------------------------

const AuthorSchema = {
  '$id': 'https://bookstore.io/Author',
  'properties': { 'name': { 'type': 'string' } },
  'required': ['name'],
  'type': 'object'
} as const;

const BookWithAuthorSchema = {
  '$id': 'https://bookstore.io/Book',
  'properties': {
    'author': { '$ref': 'https://bookstore.io/Author' },
    'title': { 'type': 'string' }
  },
  'required': ['title'],
  'type': 'object'
} as const;

void describe('VizDataCollector → TypeStringEmitter $ref and nested object', () => {
  void it('renders a $ref property as the target type name without infinite loop', () => {
    const tology = JsonTology.create({
      'baseIri': 'https://bookstore.io',
      'schemas': [
        AuthorSchema,
        BookWithAuthorSchema
      ]
    });

    const collector = new VizDataCollector(tology.registry);
    // Must not throw or hang — completes synchronously
    const payload = collector.collect();

    const bookEntry = payload.schemas.find((schemaEntry) => {
      return schemaEntry.id === 'https://bookstore.io/Book';
    });

    assert.ok(bookEntry !== undefined, 'Book schema entry should be present');

    const { 'typescript': bookTs } = bookEntry;

    assert.ok(
      bookTs.includes('Book'),
      `Book typescript should contain "Book"; got:\n${bookTs}`
    );

    // $ref property must render as the target type name, not the stub
    assert.ok(
      bookTs.includes('Author'),
      `$ref to Author should render as "Author" in the type body; got:\n${bookTs}`
    );

    // The Author schema's own typescript should also be structurally rendered
    const authorEntry = payload.schemas.find((schemaEntry) => {
      return schemaEntry.id === 'https://bookstore.io/Author';
    });

    assert.ok(authorEntry !== undefined, 'Author schema entry should be present');

    const { 'typescript': authorTs } = authorEntry;

    assert.ok(
      authorTs.includes('Author'),
      `Author typescript should contain "Author"; got:\n${authorTs}`
    );
    assert.ok(
      /name:\s*string/u.test(authorTs),
      `Author's required "name" should render as "name: string"; got:\n${authorTs}`
    );
  });
});
