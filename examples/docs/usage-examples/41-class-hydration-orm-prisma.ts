/**
 * Class hydration ORM recipes — Prisma generated model classes
 *
 * `prisma generate` emits TypeScript classes with the same field shape
 * as the database row. Treat them exactly like TypeORM entities. If
 * the generated class is a type rather than a runtime value (some
 * Prisma configurations), define a thin class with the same shape and
 * methods and use it as the decode target.
 */

import { Compose } from '../../../src/index.js';
import type { UnbrandType } from '../../../src/types/index.js';
import {
  aboxFixtures, createBookstoreDocRegistry,
  OrderSchema
} from '../bookstore/index.js';

// The canonical (brand-free) Order shape.
type OrderWire = UnbrandType<typeof aboxFixtures.order>;

// createBookstoreDocRegistry seeds a permissive copy of the bookstore — docs examples extend
// it with ad-hoc demo schemas; strict-graph checking is intentionally off here.
const jt = createBookstoreDocRegistry();

// Stand-in for `import { Order } from '@prisma/client';`.
// The class is the wire side (TWire).
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

// Class hydration: the class is the wire side, canonical JSON is the runtime.
// Hydration is `encode`; lowering is `instantiate`.
const prismaOrderTransform = jt.addTransform(PrismaOrderSchema, {
  'decode': (instance: PrismaOrder) => {
    return {
      'customerId': instance.customerId,
      'orderId': instance.orderId,
      'orderLines': instance.orderLines,
      'orderTotal': instance.orderTotal,
      'placedAt': instance.placedAt,
      'shippingAddress': instance.shippingAddress
    };
  },
  'encode': (wire) => {
    const source = wire as OrderWire;

    return Object.assign(Reflect.construct(PrismaOrder, []), {
      'customerId': source.customerId,
      'orderId': source.orderId,
      'orderLines': source.orderLines,
      'orderTotal': source.orderTotal,
      'placedAt': source.placedAt,
      'shippingAddress': source.shippingAddress
    });
  }
});

// Hydrate canonical JSON into a Prisma order instance.
const order = jt.encode(prismaOrderTransform, aboxFixtures.order as unknown as OrderWire);

console.assert(order instanceof PrismaOrder);
console.assert(order.orderId === aboxFixtures.order.orderId);
// true
console.log('instanceof PrismaOrder:', order instanceof PrismaOrder);
// same UUID as fixture
console.log('orderId:', order.orderId);
