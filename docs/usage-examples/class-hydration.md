# Class hydration via `Transform.create`

Plain JSON in, real class instance out, no new API. `Transform.create`'s `decode` and `encode` are a generic wire-to-runtime pair, and "runtime" is allowed to be a class instance with methods, getters, and an `instanceof` identity. This page documents the patterns that already work today.

All examples use the [bookstore domain](/bookstore-domain). For the underlying API see [`Transform.create` and `jt.encode`](/transforms/decode-encode).

---

## The pattern in one block

<RunnableExample src="examples/docs/usage-examples/02-class-hydration" />

That is the whole pattern. The remainder of this page is variations, tradeoffs, and recipes for real frameworks.

---

## Why this works without a new API

`Transform.create(schema, { decode, encode })` registers a wire-to-runtime pair on the schema. The pair is symmetric: `decode` runs **before** validation when `jt.instantiate` produces a value (the schema describes `decode`'s output, so validation runs on the decoded result — see [Canonical decode/default ordering](/instantiate-vs-materialize#canonical-decode-default-ordering)), and `encode` runs when `jt.encode` (or `jt.dump`) projects the value back to the wire shape.

A class instance is just a runtime type that happens to carry methods on its prototype. There is nothing special about `new Foo()` that the registry needs to know about. Any function that takes a validated plain object and returns "the runtime thing" is a legal `decode`, and any function that returns the wire shape from "the runtime thing" is a legal `encode`.

The phantom brand carried by `TransformedType<TSchema, Order>` (which `Transform.create` returns) makes `InferType<typeof OrderSchema>` resolve to `Order`, so call sites get the class type directly without casts. Type inference, schema graph, and registry plumbing all work as they do for `Date` or `Decimal`.

In short, class hydration is not a feature; it is a use of an existing feature. Nothing new is needed.

---

## Three lift strategies

There are three idiomatic ways to turn a validated plain object into a class instance. Each has tradeoffs.

### `Object.assign(Reflect.construct(Order, []), plain)`

<RunnableExample src="examples/docs/usage-examples/19-class-hydration-reflect-construct" />

**When to use.** Default for most cases. Works whether or not the constructor takes arguments, because `Reflect.construct(Order, [])` calls it with `[]`.

**Gotcha.** The constructor still runs once per `instantiate`. If it logs, registers itself with a parent collection, opens a file handle, or otherwise does I/O, every hydrated instance will repeat that work.

### `Object.assign(new Order(), plain)`

<RunnableExample src="examples/docs/usage-examples/20-class-hydration-new-instance" />

**When to use.** Same case as `Reflect.construct`, but the syntax is more familiar. Only valid when the constructor is parameterless or all parameters are optional.

**Gotcha.** Same constructor side-effect concern. Also fails at compile time if the constructor signature requires arguments.

### `Order.fromPlain(plain)`

<RunnableExample src="examples/docs/usage-examples/21-class-hydration-from-plain" />

**When to use.** Recommended for classes with `#privateFields`, non-trivial constructors, derived state, or invariants the class needs to enforce on construction.

**Gotcha.** You write more code per class. The payoff is that hydration is explicit and the class stays in control of its own initialization.

### `Object.setPrototypeOf(plain, Order.prototype)`

<RunnableExample src="examples/docs/usage-examples/22-class-hydration-set-prototype" />

**When to use.** Hot paths where allocation is the bottleneck. Skips the constructor entirely; reuses the validated object as the instance backing store.

**Gotcha.** Private fields (`#name`) are bound during class initialization. A prototype swap does not initialize them, so any access throws `TypeError: Cannot read private member from an object whose class did not declare it`. If your class uses `#`, do not use this strategy.

---

## The encode direction

`encode` must take a hydrated instance back to the validated wire shape. Three idiomatic options:

### Filter methods automatically

<RunnableExample src="examples/docs/usage-examples/23-class-hydration-encode-filter" />

This is the default in the headline example. It works because prototype methods are not enumerable own-properties: `Object.entries(instance)` only sees the data assigned by `decode`, so the filter does its real work when the class assigns methods as instance fields (`this.foo = () => ...`).

### `instance.toJSON()`

<RunnableExample src="examples/docs/usage-examples/24-class-hydration-encode-tojson" />

**When to use.** The class already defines `toJSON` for `JSON.stringify` integration. Reusing it as the encode body keeps one source of truth for serialization shape.

### Explicit `instance.toPlain()`

<RunnableExample src="examples/docs/usage-examples/25-class-hydration-encode-toplain" />

**When to use.** The class needs to omit derived fields, hide private state, or apply transforms before serialization. `toPlain` is also a useful convention when the class's `toJSON` is reserved for a different output format (e.g. an external API representation).

---

## Round-trip property test pattern

Class hydration is correct only if `encode(instantiate(s, x))` deep-equals `x`. Validate that with an assert:

<RunnableExample src="examples/docs/usage-examples/26-class-hydration-round-trip" />

This matters because `decode` and `encode` are independent functions; nothing forces them to be inverses. A round-trip test is the cheapest way to catch drift the moment it happens, before it propagates into queue payloads, database rows, or HTTP responses.

---

## ORM-specific recipes

For TypeORM, Prisma, and Sequelize patterns, see [Class hydration: ORM recipes](/usage-examples/class-hydration-orm).

---

## Nested class hydration

When one class-attached schema `$ref`s another class-attached schema, the registry walks references and applies each schema's decoder bottom-up.

<RunnableExample src="examples/docs/usage-examples/27-class-hydration-nested" />

When `jt.instantiate(OrderSchema.$id, raw)` runs, the registry first decodes `raw.buyer` through `CustomerSchema`'s decoder (producing a `Customer` instance), then runs `OrderSchema`'s decoder over the now-mixed plain-object/`Customer` payload. The result: `order.buyer` is a `Customer` and `order` is an `Order`. `order.buyer.greet()` is callable directly.

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
