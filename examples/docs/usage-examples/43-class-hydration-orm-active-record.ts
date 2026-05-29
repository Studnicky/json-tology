/**
 * Class hydration ORM recipes — Active Record pattern
 *
 * Whatever flows out of `instantiate` is ready to call `.save()`,
 * `.delete()`, or any other instance method. There is no separate
 * "hydrate" step in the call site. Registered on a `Compose.equivalent`
 * sibling of the bookstore `CustomerSchema`.
 */

import {
  Compose, Transform
} from '../../../src/index.js';
import {
  aboxFixtures, createBookstoreDocRegistry,
  CustomerSchema
} from '../bookstore/index.js';

// createBookstoreDocRegistry seeds a permissive copy of the bookstore — docs examples extend
// it with ad-hoc demo schemas; strict-graph checking is intentionally off here.
const jt = createBookstoreDocRegistry();

type CustomerWire = typeof aboxFixtures.customer;

class CustomerRecord {
  declare public addresses: CustomerWire['addresses'];
  declare public email: string;
  declare public id: string;
  declare public name: string;

  public async delete(): Promise<{ readonly 'deletedId': string }> {
    // Stand-in for `DELETE WHERE id = this.id`.
    return { 'deletedId': this.id };
  }

  public async save(): Promise<{ readonly 'savedId': string }> {
    // Stand-in for `INSERT OR UPDATE id = this.id`.
    return { 'savedId': this.id };
  }
}

const ActiveRecordCustomerSchema = Compose.equivalent(
  CustomerSchema,
  { '$id': 'https://bookstore.example/ActiveRecordCustomer' } as const
);

jt.set(ActiveRecordCustomerSchema);

const ActiveRecordCustomerTransform = Transform.create<
  typeof ActiveRecordCustomerSchema,
  CustomerRecord
>(ActiveRecordCustomerSchema, {
  'decode': (plain) => {
    return Object.assign(Reflect.construct(CustomerRecord, []), plain);
  },
  'encode': (instance) => {
    const entries = Object.entries(instance).filter(([
      , value
    ]) => {
      return typeof value !== 'function';
    });

    return Object.fromEntries(entries);
  }
});

const customer = jt.instantiate(
  ActiveRecordCustomerTransform,
  aboxFixtures.customer
);

// Active-record method available immediately on the hydrated value.
const saved = await customer.save();

console.assert(saved.savedId === aboxFixtures.customer.id);
