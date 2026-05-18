/**
 * Class hydration — nested class hydration via $ref composition
 *
 * When one class-attached schema $refs another class-attached schema,
 * the registry walks references and applies each schema's decoder
 * bottom-up: the inner CustomerSchema decoder runs first, producing
 * a `CustomerRecord`, then the outer OrderSchema decoder runs on a
 * payload that already contains the `CustomerRecord` in the buyer
 * slot.
 *
 * Registered against `Compose.equivalent` siblings so the canonical
 * schemas keep their plain wire-shape behaviour.
 */

import {
  Compose, Transform
} from '../../../src/index.js';
import type { JsonSchemaDocumentType } from '../../../src/types/index.js';
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

  public greet(): string {
    return `hello ${this.name}`;
  }
}

const CustomerRecordSchema = Compose.equivalent(
  CustomerSchema,
  { '$id': 'https://bookstore.example/CustomerRecord' } as const
);

jt.set(CustomerRecordSchema);

Transform.create<typeof CustomerRecordSchema, CustomerRecord>(CustomerRecordSchema, {
  'decode': (plain) => {
    return Object.assign(Reflect.construct(CustomerRecord, []), plain);
  },
  'encode': (instance) => {
    return { ...instance };
  }
});

class OrderWithBuyer {
  declare public buyer: CustomerRecord;
  declare public id: string;
}

const NestedOrderSchema = {
  '$id': 'https://bookstore.example/NestedOrder',
  'properties': {
    'buyer': { '$ref': CustomerRecordSchema.$id },
    'id': { 'type': 'string' }
  },
  'required': [
    'id',
    'buyer'
  ],
  'type': 'object'
} as const satisfies JsonSchemaDocumentType;

jt.set(NestedOrderSchema);

Transform.create<typeof NestedOrderSchema, OrderWithBuyer>(NestedOrderSchema, {
  'decode': (plain) => {
    return Object.assign(Reflect.construct(OrderWithBuyer, []), plain);
  },
  'encode': (instance) => {
    return { ...instance };
  }
});

const wire = {
  'buyer': aboxFixtures.customer,
  'id': aboxFixtures.order.id
};

const hydrated = jt.instantiate(NestedOrderSchema.$id, wire) as OrderWithBuyer;

console.assert(hydrated instanceof OrderWithBuyer);
console.assert(hydrated.buyer instanceof CustomerRecord);
console.assert(hydrated.buyer.greet() === `hello ${aboxFixtures.customer.name}`);
