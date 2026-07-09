/**
 * Class hydration ORM recipes — Active Record pattern
 *
 * Whatever flows out of `encode` is ready to call `.save()`,
 * `.delete()`, or any other instance method. There is no separate
 * "hydrate" step in the call site. Registered on a `Compose.equivalent`
 * sibling of the bookstore `CustomerSchema`.
 *
 * The CustomerRecord class is the wire side (TWire). decode lowers it to
 * canonical JSON, encode hydrates back to a CustomerRecord instance.
 */

import { Compose } from '../../../src/index.js';
import type { UnbrandType } from '../../../src/types/index.js';
import {
  aboxFixtures, createBookstoreDocRegistry,
  CustomerSchema
} from '../bookstore/index.js';

// createBookstoreDocRegistry seeds a permissive copy of the bookstore — docs examples extend
// it with ad-hoc demo schemas; strict-graph checking is intentionally off here.
const jt = createBookstoreDocRegistry();

// The canonical (brand-free) Customer shape.
type CustomerWire = UnbrandType<typeof aboxFixtures.customer>;

class CustomerRecord {
  declare public addresses: CustomerWire['addresses'];
  declare public customerId: string;
  declare public email: string;
  declare public name: string;

  public async delete(): Promise<{ readonly 'deletedId': string }> {
    // Stand-in for `DELETE WHERE customerId = this.customerId`.
    return { 'deletedId': this.customerId };
  }

  public async save(): Promise<{ readonly 'savedId': string }> {
    // Stand-in for `INSERT OR UPDATE customerId = this.customerId`.
    return { 'savedId': this.customerId };
  }
}

const ActiveRecordCustomerSchema = Compose.equivalent(
  CustomerSchema,
  { '$id': 'https://bookstore.example/ActiveRecordCustomer' } as const
);

jt.set(ActiveRecordCustomerSchema);

// Class hydration: CustomerRecord is the wire side. decode lowers it to canonical JSON,
// encode hydrates back to a CustomerRecord instance.
const activeRecordCustomerTransform = jt.addTransform(
  ActiveRecordCustomerSchema,
  {
    'decode': (instance: CustomerRecord) => {
      return {
        'addresses': instance.addresses,
        'customerId': instance.customerId,
        'email': instance.email,
        'name': instance.name
      };
    },
    'encode': (wire) => {
      // Narrow at the hydration boundary — runtime values are the validated
      // canonical JSON.
      const source = wire as CustomerWire;

      return Object.assign(Reflect.construct(CustomerRecord, []), {
        'addresses': source.addresses,
        'customerId': source.customerId,
        'email': source.email,
        'name': source.name
      });
    }
  }
);

// Hydrate canonical JSON into a CustomerRecord instance.
const customer = jt.encode(activeRecordCustomerTransform, aboxFixtures.customer as unknown as CustomerWire);

// Active-record method available immediately on the hydrated value.
const saved = await customer.save();

console.assert(saved.savedId === aboxFixtures.customer.customerId);
// true
console.log('instanceof CustomerRecord:', customer instanceof CustomerRecord);
// same customerId as fixture — no separate hydrate step
console.log('saved.savedId:', saved.savedId);
