import {
  InstantiationError, JsonTology
} from '../../../src/index.js';

const AddressSchema = {
  '$id': 'https://bookstore.example/Address',
  'properties': {
    'city': { 'type': 'string' },
    'country': {
      'default': 'US',
      'type': 'string'
    },
    'postalCode': { 'type': 'string' },
    'street': { 'type': 'string' }
  },
  'required': [
    'street',
    'city',
    'postalCode'
  ],
  'type': 'object'
} as const;

const jt = JsonTology.create({
  'baseIRI': 'https://bookstore.example',
  'schemas': [AddressSchema] as const
});

const jt2 = jt.set(AddressSchema);

const address = jt2.instantiate(AddressSchema.$id, {
  'city': 'Bookham',
  'extra': 'ignored', // stripped
  'postalCode': '94107',
  'street': '12 Elm Lane'
  // country omitted  - default 'US' applied
});

// { street: '12 Elm Lane', city: 'Bookham', postalCode: '94107', country: 'US' }
console.assert(address.country === 'US');
void 0 as unknown as typeof address;
