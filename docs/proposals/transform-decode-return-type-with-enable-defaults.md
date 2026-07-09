# Proposal: `decode` return type should tolerate partial output when `enableDefaults` is set

**Status: Resolved.** `Transform.create`'s `decode` is typed
`(raw: TWire) => Partial<CanonicalShapeType<TSchema, TReferences>>` in
`src/modules/transform/Transform.ts`. A normalize-transform `decode` can
return just the fields it transforms and rely on schema `default`s (filled by
the validation pass that runs after `decode`) to complete the rest, with no
type assertion. `encode`'s parameter type is unchanged — it always consumes
the full canonical shape, since it runs on the validated, fully-defaulted
result. `instantiate()`'s return type is derived from the schema's own
`ParseOutputType`, independent of `decode`'s declared return type, so this
widening is author-facing only and does not change what consumers see from
`instantiate()`.

## Summary

`Transform.create(schema, { decode, encode })` types `decode` as
`(raw: TWire) => CanonicalShapeType<TSchema>` — the **full** canonical shape
(every `required` key present). But when a caller runs
`instantiate(codec, data, { enableDefaults: true })`, the runtime applies the
schema's defaults *after* `decode`, so a normalize-transform `decode` only needs
to return the fields it actually transforms. The type forces it to return the
complete canonical value anyway, which means a decode that just coerces a couple
of fields must additionally re-declare/fill every default (duplicating the
schema's `default` keywords) or resort to a type assertion.

## Evidence (runtime already does the right thing)

With a passthrough `decode` and `enableDefaults: true`, `instantiate` fills the
schema defaults:

```ts
const codec = Transform.create(ConfigSchema, {
  decode: (raw) => raw as never,   // returns the partial wire, no defaults
  encode: (v) => v as never,
});

const out = JsonTology.instantiate(codec, { model: 'ollama:llama3' }, { enableDefaults: true });
// out === fully-defaulted canonical: { coverLetter: false, providers: { ollama: { port: 11434, ... }, ... }, modelConfig: { maxTokens: 4096, ... }, ... }
```

So the engine performs `decode → applyDefaults → validate`. Only the **types**
assume `decode` is a total transform producing the full canonical.

## The friction

A schema where every property has a `default` is fully populated by
`enableDefaults`. A transform whose only job is wire coercion (e.g. env-var
strings → integers) wants:

```ts
decode: (raw) => coerceNumerics(raw)   // returns the partial, coerced wire
```

but is forced to return `CanonicalShapeType<TSchema>` (all keys present). The
workarounds are both unappealing:

1. Re-declare all defaults inside `decode` (duplicates the schema's `default`s).
2. `return coerced as unknown as CanonicalShapeType<...>` (an unsafe assertion;
   blocked by stricter lint configs).

## Proposed change

When the decode is used through an `instantiate({ enableDefaults: true })` path,
let `decode` return a partial/input-shaped value and have the library complete
it from schema defaults — i.e. the `decode` return type should be
`Partial<CanonicalShapeType<TSchema>>` (or a dedicated decoded-input type) rather
than the full `CanonicalShapeType`. This mirrors what `materialize` already does
for default-fill, and matches the runtime behaviour shown above.

Alternatively, expose a transform-construction variant (or option) that marks the
decoder as "defaults applied downstream", widening the return type accordingly.

## Why it matters

Config loading is a common trust-boundary edge: untrusted wire (env vars, files)
in, validated canonical out, with defaults from the schema. Today that forces
either default duplication or an unsafe cast inside the decoder, even though the
runtime already fills defaults correctly.

## Found via

`@resumatic/config` — `ConfigWire` decode coerces env-string numerics and is
bound to `ResumaticConfigSchema`; consumed through
`JsonTology.instantiate(codec, raw)`.
