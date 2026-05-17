import { bookstoreEntities } from '../bookstore/index.js';

const syntheticId = bookstoreEntities.registerAnonymous({
  'properties': {
    'couponCode': { 'type': 'string' },
    'discount': {
      'maximum': 1,
      'minimum': 0,
      'type': 'number'
    }
  },
  'required': [
    'couponCode',
    'discount'
  ],
  'type': 'object'
});

console.assert(syntheticId.startsWith('urn:json-tology:hash:'), 'Synthetic ID should be hash-based');

const result = bookstoreEntities.validate(syntheticId, {
  'couponCode': 'SAVE10',
  'discount': 0.1
});

console.assert(result.ok, 'Valid coupon should pass');

const invalid = bookstoreEntities.validate(syntheticId, { 'couponCode': 'SAVE10' });

console.assert(!invalid.ok, 'Missing discount should fail');
