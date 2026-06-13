/**
 * Class hydration — composing multiple class transforms
 *
 * When you want to hydrate nested data structures with multiple
 * class types, encode each class separately using its transform,
 * then compose them. Each class is the wire side of its schema:
 * the class defines the interface, decode lowers it to JSON, and
 * encode lifts JSON back to the class.
 *
 * This pattern works when the transforms are registered on
 * `Compose.equivalent` siblings so the canonical schemas keep
 * their plain wire-shape behaviour elsewhere.
 */

import type { UnbrandType } from '../../../src/types/index.js';
import {
  Compose
} from '../../../src/index.js';
import {
  aboxFixtures, createBookstoreDocRegistry,
  CustomerSchema
} from '../bookstore/index.js';

// createBookstoreDocRegistry seeds a permissive copy of the bookstore — docs examples extend
// it with ad-hoc demo schemas; strict-graph checking is intentionally off here.
const jt = createBookstoreDocRegistry();

// The canonical (brand-free) Customer shape
type CustomerWire = UnbrandType<typeof aboxFixtures.customer>;

class CustomerRecord {
  declare public addresses: CustomerWire['addresses'];
  declare public customerId: CustomerWire['customerId'];
  declare public email: CustomerWire['email'];
  declare public name: CustomerWire['name'];

  public greet(): string {
    return `hello ${this.name}`;
  }
}

const CustomerRecordSchema = Compose.equivalent(
  CustomerSchema,
  { '$id': 'https://bookstore.example/CustomerRecord' } as const
);

jt.set(CustomerRecordSchema);

// Class is the wire side: encode hydrates CustomerRecord, decode lowers it.
const CustomerRecordTransform = jt.addTransform(CustomerRecordSchema, {
  'decode': (instance: CustomerRecord) => {
    return {
      'addresses': instance.addresses,
      'customerId': instance.customerId,
      'email': instance.email,
      'name': instance.name
    };
  },
  'encode': (wire) => {
    const source = wire as CustomerWire;

    return Object.assign(Reflect.construct(CustomerRecord, []), {
      'addresses': source.addresses,
      'customerId': source.customerId,
      'email': source.email,
      'name': source.name
    });
  }
});

// Compose multiple class transforms by encoding each separately:
// First, hydrate the buyer using its own transform.
const customerWire = aboxFixtures.customer;
const hydratedBuyer = jt.encode(CustomerRecordTransform, customerWire);

console.assert(hydratedBuyer instanceof CustomerRecord);
console.assert(hydratedBuyer.greet() === `hello ${aboxFixtures.customer.name}`);
// true
console.log('buyer instanceof CustomerRecord:', hydratedBuyer instanceof CustomerRecord);
// true
console.log('buyer is properly hydrated:', typeof hydratedBuyer.greet === 'function');
// 'hello Bastian Balthazar Bux'
console.log('buyer.greet():', hydratedBuyer.greet());
