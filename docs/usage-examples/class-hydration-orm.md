---
title: "Class hydration: ORM recipes"
---

# Class hydration: ORM recipes

Recipes for hydrating into ORM entity classes (TypeORM, Prisma, Sequelize, etc.). Prerequisite: [Class hydration](/usage-examples/class-hydration) for the general pattern and lift strategies.

---

## Recipes for real ORMs and patterns

### TypeORM `@Entity()`

<<< ../../examples/docs/usage-examples/40-class-hydration-orm-typeorm.ts

TypeORM entity classes have parameterless constructors by design, so `Reflect.construct` is the right strategy. The hydrated value is a fully-decorated entity that the repository will persist.

### Prisma generated model classes

`prisma generate` emits TypeScript classes with the same field shape as the database row. Treat them exactly like TypeORM entities:

<<< ../../examples/docs/usage-examples/41-class-hydration-orm-prisma.ts

If the generated class is a type rather than a runtime value (some Prisma configurations), define your own thin class with the same shape and methods, and use it as the decode target.

### Mikro-ORM and Drizzle

Same pattern. Mikro-ORM `@Entity` and Drizzle's `InferModel`-derived classes both satisfy "parameterless constructor, mutable fields"; `Reflect.construct` handles both.

### DDD value object

<<< ../../examples/docs/usage-examples/42-class-hydration-orm-ddd-money.ts

`fromPlain` is the right strategy here because `Money`'s constructor enforces invariants. Bypassing it via prototype swap would silently allow negative amounts.

### Active Record

<<< ../../examples/docs/usage-examples/43-class-hydration-orm-active-record.ts

Whatever flows out of `instantiate` is ready to call `.save()`, `.delete()`, or any other instance method. There is no separate "hydrate" step in the call site.

---

## See also

- [Class hydration](/usage-examples/class-hydration) - general pattern, lift strategies, encode direction, and caveats
- [`Transform.create` and `jt.encode`](/transforms/decode-encode) - the underlying API
- [Bookstore domain](/bookstore-domain) - where `OrderSchema` and `CustomerSchema` are defined
