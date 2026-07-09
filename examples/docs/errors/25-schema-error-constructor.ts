/**
 * SchemaError constructor — the standard Error(message, options) convention.
 *
 * `message` is the required positional. `code`, `schemaId`, and `cause`
 * travel in the required options bag. The code values come from the
 * exported `SCHEMA_ERROR_CODE` map.
 */

import {
  SCHEMA_ERROR_CODE, SchemaError
} from '../../../src/index.js';

const schemaId = 'urn:bookstore:Order';
const cause = new Error('vocabulary not registered');

const missingId = new SchemaError('schema is missing $id', { 'code': SCHEMA_ERROR_CODE.MISSING_ID });
const structure = new SchemaError('invalid structure', {
  'code': SCHEMA_ERROR_CODE.STRUCTURE_INVALID,
  schemaId
});
const dialect = new SchemaError('unsupported dialect', {
  cause,
  'code': SCHEMA_ERROR_CODE.DIALECT_UNSUPPORTED,
  schemaId
});

console.assert(missingId.code === 'SCHEMA_MISSING_ID');
console.assert(structure.schemaId === schemaId);
console.assert(dialect.cause === cause);

console.log('missingId.code:', missingId.code);
console.log('structure.schemaId:', structure.schemaId);
console.log('dialect.cause.message:', dialect.cause?.message);
