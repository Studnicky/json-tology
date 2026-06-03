import type {
  EmailBrandInterface, UuidBrandInterface
} from '../../../src/types/index.js';
import { JsonTology } from '../../../src/index.js';

const EmailSchema = {
  '$id': 'urn:brands:Email',
  'format': 'email',
  'type': 'string'
} as const;
const UuidSchema = {
  '$id': 'urn:brands:Uuid',
  'format': 'uuid',
  'type': 'string'
} as const;

const jt = JsonTology.create({
  'baseIRI': 'urn:brands:',
  'enableStrictGraph': false,
  'schemas': [
    EmailSchema,
    UuidSchema
  ]
});

// Only values produced by the validation API carry the named format brand.
const email: EmailBrandInterface = jt.instantiate(EmailSchema.$id, 'bastian@bookstore.example');
const uuid: UuidBrandInterface = jt.instantiate(UuidSchema.$id, '550e8400-e29b-41d4-a716-446655440000');

console.log('EmailBrandInterface value:', email);
console.log('UuidBrandInterface value:', uuid);
