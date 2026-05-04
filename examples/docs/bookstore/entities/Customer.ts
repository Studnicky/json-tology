import { CustomerIdSchema } from './CustomerId.js';
import { CustomerNameSchema } from './CustomerName.js';
import { EmailSchema } from './Email.js';

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
    'name': { '$ref': CustomerNameSchema.$id }
  },
  'required': [
    'id',
    'email',
    'name'
  ],
  'type': 'object'
} as const;
