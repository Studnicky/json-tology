/**
 * Format brands — Email resolves to a branded string type.
 *
 * With `formatBrands: true` (the default), `InferType` on a
 * `format: 'email'` schema produces `string & FormatBrandInterface<'email'>`.
 * Plain strings cannot satisfy the branded type — values must come
 * through the validation API.
 */

import { JsonTology } from '../../../src/index.js';
import type { InferType } from '../../../src/types/index.js';

const EmailSchema = {
  '$id': 'urn:brands:Email',
  'format': 'email',
  'type': 'string'
} as const;

type Email = InferType<typeof EmailSchema>;
// Email: string & FormatBrandInterface<'email'>

const jt = JsonTology.create({
  'baseIRI': 'urn:brands:',
  'enableStrictGraph': false,
  'schemas': [EmailSchema]
});

const email: Email = jt.instantiate(EmailSchema.$id, 'bastian@bookstore.example');

console.log('Email (format brand):', email);
console.log('Email is string:', typeof email === 'string');
