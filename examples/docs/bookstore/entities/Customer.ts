import { AddressSchema } from './Address.js';
import { CustomerIdSchema } from './CustomerId.js';
import { CustomerNameSchema } from './CustomerName.js';
import { EmailSchema } from './Email.js';

export const CustomerSchema = {
  '$id': 'urn:bookstore:Customer',
  'properties': {
    'addresses': {
      'default': [],
      'items': { '$ref': AddressSchema.$id },
      'type': 'array'
    },
    // inverseFunctional: true — each Customer ID (UUID) uniquely identifies at
    // most one Customer individual. No two distinct customers share the same id.
    // OWL 2: owl:InverseFunctionalProperty on customerId.
    'customerId': {
      '$ref': CustomerIdSchema.$id,
      'inverseFunctional': true
    },
    'email': { '$ref': EmailSchema.$id },
    'name': { '$ref': CustomerNameSchema.$id }
  },
  'required': [
    'customerId',
    'email',
    'name'
  ],
  'type': 'object'
} as const;
