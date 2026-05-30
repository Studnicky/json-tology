/**
 * SchemaError constructor — the options-bag argument convention.
 *
 * `code` and `message` are required positionals; `schemaId` and `cause`
 * travel in the trailing options bag. The code values come from the
 * exported `SchemaErrorCode` map.
 */

import {
  SchemaError, SchemaErrorCode
} from '../../../src/index.js';

const schemaId = 'urn:bookstore:Order';
const cause = new Error('vocabulary not registered');

const missingId = new SchemaError(SchemaErrorCode.MISSING_ID, 'schema is missing $id');
const structure = new SchemaError(SchemaErrorCode.STRUCTURE_INVALID, 'invalid structure', { schemaId });
const dialect = new SchemaError(SchemaErrorCode.DIALECT_UNSUPPORTED, 'unsupported dialect', {
  cause,
  schemaId
});

console.assert(missingId.code === 'SCHEMA_MISSING_ID');
console.assert(structure.schemaId === schemaId);
console.assert(dialect.cause === cause);
