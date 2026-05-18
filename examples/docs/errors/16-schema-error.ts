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
  // doc example with synthetic fixture schemas (strict-graph default does not throw because no inline duplicates)
  JsonTology.create({
    'baseIRI': 'https://bookstore.example',
    'schemas': [{ 'type': 'object' }] as const
  });
} catch (error) {
  if (error instanceof SchemaError) {
    console.assert(error.code === 'SCHEMA_MISSING_ID');
    console.assert(error.schemaId === undefined);
  }
}
