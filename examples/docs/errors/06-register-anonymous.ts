import {
  createBookstoreDocRegistry
} from '../bookstore/index.js';

// createBookstoreDocRegistry seeds a permissive copy of the bookstore — docs examples extend
// it with ad-hoc demo schemas; strict-graph checking is intentionally off here.
const jt = createBookstoreDocRegistry();

const syntheticId = jt.registerAnonymous({
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

// registerAnonymous returns a runtime-computed hash ID that is not part of the
// registry's compile-time schema-ID union, so validate by passing the ID
// through the underlying registry (which accepts an arbitrary string).
const result = jt.registry.validate(syntheticId, {
  'couponCode': 'SAVE10',
  'discount': 0.1
});

console.assert(result.ok, 'Valid coupon should pass');

const invalid = jt.registry.validate(syntheticId, { 'couponCode': 'SAVE10' });

console.assert(!invalid.ok, 'Missing discount should fail');
