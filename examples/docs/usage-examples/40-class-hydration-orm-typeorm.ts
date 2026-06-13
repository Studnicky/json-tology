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

import { Compose } from '../../../src/index.js';
import type { UnbrandType } from '../../../src/types/index.js';
import {
  aboxFixtures, createBookstoreDocRegistry,
  OrderSchema
} from '../bookstore/index.js';

// createBookstoreDocRegistry seeds a permissive copy of the bookstore — docs examples extend
// it with ad-hoc demo schemas; strict-graph checking is intentionally off here.
const jt = createBookstoreDocRegistry();

// The canonical (brand-free) Order shape — what the transform's decode produces
// and encode consumes.
type OrderWire = UnbrandType<typeof aboxFixtures.order>;

// Stand-in for `@Entity()` + `@Column(...)` decorated TypeORM class.
// The class is the wire side (TWire) — it gets decoded to canonical JSON and
// encoded back from it.
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

// Class hydration uses a normalize transform in REVERSE: the class is the wire
// side (TWire), the schema's canonical JSON is what `instantiate` validates.
//   - decode (wire → canonical): lowers an OrderEntity instance to canonical JSON.
//   - encode (canonical → wire): hydrates canonical JSON into an OrderEntity.
// So hydration is `encode`; validating an entity into canonical JSON is `instantiate`.
// `addTransform` (instance-bound) resolves the canonical via the registry's refs.
const TypeOrmOrderTransform = jt.addTransform(TypeOrmOrderSchema, {
  'decode': (instance: OrderEntity) => {
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
    // The canonical Order is structurally wider than the fixture-shaped entity.
    // Narrow once at the hydration boundary — the runtime values are the validated
    // canonical JSON.
    const source = wire as OrderWire;

    const entity = Object.assign(Reflect.construct(OrderEntity, []), {
      'customerId': source.customerId,
      'orderId': source.orderId,
      'orderLines': source.orderLines,
      'orderTotal': source.orderTotal,
      'placedAt': source.placedAt,
      'shippingAddress': source.shippingAddress
    });

    return entity;
  }
});

// Hydrate canonical JSON into a class instance — the encode direction.
const entity = jt.encode(TypeOrmOrderTransform, aboxFixtures.order);

// Whatever flows out of `encode` is ready to call instance methods.
entity.markShipped();
console.assert(entity.status === 'shipped');
console.assert(entity instanceof OrderEntity);
// true
console.log('instanceof OrderEntity:', entity instanceof OrderEntity);
// 'shipped'
console.log('status after markShipped():', entity.status);
// hydrated from fixture
console.log('orderId:', entity.orderId);
