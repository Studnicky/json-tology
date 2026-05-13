# Class hydration via `Transform.create`

Plain JSON in, real class instance out, no new API. `Transform.create`'s `decode` and `encode` are a generic wire-to-runtime pair, and "runtime" is allowed to be a class instance with methods, getters, and an `instanceof` identity. This page documents the patterns that already work today.

All examples use the [bookstore domain](/bookstore-domain). For the underlying API see [`Transform.create` and `jt.encode`](/transforms/decode-encode).

---

## The pattern in one block

```ts
import { JsonTology, Transform } from 'json-tology';

class Order {
  id!: string;
  customerId!: string;
  items!: ReadonlyArray<{ bookIsbn: string; quantity: number; unitPrice: { amount: number } }>;
  total!: { amount: number };
  shippingAddress!: { street: string; city: string; postalCode: string };
  placedAt!: string;
  status: 'pending' | 'shipped' = 'pending';

  markShipped(): void {
    this.status = 'shipped';
  }

  totalWithTax(rate = 0.08): number {
    return this.total.amount * (1 + rate);
  }
}

const _OrderSchemaBare = {
  $id: 'urn:bookstore:Order',
  type: 'object',
  properties: {
    id:              { type: 'string' },
    customerId:      { type: 'string' },
    items:           { type: 'array', items: { type: 'object' } },
    total:           { type: 'object' },
    shippingAddress: { type: 'object' },
    placedAt:        { type: 'string', format: 'date-time' }
  },
  required: ['id', 'customerId', 'items', 'total', 'placedAt', 'shippingAddress']
} as const;

const OrderSchema = Transform.create(_OrderSchemaBare, {
  decode: (plain) => Object.assign(Reflect.construct(Order, []), plain),
  encode: (instance) => Object.fromEntries(
    Object.entries(instance).filter(([_key, value]) => typeof value !== 'function')
  )
});

const jt = JsonTology.create({ baseIRI: 'urn:bookstore', schemas: [OrderSchema] as const });

const order = jt.instantiate(OrderSchema.$id, raw);
order.markShipped();           // class method on a hydrated instance
order instanceof Order;         // true
JSON.stringify(order);          // round-trips through encode (or toJSON if defined)
```

That is the whole pattern. The remainder of this page is variations, tradeoffs, and recipes for real frameworks.

---

## Why this works without a new API

`Transform.create(schema, { decode, encode })` registers a wire-to-runtime pair on the schema. The pair is symmetric: `decode` runs after validation when `jt.instantiate` produces a value, and `encode` runs when `jt.encode` (or `jt.dump`) projects the value back to the wire shape.

A class instance is just a runtime type that happens to carry methods on its prototype. There is nothing special about `new Foo()` that the registry needs to know about. Any function that takes a validated plain object and returns "the runtime thing" is a legal `decode`, and any function that returns the wire shape from "the runtime thing" is a legal `encode`.

The phantom brand carried by `TransformedType<TSchema, Order>` (which `Transform.create` returns) makes `InferType<typeof OrderSchema>` resolve to `Order`, so call sites get the class type directly without casts. Type inference, schema graph, and registry plumbing all work as they do for `Date` or `Decimal`.

In short, class hydration is not a feature; it is a use of an existing feature. Nothing new is needed.

---

## Three lift strategies

There are three idiomatic ways to turn a validated plain object into a class instance. Each has tradeoffs.

### `Object.assign(Reflect.construct(Order, []), plain)`

```ts
const OrderSchema = Transform.create(_OrderSchemaBare, {
  decode: (plain) => Object.assign(Reflect.construct(Order, []), plain),
  encode: (instance) => ({ ...instance })
});
```

**When to use.** Default for most cases. Works whether or not the constructor takes arguments, because `Reflect.construct(Order, [])` calls it with `[]`.

**Gotcha.** The constructor still runs once per `instantiate`. If it logs, registers itself with a parent collection, opens a file handle, or otherwise does I/O, every hydrated instance will repeat that work.

### `Object.assign(new Order(), plain)`

```ts
const OrderSchema = Transform.create(_OrderSchemaBare, {
  decode: (plain) => Object.assign(new Order(), plain),
  encode: (instance) => ({ ...instance })
});
```

**When to use.** Same case as `Reflect.construct`, but the syntax is more familiar. Only valid when the constructor is parameterless or all parameters are optional.

**Gotcha.** Same constructor side-effect concern. Also fails at compile time if the constructor signature requires arguments.

### `Order.fromPlain(plain)`

```ts
class Order {
  static fromPlain(plain: PlainOrder): Order {
    const o = new Order(plain.id, plain.customerId);  // run real construction
    o.items = plain.items;
    o.total = plain.total;
    // ... assign rest, validate invariants, set #private fields, etc.
    return o;
  }
}

const OrderSchema = Transform.create(_OrderSchemaBare, {
  decode: (plain) => Order.fromPlain(plain),
  encode: (instance) => instance.toPlain()
});
```

**When to use.** Recommended for classes with `#privateFields`, non-trivial constructors, derived state, or invariants the class needs to enforce on construction.

**Gotcha.** You write more code per class. The payoff is that hydration is explicit and the class stays in control of its own initialization.

### `Object.setPrototypeOf(plain, Order.prototype)`

```ts
const OrderSchema = Transform.create(_OrderSchemaBare, {
  decode: (plain) => {
    Object.setPrototypeOf(plain, Order.prototype);
    return plain as Order;
  },
  encode: (instance) => ({ ...instance })
});
```

**When to use.** Hot paths where allocation is the bottleneck. Skips the constructor entirely; reuses the validated object as the instance backing store.

**Gotcha.** Private fields (`#name`) are bound during class initialization. A prototype swap does not initialize them, so any access throws `TypeError: Cannot read private member from an object whose class did not declare it`. If your class uses `#`, do not use this strategy.

---

## The encode direction

`encode` must take a hydrated instance back to the validated wire shape. Three idiomatic options:

### Filter methods automatically

```ts
encode: (instance) => Object.fromEntries(
  Object.entries(instance).filter(([_key, value]) => typeof value !== 'function')
)
```

This is the default in the headline example. It works because prototype methods are not enumerable own-properties: `Object.entries(instance)` only sees the data assigned by `decode`, so the filter is mostly belt-and-suspenders.

### `instance.toJSON()`

```ts
class Order {
  toJSON(): PlainOrder {
    return { id: this.id, customerId: this.customerId, /* ... */ };
  }
}

const OrderSchema = Transform.create(_OrderSchemaBare, {
  decode: (plain) => Object.assign(Reflect.construct(Order, []), plain),
  encode: (instance) => instance.toJSON()
});
```

**When to use.** The class already defines `toJSON` for `JSON.stringify` integration. Reusing it as the encode body keeps one source of truth for serialization shape.

### Explicit `instance.toPlain()`

```ts
class Order {
  #internalCacheKey = '';

  toPlain(): PlainOrder {
    return {
      id:        this.id,
      customerId: this.customerId,
      items:     this.items,
      total:     this.total,
      shippingAddress: this.shippingAddress,
      placedAt:  this.placedAt
      // status, totalWithTax, #internalCacheKey deliberately omitted
    };
  }
}
```

**When to use.** The class needs to omit derived fields, hide private state, or apply transforms before serialization. `toPlain` is also a useful convention when the class's `toJSON` is reserved for a different output format (e.g. an external API representation).

---

## Round-trip property test pattern

Class hydration is correct only if `dump(instantiate(s, x))` deep-equals `x`. Validate that with a test:

```ts
import { strict as assert } from 'node:assert';
import { test } from 'node:test';
import { JsonTology } from 'json-tology';
import { OrderSchema, Order } from './bookstore/Order.js';

test('OrderSchema round-trips wire to instance and back', () => {
  const jt = JsonTology.create({ baseIRI: 'urn:bookstore', schemas: [OrderSchema] as const });

  const wire = {
    id:              'order-1',
    customerId:      'cust-1',
    items:           [{ bookIsbn: '9780140449136', quantity: 2, unitPrice: { amount: 1499 } }],
    total:           { amount: 2998 },
    shippingAddress: { street: '1 Main', city: 'Springfield', postalCode: '00000' },
    placedAt:        '2026-01-15T10:30:00.000Z'
  };

  const instance = jt.instantiate(OrderSchema.$id, wire);
  assert.ok(instance instanceof Order);

  const reEncoded = jt.encode(OrderSchema, instance);
  assert.deepStrictEqual(reEncoded, wire);
});
```

This matters because `decode` and `encode` are independent functions; nothing forces them to be inverses. A round-trip test is the cheapest way to catch drift the moment it happens, before it propagates into queue payloads, database rows, or HTTP responses.

---

## Recipes for real ORMs and patterns

### TypeORM `@Entity()`

```ts
import { Entity, Column, PrimaryColumn } from 'typeorm';

@Entity()
class Order {
  @PrimaryColumn() id!: string;
  @Column() customerId!: string;
  @Column('jsonb') items!: ReadonlyArray<{ bookIsbn: string; quantity: number }>;
  @Column('jsonb') total!: { amount: number };
  @Column() placedAt!: string;

  markShipped(): void { this.status = 'shipped'; }
  status: 'pending' | 'shipped' = 'pending';
}

const OrderSchema = Transform.create(_OrderSchemaBare, {
  decode: (plain) => Object.assign(Reflect.construct(Order, []), plain),
  encode: (instance) => ({ ...instance })
});

// Now:
const entity = jt.instantiate(OrderSchema.$id, payload);
await repository.save(entity);    // a real TypeORM entity, not a plain object
```

TypeORM entity classes have parameterless constructors by design, so `Reflect.construct` is the right strategy. The hydrated value is a fully-decorated entity that the repository will persist.

### Prisma generated model classes

`prisma generate` emits TypeScript classes with the same field shape as the database row. Treat them exactly like TypeORM entities:

```ts
import { Order } from '@prisma/client';

const OrderSchema = Transform.create(_OrderSchemaBare, {
  decode: (plain) => Object.assign(Reflect.construct(Order, []), plain),
  encode: (instance) => ({ ...instance })
});
```

If the generated class is a type rather than a runtime value (some Prisma configurations), define your own thin class with the same shape and methods, and use it as the decode target.

### Mikro-ORM and Drizzle

Same pattern. Mikro-ORM `@Entity` and Drizzle's `InferModel`-derived classes both satisfy "parameterless constructor, mutable fields"; `Reflect.construct` handles both.

### DDD value object

```ts
class Money {
  constructor(public amount: number, public currency: string) {
    if (amount < 0) throw new RangeError('Money cannot be negative');
  }
  add(other: Money): Money {
    if (other.currency !== this.currency) throw new Error('currency mismatch');
    return new Money(this.amount + other.amount, this.currency);
  }
  static fromPlain(p: { amount: number; currency: string }): Money {
    return new Money(p.amount, p.currency);
  }
}

const MoneySchema = Transform.create(
  { $id: 'urn:bookstore:Money', type: 'object', properties: {
      amount: { type: 'integer', minimum: 0 },
      currency: { type: 'string', pattern: '^[A-Z]{3}$' }
    }, required: ['amount', 'currency'] } as const,
  {
    decode: (plain) => Money.fromPlain(plain),
    encode: (m) => ({ amount: m.amount, currency: m.currency })
  }
);
```

`fromPlain` is the right strategy here because `Money`'s constructor enforces invariants. Bypassing it via prototype swap would silently allow negative amounts.

### Active Record

```ts
class User {
  id!: string;
  email!: string;

  async save(): Promise<void> { /* INSERT or UPDATE via this.id */ }
  async delete(): Promise<void> { /* DELETE WHERE id = this.id */ }
}

const UserSchema = Transform.create(_UserSchemaBare, {
  decode: (plain) => Object.assign(Reflect.construct(User, []), plain),
  encode: (instance) => Object.fromEntries(
    Object.entries(instance).filter(([_key, value]) => typeof value !== 'function')
  )
});

const user = jt.instantiate(UserSchema.$id, payload);
await user.save();    // active record method available immediately on the hydrated value
```

Whatever flows out of `instantiate` is ready to call `.save()`, `.delete()`, or any other instance method. There is no separate "hydrate" step in the call site.

---

## Nested class hydration

When one class-attached schema `$ref`s another class-attached schema, the registry walks references and applies each schema's decoder bottom-up.

```ts
class Customer {
  id!: string;
  email!: string;
  fullName(): string { return `${this.given} ${this.family}`; }
  given!: string;
  family!: string;
}

const _CustomerSchemaBare = {
  $id: 'urn:bookstore:Customer',
  type: 'object',
  properties: {
    id:     { type: 'string' },
    email:  { type: 'string', format: 'email' },
    given:  { type: 'string' },
    family: { type: 'string' }
  },
  required: ['id', 'email', 'given', 'family']
} as const;

const CustomerSchema = Transform.create(_CustomerSchemaBare, {
  decode: (plain) => Object.assign(Reflect.construct(Customer, []), plain),
  encode: (instance) => Object.fromEntries(
    Object.entries(instance).filter(([_key, value]) => typeof value !== 'function')
  )
});

const _OrderSchemaBare = {
  $id: 'urn:bookstore:Order',
  type: 'object',
  properties: {
    id:    { type: 'string' },
    buyer: { $ref: CustomerSchema.$id },
    items: { type: 'array', items: { type: 'object' } }
  },
  required: ['id', 'buyer', 'items']
} as const;

const OrderSchema = Transform.create(_OrderSchemaBare, {
  decode: (plain) => Object.assign(Reflect.construct(Order, []), plain),
  encode: (instance) => Object.fromEntries(
    Object.entries(instance).filter(([_key, value]) => typeof value !== 'function')
  )
});
```

When `jt.instantiate(OrderSchema.$id, raw)` runs, the registry first decodes `raw.buyer` through `CustomerSchema`'s decoder (producing a `Customer` instance), then runs `OrderSchema`'s decoder over the now-mixed plain-object/`Customer` payload. The result: `order.buyer` is a `Customer` and `order` is an `Order`. `order.buyer.fullName()` is callable directly.

`encode` runs in the reverse direction: `Order.encode` projects the `Order` to a plain shape that still contains a `Customer` in `buyer`, and the registry then applies `Customer.encode` to that field on its way back to the wire.

---

## Comparison with other libraries

::: code-group

```ts [json-tology]
class User { greet(): string { return `hi ${this.name}`; } name!: string; }

const UserSchema = Transform.create(
  { $id: 'urn:User', type: 'object', properties: { name: { type: 'string' } }, required: ['name'] } as const,
  {
    decode: (plain) => Object.assign(Reflect.construct(User, []), plain),
    encode: (instance) => ({ ...instance })
  }
);

const user = jt.instantiate(UserSchema.$id, { name: 'Ada' });
user.greet();             // 'hi Ada'
user instanceof User;      // true
```

```py [Pydantic]
from pydantic import BaseModel

class User(BaseModel):
    name: str
    def greet(self) -> str:
        return f'hi {self.name}'

# The class IS the schema. Native class support; no separate transform call.
user = User.model_validate({'name': 'Ada'})
user.greet()
```

```ts [Effect Schema]
import { Schema } from '@effect/schema';

class User extends Schema.Class<User>('User')({
  name: Schema.String
}) {
  greet(): string { return `hi ${this.name}`; }
}

// Native class support via Schema.Class.
const user = Schema.decodeUnknownSync(User)({ name: 'Ada' });
user.greet();
```

```ts [Zod]
import { z } from 'zod';

class User { constructor(public name: string) {} greet(): string { return `hi ${this.name}`; } }

const UserSchema = z.object({ name: z.string() }).transform((data) => new User(data.name));

const user = UserSchema.parse({ name: 'Ada' });
user.greet();
// Limitation: encode direction is not registered. The reverse must be hand-written.
```

```ts [TypeBox + Value]
import { Type, Value } from '@sinclair/typebox';

const UserT = Type.Object({ name: Type.String() });
class User { constructor(public name: string) {} greet(): string { return `hi ${this.name}`; } }

// Validate, then construct manually:
const decoded = Value.Decode(UserT, { name: 'Ada' });
const user = new User(decoded.name);
// Limitation: hydration is not schema-registered; every call site must repeat it.
```

```ts [io-ts]
import * as t from 'io-ts';
import { fold } from 'fp-ts/Either';

class User { constructor(public name: string) {} greet(): string { return `hi ${this.name}`; } }

const UserCodec = new t.Type<User, { name: string }>(
  'User',
  (u): u is User => u instanceof User,
  (input, ctx) => {
    const ok = t.type({ name: t.string }).decode(input);
    return fold(
      (errors) => t.failure(input, ctx, 'invalid'),
      (parsed: { name: string }) => t.success(new User(parsed.name))
    )(ok);
  },
  (user) => ({ name: user.name })
);
// Native both-direction codec, but the boilerplate is per-class and verbose.
```

```ts [Valibot]
import * as v from 'valibot';

class User { constructor(public name: string) {} greet(): string { return `hi ${this.name}`; } }

const UserSchema = v.pipe(
  v.object({ name: v.string() }),
  v.transform((p) => new User(p.name))
);

const user = v.parse(UserSchema, { name: 'Ada' });
// Limitation: encode direction is not schema-registered.
```

:::

**Native class support:** Pydantic and Effect Schema; the class declaration *is* the schema declaration.

**Manual transform required:** Zod, Valibot, TypeBox, io-ts, json-tology. The difference is that json-tology's `Transform.create` is the canonical pattern documented here, with first-class type inference (`InferType<typeof OrderSchema>` resolves to `Order`), automatic registry integration during `$ref` walks, and a registered encode direction for round-trips. The other "manual transform" libraries either lack the encode side (Zod, Valibot, TypeBox) or require per-class boilerplate (io-ts).

---

## Caveats

- **Constructor side-effects fire on every `instantiate`** if you use the `Reflect.construct` or `new Order()` strategies. If the constructor logs, registers itself with a parent collection, or performs I/O, prefer `Order.fromPlain` so you control when those effects run.
- **Private (`#`) fields:** only `Order.fromPlain` (or any path that goes through `new Order(...)` for real) initializes them. `Object.setPrototypeOf` skips initialization, so the first access throws `TypeError: Cannot read private member from an object whose class did not declare it`.
- **`instanceof` checks:** all four strategies set the prototype correctly, so `result instanceof Order` works regardless of which strategy you pick.
- **Round-trip discipline:** `encode` must be a true inverse of `decode`. If `decode` adds derived state (`this.totalWithTax = ...`), `encode` must drop it. Use the property test pattern above to catch drift.
- **Method enumeration:** the default `Object.fromEntries(Object.entries(...).filter(([_, v]) => typeof v !== 'function'))` works for prototype methods, because prototype methods are not enumerable own-properties. It fails if the class assigns methods as instance fields (`this.markShipped = () => {...}` in the constructor), because those become enumerable own-properties. The workaround is to define `toJSON` or `toPlain` on the class and use that as the encode body.
- **Schema must be registered before instantiation.** As with every transform, `Transform.create` must run before the schema is registered with `JsonTology.create({ schemas })`, not after. Attaching to an already-registered reference is a no-op for the registry.

---

## Related

- [`Transform.create` and `jt.encode`](/transforms/decode-encode) - the underlying API
- [`Transform.chain`](/transforms/chain) - multi-step wire transformations
- [`Transform.brand`](/transforms/brand) - nominal typing without classes
- [Transform recipes](/usage-examples/transforms-recipes) - date, money, and identifier recipes

## See also

- [Bookstore domain](/bookstore-domain) - where `OrderSchema` and `CustomerSchema` are defined
- [Sub-schemas and `$ref` composition](/advanced/sub-schemas) - how nested decoders compose
- [Picking a method](/picking-a-method) - when to use `instantiate` vs `validate` vs `materialize`
