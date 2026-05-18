/**
 * Custom fs loader — read schemas from disk via node:fs/promises.
 *
 * Any function with signature `(iri: string) => Promise<JsonSchemaType | null>`
 * is a valid loader. This example uses `node:fs/promises` to resolve a known
 * bookstore IRI to the on-disk entity file that backs it.
 *
 * In a real setup the loader would serve a directory of JSON Schema files;
 * here we check file accessibility so the example runs without hitting the
 * real filesystem schema layout.
 *
 * Demonstrates: custom loader function, `null` on miss, Node fs pattern.
 */

import { access } from 'node:fs/promises';
import {
  join,
  resolve
} from 'node:path';

import {
  CustomerSchema,
  IsbnSchema
} from '../bookstore/index.js';

// Directory where hypothetical on-disk schemas live (relative to this file)
const SCHEMA_DIR = resolve(import.meta.dirname, '../bookstore/entities');

/**
 * Loader: maps schema IRI to a `.ts` file in the entities directory.
 * Returns `null` for IRIs that do not resolve to an on-disk file.
 */
const fsLoader = async (iri: string): Promise<null | Record<string, unknown>> => {
  // Map urn:bookstore:<Name> → entities/<Name>.ts
  const name = iri.replace('urn:bookstore:', '');
  const filename = join(SCHEMA_DIR, `${name}.ts`);

  try {
    await access(filename);

    // Return a minimal shape so the resolver can follow $id links
    return { '$id': iri };
  } catch {
    return null;
  }
};

// Loader resolves a known schema IRI to a non-null stub
const customerResult = await fsLoader(CustomerSchema.$id);

console.assert(customerResult !== null, 'known schema IRI resolves via fs loader');
console.assert(
  customerResult !== null && customerResult.$id === CustomerSchema.$id,
  'resolved stub carries correct $id'
);

// Isbn.ts exists in the entities dir — also resolves
const isbnResult = await fsLoader(IsbnSchema.$id);

console.assert(isbnResult !== null, 'Isbn entity file resolves');

// Unknown IRI returns null without throwing
const unknown = await fsLoader('urn:bookstore:NoSuchThing');

console.assert(unknown === null, 'unknown IRI returns null');
