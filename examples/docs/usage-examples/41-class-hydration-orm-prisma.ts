/**
 * Class hydration ORM recipes — Prisma generated model classes
 *
 * `prisma generate` emits TypeScript classes with the same field shape
 * as the database row. Treat them exactly like TypeORM entities. If
 * the generated class is a type rather than a runtime value (some
 * Prisma configurations), define a thin class with the same shape and
 * methods and use it as the decode target.
 */

import {
  Compose, Transform
} from '../../../src/index.js';
import {
  aboxFixtures, createBookstoreDocRegistry,
  OrderSchema
} from '../bookstore/index.js';

type OrderWire = typeof aboxFixtures.order;

// Stand-in for `import { Order } from '@prisma/client';`.

// createBookstoreDocRegistry seeds a permissive copy of the bookstore — docs examples extend
// it with ad-hoc demo schemas; strict-graph checking is intentionally off here.
const jt = createBookstoreDocRegistry();

class PrismaOrder {
  declare public customerId: string;
  declare public orderId: string;
  declare public orderLines: OrderWire['orderLines'];
  declare public orderTotal: OrderWire['orderTotal'];
  declare public placedAt: OrderWire['placedAt'];
  declare public shippingAddress: OrderWire['shippingAddress'];
}

const PrismaOrderSchema = Compose.equivalent(
  OrderSchema,
  { '$id': 'https://bookstore.example/PrismaOrder' } as const
);

jt.set(PrismaOrderSchema);

Transform.create<typeof PrismaOrderSchema, PrismaOrder>(PrismaOrderSchema, {
  'decode': (plain) => {
    return Object.assign(Reflect.construct(PrismaOrder, []), plain);
  },
  'encode': (instance) => {
    return { ...instance };
  }
});

const order = jt.instantiate(
  PrismaOrderSchema,
  aboxFixtures.order
);

console.assert(order instanceof PrismaOrder);
console.assert((order as PrismaOrder).orderId === aboxFixtures.order.orderId);
