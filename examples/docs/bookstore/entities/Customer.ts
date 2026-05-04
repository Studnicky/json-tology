import { CustomerIdSchema } from './CustomerId.js';
import { EmailSchema } from './Email.js';
import { PersonNameSchema } from './PersonName.js';

export const CustomerSchema = {
  '$id': 'urn:bookstore:Customer',
  'properties': {
    'addresses': {
      'default': [],
      'items': { '$ref': 'urn:bookstore:Address' },
      'type': 'array'
    },
    'email': { '$ref': EmailSchema.$id },
    'id': { '$ref': CustomerIdSchema.$id },
    'name': { '$ref': PersonNameSchema.$id }
  },
  'required': [
    'id',
    'email',
    'name'
  ],
  'type': 'object'
} as const;
