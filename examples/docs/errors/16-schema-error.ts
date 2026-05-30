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

try {
  // invalid-input edge: schema literal intentionally omits `$id` to trigger the
  // SCHEMA_MISSING_ID runtime guard. `create` requires `$id` at the type level;
  // the cast simulates untyped data (e.g. a schema loaded from disk) crossing
  // the registration boundary — no typed path exists for this negative test.
  JsonTology.create({
    'baseIRI': 'https://bookstore.example',
    'schemas': [{ 'type': 'object' }] as unknown as readonly [{ readonly '$id': string }]
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
