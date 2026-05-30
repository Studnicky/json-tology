/**
 * Class hydration ORM recipes — TypeORM-style @Entity() pattern
 *
 * TypeORM entity classes have parameterless constructors by design, so
 * `Reflect.construct(Entity, [])` is the right strategy. The hydrated
 * value is a fully-decorated entity that the repository would persist
 * unchanged. Decorators are omitted here so the example runs without
 * `reflect-metadata`; the shape is identical to a @Entity-decorated
 * class.
 *
 * Registered on a `Compose.equivalent` sibling of `OrderSchema` so
 * the canonical scenario keeps its plain wire-shape behaviour.
 */

import {
  Compose, Transform
} from '../../../src/index.js';
import {
  aboxFixtures, createBookstoreDocRegistry,
  OrderSchema
} from '../bookstore/index.js';

// createBookstoreDocRegistry seeds a permissive copy of the bookstore — docs examples extend
// it with ad-hoc demo schemas; strict-graph checking is intentionally off here.
const jt = createBookstoreDocRegistry();

type OrderWire = typeof aboxFixtures.order;

// Stand-in for `@Entity()` + `@Column(...)` decorated TypeORM class.
class OrderEntity {
  declare public customerId: string;
  declare public orderId: string;
  declare public orderLines: OrderWire['orderLines'];
  declare public orderTotal: OrderWire['orderTotal'];
  declare public placedAt: OrderWire['placedAt'];
  declare public shippingAddress: OrderWire['shippingAddress'];
  public status: 'pending' | 'shipped' = 'pending';

  public markShipped(): void {
    this.status = 'shipped';
  }
}

const TypeOrmOrderSchema = Compose.equivalent(
  OrderSchema,
  { '$id': 'https://bookstore.example/TypeOrmOrder' } as const
);

jt.set(TypeOrmOrderSchema);

const TypeOrmOrderTransform = Transform.create<typeof TypeOrmOrderSchema, OrderEntity>(TypeOrmOrderSchema, {
  'decode': (plain) => {
    return Object.assign(Reflect.construct(OrderEntity, []), plain);
  },
  'encode': (instance) => {
    return { ...instance };
  }
});

const entity = jt.instantiate(
  TypeOrmOrderTransform,
  aboxFixtures.order
);

// Whatever flows out of `instantiate` is ready to call instance methods.
entity.markShipped();
console.assert(entity.status === 'shipped');
console.assert(entity instanceof OrderEntity);
// true
console.log('instanceof OrderEntity:', entity instanceof OrderEntity);
// 'shipped'
console.log('status after markShipped():', entity.status);
// hydrated from fixture
console.log('orderId:', entity.orderId);
