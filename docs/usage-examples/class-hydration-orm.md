---
title: "Class hydration: ORM recipes"
---

# Class hydration: ORM recipes

Recipes for hydrating into ORM entity classes (TypeORM, Prisma, Sequelize, etc.). Prerequisite: [Class hydration](/usage-examples/class-hydration) for the general pattern and lift strategies.

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

## See also

- [Class hydration](/usage-examples/class-hydration) - general pattern, lift strategies, encode direction, and caveats
- [`Transform.create` and `jt.encode`](/transforms/decode-encode) - the underlying API
- [Bookstore domain](/bookstore-domain) - where `OrderSchema` and `CustomerSchema` are defined
