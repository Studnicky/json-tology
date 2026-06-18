/**
 * SchemaError — registration / structural problems.
 *
 * A schema literal missing `$id` cannot be registered. The thrown
 * SchemaError carries the `SCHEMA_MISSING_ID` code; `schemaId` is
 * undefined because the offending schema has no identifier yet.
 */

import {
  JsonTology, SchemaError
} from '../../../src/index.js';

// invalid-input edge: a schema loaded from an untyped source (disk, network)
// arrives as `unknown` — no compile-time `$id` guarantee. Narrowing it at the
// registration boundary triggers the SCHEMA_MISSING_ID runtime guard, the
// negative path `create`'s typed signature would otherwise forbid.
const fromDisk: unknown = { 'type': 'object' };

try {
  JsonTology.create({
    'baseIri': 'https://bookstore.example',
    'schemas': [fromDisk as { readonly '$id': string }]
  });
} catch (error) {
  if (error instanceof SchemaError) {
    console.assert(error.code === 'SCHEMA_MISSING_ID');
    console.assert(error.schemaId === undefined);

    console.log('error.code:', error.code);
    console.log('error.message:', error.message);
    console.log('error.schemaId:', error.schemaId);
  }
}
