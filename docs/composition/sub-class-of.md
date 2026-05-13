# `Compose.subClassOf` / `Compose.disjointWith` / `Compose.complementOf`

> Validation modes: [Validation modes reference](/validation-modes)

These three methods complete the OWL class-axiom set on `Compose`. They are authored as plain JSON Schema documents — every concept lives behind a method, not behind a custom keyword on the schema literal.

## Declaration

```ts
Compose.subClassOf(parent | parents, body): { $id, allOf: [{ $ref }, ...] }
Compose.disjointWith(other, body):           { $id, disjointWith, ...body }
Compose.complementOf(other, body):           { $id, not: { $ref }, ...body }
```

**`subClassOf`** <Badge type="info" text="Compile-time" /> — self-subclass is a compile-time error (`SelfSubClassType` brand). The body's `$id` cannot match any parent's `$id`.

**`disjointWith`** <Badge type="warning" text="Compile-time + Runtime" /> — compile-time brand (`~jt:disjointWith`) names the disjoint target; runtime enforces the constraint at `validate` / `instantiate`.

**`complementOf`** <Badge type="info" text="Compile-time" /> — adds `~jt:complementOf` brand naming the complement target. Runtime JSON Schema `not` semantics apply.

`body` always carries the new schema's `$id` and any structural keywords you would normally write inline (`type`, `properties`, `required`, `description`, etc.).

## Use this when

- **`subClassOf`** — you want explicit taxonomic narrowing with one OR multiple parents. Emits `rdfs:subClassOf` per parent in the OWL TBox.
- **`disjointWith`** — two classes share no instances (e.g. `Weapon` and `Armor`). Emits `owl:disjointWith`.
- **`complementOf`** — a class is the negation of another (e.g. `NonHumanRace` is everything that is not `HumanRace`). Emits `owl:complementOf`.

## Don't use this when

- You only need property-merging with a single parent — use [`Compose.extend`](/composition/extend), which is structurally equivalent (both produce `allOf + $ref`) but signals "extension" rather than "is-a".
- You want type aliasing without OWL semantics — use [`Compose.equivalent`](/composition/equivalent).
- You want individual-level identity (`owl:sameAs` between two ABox individuals) — use [`JsonTology.prototype.sameAs`](/advanced/sameas). Class axioms operate on the TBox layer.

## Examples

### Example 1: single-parent subclass

```ts
import { Compose } from 'json-tology';

const EquipmentSchema = {
  $id: 'aonprd:Equipment',
  type: 'object',
  properties: { price: { type: 'number' }, weight: { type: 'number' } },
} as const;

const WeaponSchema = Compose.subClassOf(EquipmentSchema, {
  $id: 'aonprd:Weapon',
  type: 'object',
  properties: { damage: { type: 'string' } },
});

// Output shape:
// {
//   $id: 'aonprd:Weapon',
//   allOf: [
//     { $ref: 'aonprd:Equipment' },
//     { type: 'object', properties: { damage: { type: 'string' } } }
//   ]
// }
```

### Example 2: multiple parents

```ts
const ScopedAuthorityToken = Compose.subClassOf(
  [BearerTokenSchema, ScopedTokenSchema],
  {
    $id: 'urn:auth:ScopedAuthorityToken',
    type: 'object',
    properties: { aud: { type: 'string' } },
  },
);

// allOf carries one $ref per parent followed by the body block.
```

### Example 3: disjoint classes

```ts
const Armor = Compose.disjointWith(WeaponSchema, {
  $id: 'aonprd:Armor',
  type: 'object',
  properties: { ac: { type: 'integer' } },
});

// In the OWL TBox: aonprd:Armor owl:disjointWith aonprd:Weapon .
```

### Example 4: complement class

```ts
const NonHumanRace = Compose.complementOf(HumanRaceSchema, {
  $id: 'aonprd:NonHumanRace',
  type: 'object',
});

// In the OWL TBox: aonprd:NonHumanRace owl:complementOf aonprd:HumanRace .
// JSON Schema validation: a value matches NonHumanRace iff it does NOT match HumanRace.
```

## Comparison

::: code-group

```ts [json-tology]
const Weapon = Compose.subClassOf(EquipmentSchema, {
  $id: 'aonprd:Weapon',
  type: 'object',
  properties: { damage: { type: 'string' } },
});
```

```ts [Zod]
// Zod has no native subclass concept; structural extension is the closest analog.
const Weapon = EquipmentSchema.extend({ damage: z.string() });
// Limitation: no OWL TBox emission, no multi-parent support.
```

```ts [Effect Schema]
import { Schema } from 'effect';
const Weapon = Schema.extend(EquipmentSchema, Schema.Struct({ damage: Schema.String }));
// Limitation: no taxonomic vs property-merge distinction.
```

```ts [TypeBox]
import { Type } from '@sinclair/typebox';
const Weapon = Type.Composite([
  EquipmentSchema,
  Type.Object({ damage: Type.String() }),
]);
// Limitation: no semantic distinction between extension and subclassing.
```

```ts [io-ts]
import * as t from 'io-ts';
const Weapon = t.intersection([EquipmentCodec, t.type({ damage: t.string })]);
// Limitation: structural intersection only; no class identity.
```

```ts [Valibot]
import * as v from 'valibot';
const Weapon = v.intersect([
  EquipmentSchema,
  v.object({ damage: v.string() }),
]);
// Limitation: no inheritance model; no OWL output.
```

```py [Pydantic]
class Weapon(Equipment):
    damage: str
# Pydantic's Python class hierarchy is the natural taxonomic mechanism,
# but it does not emit OWL or JSON Schema axioms by default.
```

:::

## Related / See also

- [`Compose.extend`](/composition/extend) — property-merging extension (single parent, allOf+$ref shape, no explicit "subclass" semantic)
- [`Compose.equivalent`](/composition/equivalent) — `owl:equivalentClass` for structurally identical types
- [`Compose.intersection`](/composition/intersection) — generic `allOf` over multiple schemas
- [OWL TBox output](/advanced/ontology#entities-totbox)
- [Graph-native authoring](/advanced/graph-native-authoring)
